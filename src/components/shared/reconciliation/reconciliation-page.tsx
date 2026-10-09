import { useEffect, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Eye,
  Inbox,
  Info,
  Layers,
  ShieldAlert,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { StatCard } from "@/components/shared/stat-card";
import { useFetch } from "@/lib/hooks/use-fetch";
import { toast } from "sonner";
import { cn, timeAgo, formatDateTime } from "@/lib/utils";
import type {
  ReconciliationFinding,
  ReconciliationFindingsResponse,
  ReconciliationManualRunResponse,
  ReconciliationRunsResponse,
} from "@/lib/types";
import { MANUAL_RUN_URL, reconPost, transitionUrl } from "./recon-api";
import {
  FindingActionsMenu,
  LifecycleDialog,
  type LifecycleAction,
} from "./reconciliation-actions";
import {
  ReconciliationFilters,
  type ReconciliationFilterValues,
} from "./reconciliation-filters";
import { ReconciliationRunStrip } from "./reconciliation-run-strip";

const PAGE_SIZE = 50;
const RUNS_URL = "/api/admin/reconciliation/runs?limit=1";

// Must mirror the frozen 3B-5a server whitelist (reconciliation-findings.ts):
// q  -> [A-Za-z0-9 _./:@#-]{1,200}   check_code -> [A-Za-z0-9_]{1,64}
const Q_ALLOWED = /^[A-Za-z0-9 _./:@#-]+$/;
const CHECK_CODE_ALLOWED = /^[A-Za-z0-9_]{1,64}$/;
const MAX_Q_LEN = 200;

const EMPTY_FILTERS: ReconciliationFilterValues = {
  q: "",
  status: "",
  severity: "",
  subjectType: "",
  checkCode: "",
};

const SEVERITY_BADGE: Record<string, string> = {
  critical: "border-rose-300 text-rose-700 bg-rose-50 dark:bg-rose-950/30",
  warning: "border-amber-300 text-amber-700 bg-amber-50 dark:bg-amber-950/30",
  info: "border-sky-300 text-sky-700 bg-sky-50 dark:bg-sky-950/30",
};

const STATUS_BADGE: Record<string, string> = {
  open: "border-sky-300 text-sky-700 bg-sky-50 dark:bg-sky-950/30",
  acknowledged: "border-amber-300 text-amber-700 bg-amber-50 dark:bg-amber-950/30",
  resolved: "border-emerald-300 text-emerald-700 bg-emerald-50 dark:bg-emerald-950/30",
};

const PAST_TENSE: Record<LifecycleAction, string> = {
  acknowledge: "acknowledged",
  resolve: "resolved",
  reopen: "reopened",
};

function validateQ(raw: string): { frozen: boolean; value: string } {
  const trimmed = raw.trim();
  if (trimmed === "") return { frozen: false, value: "" };
  if (trimmed.length > MAX_Q_LEN || !Q_ALLOWED.test(trimmed)) return { frozen: true, value: "" };
  return { frozen: false, value: trimmed };
}

function validateCheckCode(raw: string): { invalid: boolean; value: string } {
  const trimmed = raw.trim();
  if (trimmed === "") return { invalid: false, value: "" };
  if (!CHECK_CODE_ALLOWED.test(trimmed)) return { invalid: true, value: "" };
  return { invalid: false, value: trimmed };
}

export function ReconciliationPage() {
  const [filters, setFilters] = useState<ReconciliationFilterValues>(EMPTY_FILTERS);
  const [debouncedQ, setDebouncedQ] = useState("");
  const [offset, setOffset] = useState(0);
  const [dialog, setDialog] = useState<{ finding: ReconciliationFinding; action: LifecycleAction } | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [runPending, setRunPending] = useState(false);
  const [cooldownUntil, setCooldownUntil] = useState(0);
  const [nowTick, setNowTick] = useState(() => Date.now());

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(filters.q), 300);
    return () => clearTimeout(t);
  }, [filters.q]);

  useEffect(() => {
    if (cooldownUntil <= Date.now()) return;
    const t = setInterval(() => {
      setNowTick(Date.now());
      if (Date.now() >= cooldownUntil) clearInterval(t);
    }, 1000);
    return () => clearInterval(t);
  }, [cooldownUntil]);

  const cooldownRemaining = Math.max(0, Math.ceil((cooldownUntil - nowTick) / 1000));

  const qCheck = validateQ(filters.q);
  const debouncedQCheck = validateQ(debouncedQ);
  const codeCheck = validateCheckCode(filters.checkCode);
  // Invalid q freezes the request entirely (no silent partial results); the
  // inline hint in the filter bar explains why the list stopped updating.
  const qFrozen = qCheck.frozen || debouncedQCheck.frozen;

  const qp = new URLSearchParams();
  if (filters.status) qp.set("status", filters.status);
  if (filters.severity) qp.set("severity", filters.severity);
  if (filters.subjectType) qp.set("subject_type", filters.subjectType);
  if (codeCheck.value) qp.set("check_code", codeCheck.value);
  if (debouncedQCheck.value) qp.set("q", debouncedQCheck.value);
  qp.set("limit", String(PAGE_SIZE));
  if (offset > 0) qp.set("offset", String(offset));
  const findingsUrl = qFrozen ? null : `/api/admin/reconciliation/findings?${qp.toString()}`;

  const {
    data: findings,
    loading: findingsLoading,
    error: findingsError,
    refetch: refetchFindings,
  } = useFetch<ReconciliationFindingsResponse>(findingsUrl);
  const {
    data: runs,
    loading: runsLoading,
    refetch: refetchRuns,
  } = useFetch<ReconciliationRunsResponse>(RUNS_URL);

  const latestRun = runs?.items?.[0] ?? null;
  const items = findings?.items ?? [];
  const counts = findings?.counts ?? null;
  const total = findings?.total ?? null;

  const refetchAll = () => {
    refetchFindings();
    refetchRuns();
  };

  const changeFilters = (patch: Partial<ReconciliationFilterValues>) => {
    setFilters((f) => ({ ...f, ...patch }));
    setOffset(0);
  };

  const resetFilters = () => {
    setFilters(EMPTY_FILTERS);
    setOffset(0);
  };

  const hasFilters =
    filters.q !== "" ||
    filters.status !== "" ||
    filters.severity !== "" ||
    filters.subjectType !== "" ||
    filters.checkCode !== "";

  const submitAction = async (rawNote: string) => {
    if (!dialog) return;
    const { finding, action } = dialog;
    const note = rawNote.trim();
    setPendingId(finding.id);
    const res = await reconPost<ReconciliationFinding>(
      transitionUrl(finding.id, action),
      note ? { note } : {}
    );
    setPendingId(null);

    if (res.ok) {
      toast.success(`Finding ${PAST_TENSE[action]}`);
      setDialog(null);
      refetchFindings();
      return;
    }

    const { status, body } = res;
    if (status === 409 && body.error === "finding_state_conflict") {
      toast.warning(`Finding is already ${body.currentStatus ?? "updated"}`, {
        description: "The list has been refreshed.",
      });
      setDialog(null);
      refetchFindings();
    } else if (status === 404 || body.error === "finding_not_found") {
      toast.error("Finding not found", { description: "It may have been cleared by a newer run." });
      setDialog(null);
      refetchFindings();
    } else if (status === 400) {
      toast.error(body.error === "invalid_note" ? "Invalid note" : "Invalid request", {
        description: String(body.error ?? ""),
      });
    } else if (status === 401 || status === 403) {
      toast.error("Insufficient permissions for this action");
      setDialog(null);
    } else {
      toast.error("Action failed", { description: String(body.error ?? `HTTP ${status}`) });
    }
  };

  const handleRunNow = async () => {
    setRunPending(true);
    const res = await reconPost<ReconciliationManualRunResponse>(MANUAL_RUN_URL);
    setRunPending(false);

    if (res.ok) {
      const body = res.body;
      const checks = Object.keys(body.checkResults ?? {}).length;
      const parts = [
        `${checks} checks`,
        `${body.findingsNew} new`,
        `${body.findingsResolved} resolved`,
        `${body.findingsOpen} open`,
      ];
      if (body.failedChecks?.length) parts.push(`${body.failedChecks.length} failed`);
      const recipients = body.alerts?.recipients;
      if (typeof recipients === "number" && recipients > 0) parts.push(`alerts to ${recipients}`);
      const description = parts.join(" · ");
      if (body.status === "failed") {
        toast.error("Reconciliation run failed", {
          description: body.error ? `${description} · ${body.error}` : description,
        });
      } else {
        toast.success("Reconciliation run complete", { description });
      }
      refetchAll();
      return;
    }

    const { status, body } = res;
    if (status === 409 && body.error === "reconciliation_already_running") {
      toast.warning("A reconciliation run is already in progress", {
        description: "The run history has been refreshed.",
      });
      refetchRuns();
    } else if (status === 429 && body.error === "reconciliation_rate_limited") {
      // Countdown comes from the API's retryAfterSeconds — never a client-side guess.
      const secs = Number(body.retryAfterSeconds);
      const safeSecs = Number.isFinite(secs) && secs > 0 ? Math.ceil(secs) : 0;
      if (safeSecs > 0) {
        const now = Date.now();
        setNowTick(now);
        setCooldownUntil(now + safeSecs * 1000);
      }
      toast.warning(
        safeSecs > 0
          ? `Manual runs are rate limited — retry in ${safeSecs}s`
          : "Manual runs are rate limited"
      );
      refetchRuns();
    } else if (status === 401 || status === 403) {
      toast.error("Insufficient permissions to trigger a run");
    } else {
      toast.error("Reconciliation run failed", { description: String(body.error ?? `HTTP ${status}`) });
      refetchAll();
    }
  };

  const statValue = (n: number | null | undefined): string =>
    n === null || n === undefined ? "—" : String(n);

  const hasNext =
    total !== null ? offset + items.length < total : items.length === PAGE_SIZE;

  const showSkeleton = findingsLoading && !findings;

  return (
    <div className="space-y-4">
      <ReconciliationRunStrip
        latestRun={latestRun}
        runsLoading={runsLoading}
        runPending={runPending}
        cooldownRemaining={cooldownRemaining}
        onRefresh={refetchRuns}
        onRunNow={handleRunNow}
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Total" value={statValue(total)} icon={Layers} accent="from-slate-500 to-slate-600" />
        <StatCard label="Open" value={statValue(counts?.byStatus.open)} icon={Inbox} accent="from-sky-500 to-blue-600" />
        <StatCard label="Acknowledged" value={statValue(counts?.byStatus.acknowledged)} icon={Eye} accent="from-teal-500 to-cyan-600" />
        <StatCard label="Resolved" value={statValue(counts?.byStatus.resolved)} icon={CheckCircle2} accent="from-emerald-500 to-green-600" />
        <StatCard label="Critical" value={statValue(counts?.bySeverity.critical)} icon={ShieldAlert} accent="from-rose-500 to-pink-600" />
        <StatCard label="Warning" value={statValue(counts?.bySeverity.warning)} icon={AlertTriangle} accent="from-yellow-500 to-amber-600" />
        <StatCard label="Info" value={statValue(counts?.bySeverity.info)} icon={Info} accent="from-indigo-500 to-violet-600" />
      </div>

      {findings && counts === null && (
        <Alert className="border-amber-300 bg-amber-50 dark:bg-amber-950/30">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <AlertTitle>Counts unavailable</AlertTitle>
          <AlertDescription>
            Exact counts could not be loaded (counts RPC unavailable). The findings list below is still
            current and lifecycle actions remain available.
          </AlertDescription>
        </Alert>
      )}

      <ReconciliationFilters
        value={filters}
        onChange={changeFilters}
        onReset={resetFilters}
        onRefresh={refetchAll}
        qInvalid={qCheck.frozen}
        checkCodeInvalid={codeCheck.invalid}
      />

      <Card className="shadow-soft overflow-hidden">
        {findingsError && (
          <div className="p-4 space-y-3">
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Failed to load findings</AlertTitle>
              <AlertDescription>{findingsError}</AlertDescription>
            </Alert>
            <Button variant="outline" size="sm" onClick={refetchFindings}>
              Retry
            </Button>
          </div>
        )}

        {!findingsError && showSkeleton && (
          <div className="p-4 space-y-3" data-testid="findings-loading">
            {[0, 1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        )}

        {!findingsError && !showSkeleton && (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left p-3 font-medium text-xs text-muted-foreground">Severity</th>
                    <th className="text-left p-3 font-medium text-xs text-muted-foreground">Finding</th>
                    <th className="text-center p-3 font-medium text-xs text-muted-foreground">Status</th>
                    <th className="text-right p-3 font-medium text-xs text-muted-foreground">Occurrences</th>
                    <th className="text-left p-3 font-medium text-xs text-muted-foreground">Last Detected</th>
                    <th className="text-left p-3 font-medium text-xs text-muted-foreground hidden md:table-cell">
                      First Detected
                    </th>
                    <th className="text-left p-3 font-medium text-xs text-muted-foreground hidden lg:table-cell">
                      Attribution
                    </th>
                    <th className="text-right p-3 font-medium text-xs text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {!findingsLoading && items.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-8 text-center text-muted-foreground text-sm">
                        No findings match the current filters.
                        {hasFilters && (
                          <div className="mt-3">
                            <Button variant="outline" size="sm" onClick={resetFilters}>
                              Clear filters
                            </Button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ) : (
                    items.map((f) => {
                      const pending = pendingId === f.id;
                      const resolvedPrimary = f.resolvedAt
                        ? `res ${f.resolvedBy?.slice(0, 8) || "—"} · ${timeAgo(new Date(f.resolvedAt))}`
                        : null;
                      const ackPrimary = f.acknowledgedAt
                        ? `ack ${f.acknowledgedBy?.slice(0, 8) || "—"} · ${timeAgo(new Date(f.acknowledgedAt))}`
                        : null;
                      const attribution = resolvedPrimary ?? ackPrimary;
                      return (
                        <tr
                          key={f.id}
                          className="border-b last:border-0 hover:bg-muted/30 transition-colors"
                          data-testid="finding-row"
                        >
                          <td className="p-3">
                            <Badge
                              variant="outline"
                              className={cn("text-[10px] capitalize", SEVERITY_BADGE[f.severity])}
                            >
                              {f.severity}
                            </Badge>
                          </td>
                          <td className="p-3 max-w-[340px]">
                            <p className="text-xs font-medium leading-snug">{f.summary}</p>
                            <p className="text-[10px] text-muted-foreground font-mono mt-0.5 truncate">
                              {f.checkCode} · {f.subjectType}:{f.subjectId}
                            </p>
                          </td>
                          <td className="p-3 text-center">
                            <Badge variant="outline" className={cn("text-[10px] capitalize", STATUS_BADGE[f.status])}>
                              {f.status}
                            </Badge>
                          </td>
                          <td className="p-3 text-right text-xs tabular-nums">{f.occurrenceCount}</td>
                          <td className="p-3 text-xs text-muted-foreground" title={formatDateTime(f.lastDetectedAt)}>
                            {timeAgo(new Date(f.lastDetectedAt))}
                          </td>
                          <td
                            className="p-3 text-xs text-muted-foreground hidden md:table-cell"
                            title={formatDateTime(f.firstDetectedAt)}
                          >
                            {timeAgo(new Date(f.firstDetectedAt))}
                          </td>
                          <td className="p-3 hidden lg:table-cell max-w-[180px]">
                            {attribution ? (
                              <div className="space-y-0.5" title={f.resolutionNote ?? undefined}>
                                <p className="text-[11px] text-muted-foreground truncate">{attribution}</p>
                                {resolvedPrimary && ackPrimary && (
                                  <p className="text-[10px] text-muted-foreground/70 truncate">{ackPrimary}</p>
                                )}
                              </div>
                            ) : (
                              <span className="text-[11px] text-muted-foreground">—</span>
                            )}
                          </td>
                          <td className="p-3 text-right">
                            <div className="flex justify-end">
                              <FindingActionsMenu
                                finding={f}
                                pending={pending}
                                onAction={(finding, action) => setDialog({ finding, action })}
                              />
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {items.length > 0 && (
              <div className="flex items-center justify-between gap-3 p-3 border-t">
                <span className="text-xs text-muted-foreground">
                  Showing {offset + 1}–{offset + items.length}
                  {total !== null ? ` of ${total}` : ""}
                </span>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={offset === 0 || findingsLoading}
                    onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
                  >
                    <ChevronLeft className="h-4 w-4 mr-1" />
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={!hasNext || findingsLoading}
                    onClick={() => setOffset(offset + items.length)}
                  >
                    Next
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </Card>

      {dialog && (
        <LifecycleDialog
          finding={dialog.finding}
          action={dialog.action}
          pending={pendingId === dialog.finding.id}
          onCancel={() => setDialog(null)}
          onSubmit={submitAction}
        />
      )}
    </div>
  );
}

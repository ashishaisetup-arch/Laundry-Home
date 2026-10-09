import { useState } from "react";
import { RefreshCw, PlayCircle, Loader2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn, timeAgo, formatDateTime } from "@/lib/utils";
import type { ReconciliationRun } from "@/lib/types";

function statusBadgeClass(status: string) {
  if (status === "success") return "border-emerald-300 text-emerald-700 bg-emerald-50 dark:bg-emerald-950/30";
  if (status === "failed") return "border-rose-300 text-rose-700 bg-rose-50 dark:bg-rose-950/30";
  return "border-amber-300 text-amber-700 bg-amber-50 dark:bg-amber-950/30";
}

function durationMs(run: ReconciliationRun): number | null {
  if (!run.finishedAt) return null;
  const ms = new Date(run.finishedAt).getTime() - new Date(run.startedAt).getTime();
  return Number.isFinite(ms) && ms >= 0 ? ms : null;
}

interface ReconciliationRunStripProps {
  latestRun: ReconciliationRun | null;
  runsLoading: boolean;
  runPending: boolean;
  cooldownRemaining: number;
  onRefresh: () => void;
  onRunNow: () => void;
}

export function ReconciliationRunStrip({
  latestRun,
  runsLoading,
  runPending,
  cooldownRemaining,
  onRefresh,
  onRunNow,
}: ReconciliationRunStripProps) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const running = latestRun?.status === "running";
  const disabled = runPending || running || cooldownRemaining > 0;

  const handleConfirm = () => {
    setConfirmOpen(false);
    onRunNow();
  };

  const dur = latestRun ? durationMs(latestRun) : null;

  return (
    <Card className="shadow-soft p-4">
      <div className="flex flex-col lg:flex-row lg:items-center gap-3">
        <div className="flex-1 min-w-0 space-y-1.5">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-[0.08em]">
              Last reconciliation run
            </span>
            {latestRun ? (
              <>
                <Badge variant="outline" className={cn("text-[10px] capitalize", statusBadgeClass(latestRun.status))}>
                  {latestRun.status === "running" && (
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse mr-1" />
                  )}
                  {latestRun.status}
                </Badge>
                <Badge variant="outline" className="text-[10px] capitalize">
                  {latestRun.trigger}
                </Badge>
                <span
                  className="text-[11px] text-muted-foreground"
                  title={formatDateTime(latestRun.startedAt)}
                >
                  {timeAgo(new Date(latestRun.startedAt))}
                  {dur !== null && ` · ${(dur / 1000).toFixed(1)}s`}
                </span>
              </>
            ) : (
              <span className="text-xs text-muted-foreground">No runs recorded yet</span>
            )}
          </div>

          {latestRun && (
            <div className="flex items-center gap-3 flex-wrap text-[11px] text-muted-foreground">
              <span>
                open <span className="font-semibold text-foreground">{latestRun.findingsOpen}</span>
              </span>
              <span>
                new <span className="font-semibold text-foreground">{latestRun.findingsNew}</span>
              </span>
              <span>
                resolved <span className="font-semibold text-foreground">{latestRun.findingsResolved}</span>
              </span>
              {latestRun.failedChecks.length > 0 && (
                <span className="text-rose-600" title={`Failed: ${latestRun.failedChecks.join(", ")}`}>
                  {latestRun.failedChecks.length} failed
                </span>
              )}
              {latestRun.truncatedChecks.length > 0 && (
                <span className="text-amber-600" title={`Truncated: ${latestRun.truncatedChecks.join(", ")}`}>
                  {latestRun.truncatedChecks.length} truncated
                </span>
              )}
              {latestRun.error && (
                <span className="text-rose-600 flex items-center gap-1 max-w-[320px] truncate" title={latestRun.error}>
                  <AlertTriangle className="h-3 w-3 shrink-0" />
                  {latestRun.error}
                </span>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button variant="outline" size="sm" onClick={onRefresh} disabled={runsLoading || runPending}>
            <RefreshCw className={cn("h-4 w-4 mr-1.5", runsLoading && "animate-spin")} />
            Refresh
          </Button>
          <Button size="sm" onClick={() => setConfirmOpen(true)} disabled={disabled}>
            {runPending ? (
              <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
            ) : (
              <PlayCircle className="h-4 w-4 mr-1.5" />
            )}
            {runPending
              ? "Running…"
              : cooldownRemaining > 0
                ? `Wait ${cooldownRemaining}s`
                : running
                  ? "Run in progress"
                  : "Run Now"}
          </Button>
        </div>
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Run reconciliation now?</AlertDialogTitle>
            <AlertDialogDescription>
              Triggers a guarded manual reconciliation run with alert dispatch and writes a manual-run
              audit entry. A 60-second cooldown applies after each manual run. Findings browsing stays
              available while the run executes.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirm}>Run now</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

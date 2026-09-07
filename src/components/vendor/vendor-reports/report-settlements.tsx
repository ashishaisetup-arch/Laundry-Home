import {
  IndianRupee,
  Clock,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Download,
  FileDown,
} from "lucide-react";
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StatCard } from "@/components/shared/stat-card";
import { StatCardSkeleton } from "@/components/shared/skeleton-card";
import { ErrorState } from "@/components/shared/error-state";
import { EmptyState } from "@/components/shared/empty-state";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  useReportSettlements,
  type ReportParams,
} from "@/lib/hooks/useVendorReports";
import { formatINR } from "@/lib/utils";

const STATUS_COLORS: Record<string, string> = {
  pending:
    "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400",
  processing:
    "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400",
  settled:
    "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400",
  failed:
    "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-400",
};

interface Props {
  params: ReportParams;
  onExportCSV: (
    data: Record<string, unknown>[],
    reportType: string,
  ) => void;
  onExportPDF: (
    title: string,
    data: Record<string, unknown>[],
    columns: { header: string; dataKey: string }[],
  ) => void;
}

export function ReportSettlements({
  params,
  onExportCSV,
  onExportPDF,
}: Props) {
  const { data, loading, error, refetch } = useReportSettlements(params);
  const [expanded, setExpanded] = useState<string | null>(null);

  // ── Loading ──
  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <StatCardSkeleton key={i} />
          ))}
        </div>
        <Card className="h-64 animate-pulse" />
      </div>
    );
  }

  // ── Error ──
  if (error) {
    return (
      <ErrorState
        title="Failed to load settlements"
        message={error}
        onRetry={refetch}
      />
    );
  }

  // ── Empty ──
  if (!data || (data.settlements ?? []).length === 0) {
    return (
      <EmptyState
        icon={IndianRupee}
        title="No settlements recorded"
        description="Settlement records will appear here once payouts are processed."
      />
    );
  }

  const commissionRate = data.commissionRateBps / 100;

  // ── Export ──
  const exportData = (data.settlements ?? []).map((s) => ({
    Period: `${s.period_start.slice(0, 10)} — ${s.period_end.slice(0, 10)}`,
    Gross: formatINR(s.gross_order_value),
    Commission: formatINR(s.commission_amount),
    Refunds: formatINR(s.refunds_amount),
    Adjustments: formatINR(s.adjustments_amount),
    "Net Payout": formatINR(s.net_payout),
    Status: s.status,
  }));
  const exportColumns = [
    { header: "Period", dataKey: "Period" },
    { header: "Gross", dataKey: "Gross" },
    { header: "Commission", dataKey: "Commission" },
    { header: "Refunds", dataKey: "Refunds" },
    { header: "Adjustments", dataKey: "Adjustments" },
    { header: "Net Payout", dataKey: "Net Payout" },
    { header: "Status", dataKey: "Status" },
  ];

  // ── KPI cards ──
  const kpiStats = [
    {
      label: "Pending Payout",
      value: formatINR(data.pendingPayout),
      icon: Clock,
      accent: "from-amber-500 to-orange-600",
    },
    {
      label: "Settled Total",
      value: formatINR(data.settledTotal),
      icon: CheckCircle2,
      accent: "from-emerald-500 to-teal-600",
    },
    {
      label: "Total Gross",
      value: formatINR(data.totalGross),
      icon: IndianRupee,
      accent: "from-teal-500 to-emerald-600",
    },
    {
      label: "Total Commission",
      value: formatINR(data.totalCommission),
      icon: IndianRupee,
      accent: "from-violet-500 to-purple-600",
    },
    {
      label: "Total Refunds",
      value: formatINR(data.totalRefunds),
      icon: IndianRupee,
      accent: "from-rose-500 to-red-600",
    },
    {
      label: "Total Adjustments",
      value: formatINR(data.totalAdjustments),
      icon: IndianRupee,
      accent: "from-sky-500 to-blue-600",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Export buttons */}
      <div className="flex justify-end gap-2">
        <Button
          variant="outline"
          size="sm"
          className="text-xs h-8"
          onClick={() => onExportCSV(exportData, "settlements")}
        >
          <Download className="h-3.5 w-3.5 mr-1" /> CSV
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="text-xs h-8"
          onClick={() =>
            onExportPDF("Settlement History", exportData, exportColumns)
          }
        >
          <FileDown className="h-3.5 w-3.5 mr-1" /> PDF
        </Button>
      </div>

      {/* KPI cards */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {kpiStats.map((s) => (
          <StatCard key={s.label} {...s} />
        ))}
      </div>

      {/* Settlement History */}
      <Card className="p-6 shadow-soft">
        <h3 className="text-sm font-semibold mb-4">
          Settlement History
        </h3>
        <div className="space-y-2">
          {(data.settlements ?? []).map((s) => {
            const isExpanded = expanded === s.id;
            return (
              <div
                key={s.id}
                className="border rounded-lg overflow-hidden"
              >
                {/* Header row */}
                <button
                  className="w-full flex items-center justify-between p-4 hover:bg-tonal transition-colors text-left"
                  onClick={() =>
                    setExpanded(isExpanded ? null : s.id)
                  }
                >
                  <div className="flex items-center gap-4">
                    {isExpanded ? (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    )}
                    <div>
                      <p className="text-sm font-medium">
                        {new Date(s.period_start).toLocaleDateString(
                          "en-IN",
                          { month: "short", year: "numeric" },
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {s.period_start.slice(0, 10)} —{" "}
                        {s.period_end.slice(0, 10)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <Badge
                      className={STATUS_COLORS[s.status] || ""}
                    >
                      {s.status}
                    </Badge>
                    <div className="text-right">
                      <p className="text-sm font-semibold">
                        {formatINR(s.net_payout)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        of {formatINR(s.gross_order_value)}
                      </p>
                    </div>
                  </div>
                </button>

                {/* Expanded content */}
                {isExpanded && (
                  <div className="border-t bg-muted/30 p-4 space-y-4">
                    {/* Settlement metadata */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <span className="text-muted-foreground">
                          Payout Reference:
                        </span>{" "}
                        <span className="font-medium">
                          {s.payout_reference || "—"}
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">
                          Settled:
                        </span>{" "}
                        <span className="font-medium">
                          {s.settled_at
                            ? new Date(
                                s.settled_at,
                              ).toLocaleDateString("en-IN")
                            : "—"}
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">
                          Commission Rate:
                        </span>{" "}
                        <span className="font-medium">
                          {commissionRate}%
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">
                          Items:
                        </span>{" "}
                        <span className="font-medium">
                          {(s.items ?? []).length}
                        </span>
                      </div>
                    </div>

                    {/* Reconciliation summary */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <span className="text-muted-foreground">
                          Gross:
                        </span>{" "}
                        <span className="font-medium">
                          {formatINR(s.gross_order_value)}
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">
                          Commission:
                        </span>{" "}
                        <span className="font-medium text-rose-600">
                          -{formatINR(s.commission_amount)}
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">
                          Refunds:
                        </span>{" "}
                        <span className="font-medium">
                          {formatINR(s.refunds_amount)}
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">
                          Adjustments:
                        </span>{" "}
                        <span className="font-medium">
                          {formatINR(s.adjustments_amount)}
                        </span>
                      </div>
                    </div>

                    <div className="border-t pt-3">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-semibold">
                          Net Payout
                        </span>
                        <span className="font-semibold text-emerald-600">
                          {formatINR(s.net_payout)}
                        </span>
                      </div>
                    </div>

                    {/* Order-level items */}
                    {(s.items ?? []).length > 0 && (
                      <div className="border-t pt-3">
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                          Order-Level Reconciliation
                        </p>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Order</TableHead>
                              <TableHead className="text-right">
                                Gross
                              </TableHead>
                              <TableHead className="text-right">
                                Commission
                              </TableHead>
                              <TableHead className="text-right">
                                Refund
                              </TableHead>
                              <TableHead className="text-right">
                                Adjustment
                              </TableHead>
                              <TableHead className="text-right">
                                Net
                              </TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {(s.items ?? []).map((item) => (
                              <TableRow key={item.id}>
                                <TableCell className="font-medium">
                                  {item.order_id.slice(0, 8)}
                                </TableCell>
                                <TableCell className="text-right">
                                  {formatINR(item.gross_amount)}
                                </TableCell>
                                <TableCell className="text-right text-rose-600">
                                  -{formatINR(item.commission_amount)}
                                </TableCell>
                                <TableCell className="text-right">
                                  {formatINR(item.refund_amount)}
                                </TableCell>
                                <TableCell className="text-right">
                                  {formatINR(item.adjustment_amount)}
                                </TableCell>
                                <TableCell className="text-right font-medium">
                                  {formatINR(item.net_amount)}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}

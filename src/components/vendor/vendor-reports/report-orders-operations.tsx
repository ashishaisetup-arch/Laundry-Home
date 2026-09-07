import { Clock, Zap, Package, AlertTriangle, Download, FileDown, Inbox } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StatCard } from "@/components/shared/stat-card";
import { StatCardSkeleton } from "@/components/shared/skeleton-card";
import { ErrorState } from "@/components/shared/error-state";
import { EmptyState } from "@/components/shared/empty-state";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useReportOrdersOperations, type ReportParams } from "@/lib/hooks/useVendorReports";
import { formatINR } from "@/lib/utils";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LabelList } from "recharts";

interface Props {
  params: ReportParams;
  onDrillDown: (filters: { status?: string; delayed?: boolean; startDate?: string; endDate?: string; service?: string; orderStatus?: string }) => void;
  onExportCSV: (data: Record<string, unknown>[], reportType: string) => void;
  onExportPDF: (title: string, data: Record<string, unknown>[], columns: { header: string; dataKey: string }[]) => void;
}

export function ReportOrdersOperations({ params, onDrillDown, onExportCSV, onExportPDF }: Props) {
  const { data, loading, error, refetch } = useReportOrdersOperations(params);

  if (loading) return (
    <div className="space-y-6">
      <div className="grid md:grid-cols-3 lg:grid-cols-6 gap-4">
        {Array.from({ length: 6 }).map((_, i) => <StatCardSkeleton key={i} />)}
      </div>
      <div className="grid md:grid-cols-2 gap-4">
        {Array.from({ length: 2 }).map((_, i) => <Card key={i} className="h-64 animate-pulse" />)}
      </div>
    </div>
  );
  if (error) return <ErrorState title="Failed to load orders" message={error} onRetry={refetch} />;
  if (!data) return <EmptyState icon={Inbox} title="No order data" description="No orders found for the selected period and filters." />;

  const statusColumns = [
    { header: "Status", dataKey: "status" },
    { header: "Count", dataKey: "count" },
  ];

  const delayedColumns = [
    { header: "Order", dataKey: "code" },
    { header: "Customer", dataKey: "customerName" },
    { header: "Amount", dataKey: "total" },
    { header: "Placed", dataKey: "createdAt" },
  ];

  return (
    <div className="space-y-6">
      {/* Export buttons */}
      <div className="flex justify-end gap-2">
        <Button variant="outline" size="sm" className="text-xs h-8" onClick={() => onExportCSV((data.statusDistribution ?? []).map(s => ({ Status: s.status, Count: s.count })), "orders-by-status")}>
          <Download className="h-3.5 w-3.5 mr-1" /> CSV (Status)
        </Button>
        <Button variant="outline" size="sm" className="text-xs h-8" onClick={() => onExportPDF("Orders by Status", (data.statusDistribution ?? []).map(s => ({ Status: s.status, Count: String(s.count) })), statusColumns)}>
          <FileDown className="h-3.5 w-3.5 mr-1" /> PDF
        </Button>
      </div>

      {/* 6 KPI Cards */}
      <div className="grid md:grid-cols-3 lg:grid-cols-6 gap-4">
        <StatCard label="Total Orders" value={String(data.totalOrders)} icon={Package} accent="from-teal-500 to-emerald-600" />
        <StatCard label="Completed" value={String(data.completedOrders)} icon={Package} accent="from-emerald-500 to-teal-600" />
        <StatCard
          label="Avg Turnaround"
          value={data.avgTurnaroundHrs == null ? "\u2014" : `${data.avgTurnaroundHrs}h`}
          icon={Clock}
          accent="from-sky-500 to-blue-600"
          invertTrend
        />
        <StatCard
          label="On-Time Rate"
          value={data.onTimeRate == null ? "\u2014" : `${data.onTimeRate}%`}
          icon={Package}
          accent="from-emerald-500 to-teal-600"
          invertTrend
        />
        <StatCard
          label="Delayed"
          value={String(data.delayedCount)}
          icon={AlertTriangle}
          accent="from-rose-500 to-red-600"
          className={data.delayedCount > 0 ? "ring-2 ring-rose-200 dark:ring-rose-800" : undefined}
        />
        <StatCard label="Express" value={String(data.expressOrders)} icon={Zap} accent="from-amber-500 to-orange-600" />
      </div>

      {/* Operational Funnel */}
      <Card className="p-6 shadow-soft">
        <h3 className="text-sm font-semibold mb-4">Operational Funnel</h3>
        <div className="space-y-3">
          {(data.funnelStages ?? []).map((s, i) => {
            const maxCount = (data.funnelStages ?? [])[0]?.count || 1;
            const widthPct = Math.round((s.count / maxCount) * 100);
            return (
              <div key={s.stage} className="flex items-center gap-3">
                <span className="text-xs text-muted-foreground w-24 shrink-0 text-right">{s.stage}</span>
                <div className="flex-1 h-7 bg-muted/50 rounded-md overflow-hidden relative">
                  <div
                    className="h-full bg-gradient-to-r from-teal-500 to-emerald-500 rounded-md transition-all duration-500"
                    style={{ width: `${widthPct}%` }}
                  />
                  <span className="absolute inset-y-0 left-2 flex items-center text-[11px] font-medium text-foreground">
                    {s.count}
                  </span>
                </div>
                <span className="text-[11px] text-muted-foreground w-16 text-right">
                  {s.conversionRate != null ? `${s.conversionRate}%` : "\u2014"}
                </span>
              </div>
            );
          })}
        </div>
      </Card>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Orders by Day */}
        <Card className="p-6 shadow-soft">
          <h3 className="text-sm font-semibold mb-4">Orders by Day</h3>
          {(data.ordersByDay ?? []).length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={data.ordersByDay}>
                <XAxis dataKey="day" tick={{ fontSize: 9 }} angle={-45} textAnchor="end" height={80} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip />
                <Bar dataKey="count" fill="var(--chart-1)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyState icon={Inbox} title="No order data" description="No orders found for this period." />
          )}
        </Card>

        {/* Turnaround Histogram */}
        <Card className="p-6 shadow-soft">
          <h3 className="text-sm font-semibold mb-4">Turnaround Distribution</h3>
          {(data.turnaroundHistogram ?? []).length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={data.turnaroundHistogram}>
                <XAxis dataKey="bucket" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip />
                <Bar dataKey="count" fill="var(--chart-3)" radius={[4, 4, 0, 0]}>
                  <LabelList dataKey="count" position="top" className="text-[10px]" />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyState icon={Clock} title="Turnaround data unavailable" description="No completed orders with valid event data for this period." />
          )}
        </Card>
      </div>

      {/* Express vs Regular */}
      <Card className="p-6 shadow-soft">
        <h3 className="text-sm font-semibold mb-4">Express vs Regular</h3>
        <div className="grid md:grid-cols-2 gap-4">
          <div className="flex items-center justify-between p-4 rounded-lg bg-amber-50 dark:bg-amber-950/30">
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-amber-600" />
              <span className="text-sm font-medium">Express</span>
            </div>
            <div className="text-right">
              <p className="text-sm font-semibold">{data.expressVsRegular.express.count} orders</p>
              <p className="text-xs text-muted-foreground">{formatINR(data.expressVsRegular.express.revenue)}</p>
            </div>
          </div>
          <div className="flex items-center justify-between p-4 rounded-lg bg-slate-50 dark:bg-slate-900/30">
            <div className="flex items-center gap-2">
              <Package className="h-4 w-4 text-slate-600" />
              <span className="text-sm font-medium">Regular</span>
            </div>
            <div className="text-right">
              <p className="text-sm font-semibold">{data.expressVsRegular.regular.count} orders</p>
              <p className="text-xs text-muted-foreground">{formatINR(data.expressVsRegular.regular.revenue)}</p>
            </div>
          </div>
        </div>
      </Card>

      {/* Attention Categories */}
      <div className="grid md:grid-cols-4 gap-4">
        <Card className="p-4 shadow-soft">
          <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-[0.08em] mb-1">Pending Pickup</p>
          <p className="text-2xl font-semibold">{data.attentionCategories.pendingPickup}</p>
        </Card>
        <Card className="p-4 shadow-soft">
          <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-[0.08em] mb-1">Delayed In-Progress</p>
          <p className="text-2xl font-semibold text-rose-600">{data.attentionCategories.delayedInProgress}</p>
        </Card>
        <Card className="p-4 shadow-soft">
          <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-[0.08em] mb-1">Quality Issues</p>
          <p className="text-2xl font-semibold">{data.attentionCategories.qualityIssues}</p>
        </Card>
        <Card className="p-4 shadow-soft">
          <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-[0.08em] mb-1">Failed / Cancelled</p>
          <p className="text-2xl font-semibold">{data.attentionCategories.failedCancelled}</p>
        </Card>
      </div>

      {/* Delayed Orders */}
      {data.delayedCount > 0 && (
        <Card className="p-6 shadow-soft">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold">Delayed Orders ({data.delayedCount})</h3>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onDrillDown({
                status: "processing",
                delayed: true,
                startDate: data.delayedDrillDown.startDate,
                endDate: data.delayedDrillDown.endDate,
                service: data.delayedDrillDown.service,
                orderStatus: data.delayedDrillDown.orderStatus,
              })}
            >
              View All
            </Button>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Order</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Placed</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(data.topDelayedOrders ?? []).map((o) => (
                <TableRow key={o.id}>
                  <TableCell className="font-medium">{o.code}</TableCell>
                  <TableCell>{o.customerName}</TableCell>
                  <TableCell className="text-right">{formatINR(o.total)}</TableCell>
                  <TableCell className="text-muted-foreground text-xs">{new Date(o.createdAt).toLocaleDateString("en-IN")}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}

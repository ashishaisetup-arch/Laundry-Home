import { XCircle, IndianRupee, AlertTriangle, Download, FileDown, Inbox } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatCard } from "@/components/shared/stat-card";
import { StatCardSkeleton } from "@/components/shared/skeleton-card";
import { ErrorState } from "@/components/shared/error-state";
import { EmptyState } from "@/components/shared/empty-state";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useReportCancellations, type ReportParams } from "@/lib/hooks/useVendorReports";
import { formatINR } from "@/lib/utils";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line } from "recharts";

interface Props {
  params: ReportParams;
  onDrillDown: (filters: { status?: string }) => void;
  onExportCSV: (data: Record<string, unknown>[], reportType: string) => void;
  onExportPDF: (title: string, data: Record<string, unknown>[], columns: { header: string; dataKey: string }[]) => void;
}

export function ReportCancellations({ params, onDrillDown, onExportCSV, onExportPDF }: Props) {
  const { data, loading, error, refetch } = useReportCancellations(params);

  if (loading) return (
    <div className="space-y-6">
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => <StatCardSkeleton key={i} />)}
      </div>
      <div className="grid md:grid-cols-2 gap-4">
        {Array.from({ length: 2 }).map((_, i) => <Card key={i} className="h-64 animate-pulse" />)}
      </div>
    </div>
  );
  if (error) return <ErrorState title="Failed to load cancellations" message={error} onRetry={refetch} />;
  if (!data) return <EmptyState icon={Inbox} title="No cancellation data" description="No cancellations found for the selected period and filters." />;

  const cancelledColumns = [
    { header: "Order", dataKey: "code" },
    { header: "Customer", dataKey: "customerName" },
    { header: "Amount", dataKey: "total" },
    { header: "Reason", dataKey: "notes" },
    { header: "Date", dataKey: "createdAt" },
  ];

  const exportCancelledData = data.topCancelledOrders.map((o) => ({
    code: o.code,
    customerName: o.customerName,
    total: o.total,
    notes: o.notes || "—",
    createdAt: new Date(o.createdAt).toLocaleDateString("en-IN"),
  }));

  return (
    <div className="space-y-6">
      <div className="flex justify-end gap-2">
        <Button variant="outline" size="sm" className="text-xs h-8" onClick={() => onExportCSV(exportCancelledData, "cancelled-orders")}>
          <Download className="h-3.5 w-3.5 mr-1" /> CSV
        </Button>
        <Button variant="outline" size="sm" className="text-xs h-8" onClick={() => onExportPDF("Cancelled Orders", exportCancelledData, cancelledColumns)}>
          <FileDown className="h-3.5 w-3.5 mr-1" /> PDF
        </Button>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard
          label="Cancelled Orders"
          value={String(data.cancelledOrders)}
          icon={XCircle}
          accent="from-rose-500 to-red-600"
          className={data.cancelledOrders > 0 ? "ring-2 ring-rose-200 dark:ring-rose-800" : undefined}
        />
        <StatCard label="Cancel Rate" value={`${data.cancelRate}%`} icon={AlertTriangle} accent="from-amber-500 to-orange-600" invertTrend />
        <StatCard label="Refund Total" value={formatINR(data.refundTotal)} icon={IndianRupee} accent="from-violet-500 to-purple-600" />
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Cancel Reasons */}
        <Card className="p-6 shadow-soft">
          <h3 className="text-sm font-semibold mb-4">Cancellation Reasons</h3>
          {data.reasonsBreakdown.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No cancellations this period.</p>
          ) : (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={data.reasonsBreakdown}>
                <XAxis dataKey="reason" tick={{ fontSize: 9 }} angle={-30} textAnchor="end" height={80} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip />
                <Bar dataKey="count" fill="var(--chart-5)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>

        {/* Cancellation Trend */}
        <Card className="p-6 shadow-soft">
          <h3 className="text-sm font-semibold mb-4">Cancellation Trend</h3>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={data.cancellationTrend}>
              <XAxis dataKey="week" tick={{ fontSize: 10 }} tickFormatter={(d: string) => d.slice(5)} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip />
              <Line type="monotone" dataKey="count" stroke="var(--chart-5)" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* Top Cancelled Orders */}
      {data.topCancelledOrders.length > 0 && (
        <Card className="p-6 shadow-soft">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold">Cancelled Orders ({data.cancelledOrders})</h3>
            <Button variant="outline" size="sm" onClick={() => onDrillDown({ status: "cancelled" })}>
              View All
            </Button>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Order</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.topCancelledOrders.map((o) => (
                <TableRow key={o.id}>
                  <TableCell className="font-medium">{o.code}</TableCell>
                  <TableCell>{o.customerName}</TableCell>
                  <TableCell className="text-right">{formatINR(o.total)}</TableCell>
                  <TableCell className="text-muted-foreground text-xs max-w-[150px] truncate">{o.notes || "—"}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{new Date(o.createdAt).toLocaleDateString("en-IN")}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}

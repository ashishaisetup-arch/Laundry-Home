import { Star, Download, FileDown, Inbox } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/shared/error-state";
import { EmptyState } from "@/components/shared/empty-state";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useReportServices, type ReportParams } from "@/lib/hooks/useVendorReports";
import { formatINR } from "@/lib/utils";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

interface Props {
  params: ReportParams;
  onExportCSV: (data: Record<string, unknown>[], reportType: string) => void;
  onExportPDF: (title: string, data: Record<string, unknown>[], columns: { header: string; dataKey: string }[]) => void;
}

export function ReportServices({ params, onExportCSV, onExportPDF }: Props) {
  const { data, loading, error, refetch } = useReportServices(params);

  if (loading) return <Card className="h-64 animate-pulse" />;
  if (error) return <ErrorState title="Failed to load services" message={error} onRetry={refetch} />;
  if (!data || (data.services ?? []).length === 0) return <EmptyState icon={Inbox} title="No service data" description="No services found for the selected period and filters." />;

  const chartData = (data.services ?? []).slice(0, 8);

  const columns = [
    { header: "Service", dataKey: "name" },
    { header: "Orders", dataKey: "orderCount" },
    { header: "Revenue", dataKey: "revenue" },
    { header: "Avg Rating", dataKey: "avgRating" },
  ];

  const exportData = (data.services ?? []).map((s) => ({
    Service: s.name,
    Orders: s.orderCount,
    Revenue: s.revenue,
    "Avg Rating": s.avgRating,
  }));

  return (
    <div className="space-y-6">
      <div className="flex justify-end gap-2">
        <Button variant="outline" size="sm" className="text-xs h-8" onClick={() => onExportCSV(exportData, "services")}>
          <Download className="h-3.5 w-3.5 mr-1" /> CSV
        </Button>
        <Button variant="outline" size="sm" className="text-xs h-8" onClick={() => onExportPDF("Services Report", exportData, columns)}>
          <FileDown className="h-3.5 w-3.5 mr-1" /> PDF
        </Button>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <Card className="p-6 shadow-soft">
          <h3 className="text-sm font-semibold mb-4">Revenue by Service</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData}>
              <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-30} textAnchor="end" height={80} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip formatter={(v: number) => formatINR(v)} />
              <Bar dataKey="revenue" fill="var(--chart-1)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card className="p-6 shadow-soft">
          <h3 className="text-sm font-semibold mb-4">Service Summary</h3>
          <div className="space-y-3">
            {(data.services ?? []).slice(0, 6).map((s) => (
              <div key={s.name} className="flex items-center justify-between p-3 rounded-lg bg-tonal">
                <div>
                  <p className="text-sm font-medium">{s.name}</p>
                  <p className="text-xs text-muted-foreground">{s.orderCount} orders</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold">{formatINR(s.revenue)}</p>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                    {s.avgRating}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card className="p-6 shadow-soft">
        <h3 className="text-sm font-semibold mb-4">All Services</h3>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Service</TableHead>
              <TableHead className="text-right">Orders</TableHead>
              <TableHead className="text-right">Revenue</TableHead>
              <TableHead className="text-right">Avg Rating</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(data.services ?? []).map((s) => (
              <TableRow key={s.name}>
                <TableCell className="font-medium">{s.name}</TableCell>
                <TableCell className="text-right">{s.orderCount}</TableCell>
                <TableCell className="text-right">{formatINR(s.revenue)}</TableCell>
                <TableCell className="text-right">
                  <span className="inline-flex items-center gap-1">
                    <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                    {s.avgRating}
                  </span>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

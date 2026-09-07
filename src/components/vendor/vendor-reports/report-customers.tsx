import { Users, Repeat, UserPlus, Download, FileDown, Inbox } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatCard } from "@/components/shared/stat-card";
import { StatCardSkeleton } from "@/components/shared/skeleton-card";
import { ErrorState } from "@/components/shared/error-state";
import { EmptyState } from "@/components/shared/empty-state";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useReportCustomers, type ReportParams } from "@/lib/hooks/useVendorReports";
import { formatINR } from "@/lib/utils";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";

interface Props {
  params: ReportParams;
  onExportCSV: (data: Record<string, unknown>[], reportType: string) => void;
  onExportPDF: (title: string, data: Record<string, unknown>[], columns: { header: string; dataKey: string }[]) => void;
}

export function ReportCustomers({ params, onExportCSV, onExportPDF }: Props) {
  const { data, loading, error, refetch } = useReportCustomers(params);

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
  if (error) return <ErrorState title="Failed to load customers" message={error} onRetry={refetch} />;
  if (!data) return <EmptyState icon={Inbox} title="No customer data" description="No customers found for the selected period and filters." />;

  const pieData = [
    { name: "Repeat", value: data.repeatVsNew.repeat, color: "var(--chart-1)" },
    { name: "New", value: data.repeatVsNew.new, color: "var(--chart-2)" },
  ].filter((d) => d.value > 0);

  const columns = [
    { header: "Customer", dataKey: "name" },
    { header: "Orders", dataKey: "orderCount" },
    { header: "Total Spend", dataKey: "totalSpend" },
  ];

  const exportData = (data.topCustomers ?? []).map((c) => ({
    name: c.name,
    orderCount: c.orderCount,
    totalSpend: c.totalSpend,
  }));

  return (
    <div className="space-y-6">
      <div className="flex justify-end gap-2">
        <Button variant="outline" size="sm" className="text-xs h-8" onClick={() => onExportCSV(exportData, "customers")}>
          <Download className="h-3.5 w-3.5 mr-1" /> CSV
        </Button>
        <Button variant="outline" size="sm" className="text-xs h-8" onClick={() => onExportPDF("Top Customers", exportData, columns)}>
          <FileDown className="h-3.5 w-3.5 mr-1" /> PDF
        </Button>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard label="Total Customers" value={String(data.totalCustomers)} icon={Users} accent="from-violet-500 to-purple-600" />
        <StatCard label="Retention Rate" value={`${data.repeatRate}%`} icon={Repeat} accent="from-emerald-500 to-teal-600" />
        <StatCard label="New Customers" value={String(data.repeatVsNew.new)} icon={UserPlus} accent="from-sky-500 to-blue-600" />
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <Card className="p-6 shadow-soft">
          <h3 className="text-sm font-semibold mb-4">Repeat vs New Customers</h3>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, value }: any) => `${name}: ${value}`}>
                {pieData.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </Card>

        <Card className="p-6 shadow-soft">
          <h3 className="text-sm font-semibold mb-4">Top Customers by Spend</h3>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Customer</TableHead>
                <TableHead className="text-right">Orders</TableHead>
                <TableHead className="text-right">Total Spend</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(data.topCustomers ?? []).map((c, i) => (
                <TableRow key={c.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono text-muted-foreground w-4">{i + 1}.</span>
                      <span className="font-medium">{c.name}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">{c.orderCount}</TableCell>
                  <TableCell className="text-right font-semibold">{formatINR(c.totalSpend)}</TableCell>
                </TableRow>
              ))}
              {(data.topCustomers ?? []).length === 0 && (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-muted-foreground text-sm py-8">No customer data</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </Card>
      </div>
    </div>
  );
}

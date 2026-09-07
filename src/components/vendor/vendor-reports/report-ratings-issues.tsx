import { Star, MessageSquare, Download, FileDown, Inbox } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatCard } from "@/components/shared/stat-card";
import { StatCardSkeleton } from "@/components/shared/skeleton-card";
import { ErrorState } from "@/components/shared/error-state";
import { EmptyState } from "@/components/shared/empty-state";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useReportRatingsIssues, type ReportParams } from "@/lib/hooks/useVendorReports";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line } from "recharts";

interface Props {
  params: ReportParams;
  onExportCSV: (data: Record<string, unknown>[], reportType: string) => void;
  onExportPDF: (title: string, data: Record<string, unknown>[], columns: { header: string; dataKey: string }[]) => void;
}

export function ReportRatingsIssues({ params, onExportCSV, onExportPDF }: Props) {
  const { data, loading, error, refetch } = useReportRatingsIssues(params);

  if (loading) return (
    <div className="space-y-6">
      <div className="grid md:grid-cols-2 lg:grid-cols-5 gap-4">
        {Array.from({ length: 5 }).map((_, i) => <StatCardSkeleton key={i} />)}
      </div>
      <div className="grid md:grid-cols-2 gap-4">
        {Array.from({ length: 2 }).map((_, i) => <Card key={i} className="h-64 animate-pulse" />)}
      </div>
    </div>
  );
  if (error) return <ErrorState title="Failed to load ratings" message={error} onRetry={refetch} />;
  if (!data) return <EmptyState icon={Inbox} title="No rating data" description="No reviews found for the selected period and filters." />;

  const distributionData = [1, 2, 3, 4, 5].map((star) => ({
    stars: `${star}★`,
    count: data.distribution?.[star] || 0,
  }));

  const columns = [
    { header: "Star", dataKey: "stars" },
    { header: "Count", dataKey: "count" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex justify-end gap-2">
        <Button variant="outline" size="sm" className="text-xs h-8" onClick={() => onExportCSV(distributionData.map(d => ({ Star: d.stars, Count: d.count })), "ratings-distribution")}>
          <Download className="h-3.5 w-3.5 mr-1" /> CSV
        </Button>
        <Button variant="outline" size="sm" className="text-xs h-8" onClick={() => onExportPDF("Ratings Distribution", distributionData.map(d => ({ Star: d.stars, Count: String(d.count) })), columns)}>
          <FileDown className="h-3.5 w-3.5 mr-1" /> PDF
        </Button>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard label="Overall" value={`${data.avgOverall}`} icon={Star} accent="from-amber-500 to-orange-600" />
        <StatCard label="Vendor" value={`${data.avgVendor}`} icon={Star} accent="from-emerald-500 to-teal-600" />
        <StatCard label="Pickup" value={`${data.avgPickup}`} icon={Star} accent="from-sky-500 to-blue-600" />
        <StatCard label="Laundry" value={`${data.avgLaundry}`} icon={Star} accent="from-violet-500 to-purple-600" />
        <StatCard label="Delivery" value={`${data.avgDelivery}`} icon={Star} accent="from-pink-500 to-rose-600" />
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Star Distribution */}
        <Card className="p-6 shadow-soft">
          <h3 className="text-sm font-semibold mb-4">Rating Distribution ({data.totalReviews} reviews)</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={distributionData} layout="vertical">
              <XAxis type="number" tick={{ fontSize: 10 }} />
              <YAxis type="category" dataKey="stars" tick={{ fontSize: 12 }} width={30} />
              <Tooltip />
              <Bar dataKey="count" fill="var(--chart-4)" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        {/* Rating Trend */}
        <Card className="p-6 shadow-soft">
          <h3 className="text-sm font-semibold mb-4">Rating Trend</h3>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={data.ratingTrend ?? []}>
              <XAxis dataKey="week" tick={{ fontSize: 10 }} tickFormatter={(d: string) => d.slice(5)} />
              <YAxis domain={[0, 5]} tick={{ fontSize: 10 }} />
              <Tooltip />
              <Line type="monotone" dataKey="avg" stroke="var(--chart-4)" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* Negative Reviews */}
      {(data.recentNegative ?? []).length > 0 && (
        <Card className="p-6 shadow-soft">
          <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-rose-500" />
            Recent Negative Reviews ({(data.recentNegative ?? []).length})
          </h3>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Customer</TableHead>
                <TableHead className="text-center">Rating</TableHead>
                <TableHead>Comment</TableHead>
                <TableHead>Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(data.recentNegative ?? []).map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.customerName}</TableCell>
                  <TableCell className="text-center">
                    <span className="inline-flex items-center gap-1 text-amber-600">
                      <Star className="h-3 w-3 fill-amber-400" /> {r.overall}
                    </span>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-xs max-w-[200px] truncate">{r.comment || "—"}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{new Date(r.createdAt).toLocaleDateString("en-IN")}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}

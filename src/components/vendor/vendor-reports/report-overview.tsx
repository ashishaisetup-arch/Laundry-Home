import {
  IndianRupee,
  ShoppingCart,
  Clock,
  Repeat,
  Star,
  TrendingUp,
  TrendingDown,
  Download,
  FileDown,
  AlertTriangle,
  CheckCircle,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatCard } from "@/components/shared/stat-card";
import { StatCardSkeleton } from "@/components/shared/skeleton-card";
import { ErrorState } from "@/components/shared/error-state";
import { EmptyState } from "@/components/shared/empty-state";
import { useReportOverview, type ReportParams } from "@/lib/hooks/useVendorReports";
import { formatINR } from "@/lib/utils";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface Props {
  params: ReportParams;
  onTabChange: (tab: string) => void;
  onExportCSV: (data: Record<string, unknown>[], reportType: string) => void;
  onExportPDF: (
    title: string,
    data: Record<string, unknown>[],
    columns: { header: string; dataKey: string }[],
  ) => void;
}

export function ReportOverview({ params, onTabChange, onExportCSV, onExportPDF }: Props) {
  const { data, loading, error, refetch } = useReportOverview(params);

  // ── Loading ──
  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <StatCardSkeleton key={`primary-${i}`} />
          ))}
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <StatCardSkeleton key={`secondary-${i}`} />
          ))}
        </div>
        <div className="grid lg:grid-cols-2 gap-4">
          <Card className="h-64 animate-pulse" />
          <Card className="h-64 animate-pulse" />
        </div>
      </div>
    );
  }

  // ── Error ──
  if (error) {
    return (
      <ErrorState
        title="Failed to load overview"
        message={error}
        onRetry={refetch}
      />
    );
  }

  // ── Empty ──
  if (!data || data.totalOrders === 0) {
    return (
      <EmptyState
        icon={ShoppingCart}
        title="No orders found"
        description="There are no orders for this period. Try adjusting the date range or filters."
      />
    );
  }

  // ── Export data ──
  const exportData = [
    { Metric: "Total Revenue", Value: formatINR(data.totalRevenue) },
    { Metric: "Total Orders", Value: String(data.totalOrders) },
    { Metric: "Avg Order Value", Value: formatINR(data.aov) },
    {
      Metric: "Avg Turnaround",
      Value: data.avgTurnaroundHrs == null ? "—" : `${data.avgTurnaroundHrs.toFixed(1)}h`,
    },
    { Metric: "Repeat Rate", Value: `${data.repeatRate}%` },
    {
      Metric: "On-Time Rate",
      Value: data.onTimeRate == null ? "—" : `${data.onTimeRate.toFixed(1)}%`,
    },
    {
      Metric: "Revenue Change",
      Value: `${data.revenueChange > 0 ? "+" : ""}${data.revenueChange}%`,
    },
    {
      Metric: "Orders Change",
      Value: `${data.ordersChange > 0 ? "+" : ""}${data.ordersChange}%`,
    },
    { Metric: "Cancellation Rate", Value: `${data.cancellationRate}%` },
    {
      Metric: "Avg Rating",
      Value: data.totalReviews === 0 ? "—" : data.avgRating.toFixed(1),
    },
  ];

  const exportColumns = [
    { header: "Metric", dataKey: "Metric" },
    { header: "Value", dataKey: "Value" },
  ];

  // ── Primary KPI cards (top 6) ──
  const primaryStats = [
    {
      label: "Revenue",
      value: formatINR(data.totalRevenue),
      icon: IndianRupee,
      accent: "from-teal-500 to-emerald-600",
    },
    {
      label: "Total Orders",
      value: String(data.totalOrders),
      icon: ShoppingCart,
      accent: "from-violet-500 to-purple-600",
    },
    {
      label: "Avg Order Value",
      value: formatINR(data.aov),
      icon: IndianRupee,
      accent: "from-amber-500 to-orange-600",
    },
    {
      label: "Avg Turnaround",
      value: data.avgTurnaroundHrs == null ? "—" : `${data.avgTurnaroundHrs.toFixed(1)}h`,
      icon: Clock,
      accent: "from-sky-500 to-blue-600",
      invertTrend: true,
    },
    {
      label: "Repeat Rate",
      value: `${data.repeatRate}%`,
      icon: Repeat,
      accent: "from-pink-500 to-rose-600",
    },
    {
      label: "On-Time Rate",
      value: data.onTimeRate == null ? "—" : `${data.onTimeRate.toFixed(1)}%`,
      icon: CheckCircle,
      accent: "from-emerald-500 to-green-600",
      invertTrend: true,
    },
  ];

  // ── Secondary KPI cards (bottom 4) ──
  const secondaryStats = [
    {
      label: "Revenue Change",
      value: `${data.revenueChange > 0 ? "+" : ""}${data.revenueChange}%`,
      icon: data.revenueChange >= 0 ? TrendingUp : TrendingDown,
      trend: data.revenueChange >= 0 ? ("up" as const) : ("down" as const),
      accent: "from-teal-500 to-cyan-600",
    },
    {
      label: "Orders Change",
      value: `${data.ordersChange > 0 ? "+" : ""}${data.ordersChange}%`,
      icon: data.ordersChange >= 0 ? TrendingUp : TrendingDown,
      trend: data.ordersChange >= 0 ? ("up" as const) : ("down" as const),
      accent: "from-violet-500 to-indigo-600",
    },
    {
      label: "Cancellation Rate",
      value: `${data.cancellationRate}%`,
      icon: TrendingDown,
      invertTrend: true,
      accent: "from-rose-500 to-red-600",
    },
    {
      label: "Avg Rating",
      value: data.totalReviews === 0 ? "—" : data.avgRating.toFixed(1),
      icon: Star,
      accent: "from-yellow-500 to-amber-600",
    },
  ];

  // ── Charts data (sorted by date value) ──
  const revenueTrend = [...(data.revenueTrend ?? [])].sort((a, b) => a.day.localeCompare(b.day));
  const ordersTrend = [...(data.ordersTrend ?? [])].sort((a, b) => a.day.localeCompare(b.day));

  return (
    <div className="space-y-6">
      {/* Export buttons */}
      <div className="flex justify-end gap-2">
        <Button
          variant="outline"
          size="sm"
          className="text-xs h-8"
          onClick={() => onExportCSV(exportData, "overview")}
        >
          <Download className="h-3.5 w-3.5 mr-1" /> CSV
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="text-xs h-8"
          onClick={() =>
            onExportPDF("Overview Report", exportData, exportColumns)
          }
        >
          <FileDown className="h-3.5 w-3.5 mr-1" /> PDF
        </Button>
      </div>

      {/* Primary KPIs (top 6) */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {primaryStats.map((s) => (
          <StatCard key={s.label} {...s} />
        ))}
      </div>

      {/* Secondary KPIs (bottom 4) */}
      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
        {secondaryStats.map((s) => (
          <StatCard key={s.label} {...s} />
        ))}
      </div>

      {/* Charts */}
      <div className="grid lg:grid-cols-2 gap-4">
        {/* Revenue Trend */}
        <Card className="p-5 shadow-soft">
          <div className="mb-3">
            <h3 className="font-semibold text-sm">Revenue Trend</h3>
            <p className="text-xs text-muted-foreground">Daily revenue</p>
          </div>
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={revenueTrend} margin={{ left: -16, right: 8 }}>
              <defs>
                <linearGradient id="overview-rev-grad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="hsl(var(--border))"
                vertical={false}
              />
              <XAxis
                dataKey="day"
                tick={{ fontSize: 11 }}
                stroke="hsl(var(--muted-foreground))"
              />
              <YAxis
                tick={{ fontSize: 11 }}
                stroke="hsl(var(--muted-foreground))"
                tickFormatter={(v: number) => `Rs.${v}`}
              />
              <Tooltip
                contentStyle={{
                  borderRadius: 12,
                  border: "1px solid hsl(var(--border))",
                  background: "hsl(var(--card))",
                  fontSize: 12,
                }}
                formatter={(v: number) => [`Rs.${v.toLocaleString("en-IN")}`, "Revenue"]}
              />
              <Area
                type="monotone"
                dataKey="revenue"
                stroke="var(--chart-1)"
                strokeWidth={2.5}
                fill="url(#overview-rev-grad)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </Card>

        {/* Orders Trend */}
        <Card className="p-5 shadow-soft">
          <div className="mb-3">
            <h3 className="font-semibold text-sm">Orders Trend</h3>
            <p className="text-xs text-muted-foreground">Daily order count</p>
          </div>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={ordersTrend} margin={{ left: -16, right: 8 }}>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="hsl(var(--border))"
                vertical={false}
              />
              <XAxis
                dataKey="day"
                tick={{ fontSize: 11 }}
                stroke="hsl(var(--muted-foreground))"
              />
              <YAxis
                tick={{ fontSize: 11 }}
                stroke="hsl(var(--muted-foreground))"
                allowDecimals={false}
              />
              <Tooltip
                contentStyle={{
                  borderRadius: 12,
                  border: "1px solid hsl(var(--border))",
                  background: "hsl(var(--card))",
                  fontSize: 12,
                }}
                formatter={(v: number) => [`${v}`, "Orders"]}
              />
              <Bar
                dataKey="count"
                fill="var(--chart-3)"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* Insights */}
      <div className="grid md:grid-cols-3 gap-4">
        <Card className="p-5 shadow-soft">
          <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-[0.08em] mb-2">
            Top Service
          </p>
          <p className="text-lg font-semibold">
            {data.topService == null ? "—" : data.topService.name}
          </p>
          {data.topService != null && (
            <p className="text-xs text-muted-foreground mt-1">
              {formatINR(data.topService.revenue)} revenue
            </p>
          )}
        </Card>

        <Card className="p-5 shadow-soft">
          <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-[0.08em] mb-2">
            Best Revenue Day
          </p>
          <p className="text-lg font-semibold">
            {data.bestDay == null ? "—" : data.bestDay.day}
          </p>
          {data.bestDay != null && (
            <p className="text-xs text-muted-foreground mt-1">
              {formatINR(data.bestDay.revenue)} revenue
            </p>
          )}
        </Card>

        <Card className="p-5 shadow-soft">
          <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-[0.08em] mb-2">
            Most Active Customer
          </p>
          <p className="text-lg font-semibold">
            {data.mostActiveCustomer == null ? "—" : data.mostActiveCustomer.name}
          </p>
          {data.mostActiveCustomer != null && (
            <p className="text-xs text-muted-foreground mt-1">
              {data.mostActiveCustomer.orderCount} order{data.mostActiveCustomer.orderCount !== 1 ? "s" : ""}
            </p>
          )}
        </Card>
      </div>

      {/* Attention banner */}
      {data.delayedCount > 0 && (
        <Card className="p-4 border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-600" />
              <div>
                <p className="font-medium text-sm">
                  {data.delayedCount} order{data.delayedCount !== 1 ? "s" : ""} require attention
                </p>
                <p className="text-xs text-muted-foreground">
                  Past estimated delivery time
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onTabChange("orders-operations")}
            >
              View Delayed
            </Button>
          </div>
        </Card>
      )}

      {/* Action buttons */}
      <div className="flex gap-3">
        <Button
          variant="outline"
          size="sm"
          className="text-xs"
          onClick={() => onTabChange("sales-revenue")}
        >
          View Revenue Details
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="text-xs"
          onClick={() => onTabChange("orders-operations")}
        >
          View Delayed Orders
        </Button>
      </div>
    </div>
  );
}

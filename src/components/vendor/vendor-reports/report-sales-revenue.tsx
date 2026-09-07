import {
  IndianRupee,
  TrendingDown,
  Download,
  FileDown,
} from "lucide-react";
import { Card } from "@/components/ui/card";
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
  useReportSalesRevenue,
  type ReportParams,
} from "@/lib/hooks/useVendorReports";
import { formatINR } from "@/lib/utils";
import {
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

const PIE_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

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

export function ReportSalesRevenue({
  params,
  onExportCSV,
  onExportPDF,
}: Props) {
  const { data, loading, error, refetch } = useReportSalesRevenue(params);

  // ── Loading ──
  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <StatCardSkeleton key={i} />
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
        title="Failed to load revenue data"
        message={error}
        onRetry={refetch}
      />
    );
  }

  // ── Empty ──
  if (
    !data ||
    (data.grossRevenue === 0 &&
      data.refunds === 0 &&
      data.netOrderValue === 0)
  ) {
    return (
      <EmptyState
        icon={IndianRupee}
        title="No revenue data"
        description="There are no financial records for this period."
      />
    );
  }

  // ── Export ──
  const serviceExportData = (data.revenueByService ?? []).map((s) => ({
    Service: s.name,
    Revenue: formatINR(s.revenue),
    Share: `${s.percentage}%`,
  }));
  const dailyExportData = (data.dailyRevenue ?? []).map((d) => ({
    Date: d.day,
    Revenue: formatINR(d.revenue),
    Orders: String(d.orders),
  }));
  const serviceColumns = [
    { header: "Service", dataKey: "Service" },
    { header: "Revenue", dataKey: "Revenue" },
    { header: "Share", dataKey: "Share" },
  ];
  const dailyColumns = [
    { header: "Date", dataKey: "Date" },
    { header: "Revenue", dataKey: "Revenue" },
    { header: "Orders", dataKey: "Orders" },
  ];

  // ── KPI cards ──
  const discounts = data.couponDiscount + data.subscriptionDiscount;
  const kpiStats = [
    {
      label: "Customer Amount Charged",
      value: formatINR(data.grossRevenue),
      icon: IndianRupee,
      accent: "from-teal-500 to-emerald-600",
    },
    {
      label: "Net Order Value",
      value: formatINR(data.netOrderValue),
      icon: IndianRupee,
      accent: "from-violet-500 to-purple-600",
    },
    {
      label: "Discounts",
      value: formatINR(discounts),
      icon: TrendingDown,
      accent: "from-rose-500 to-red-600",
    },
    {
      label: "Refunds",
      value: formatINR(data.refunds),
      icon: IndianRupee,
      accent: "from-amber-500 to-orange-600",
    },
    {
      label: "Est. Commission",
      value: formatINR(data.estimatedCommission),
      icon: IndianRupee,
      accent: "from-sky-500 to-blue-600",
    },
    {
      label: "Est. Vendor Earnings",
      value: formatINR(data.estimatedVendorEarnings),
      icon: IndianRupee,
      accent: "from-emerald-500 to-green-600",
    },
  ];

  // ── Reconciliation rows ──
  const reconciliationRows: { label: string; value: number; type: "neutral" | "negative" | "positive" | "total" | "final" }[] = [
    {
      label: "Subtotal (pre-discount)",
      value: data.subtotal,
      type: "neutral" as const,
    },
    {
      label: "Less: Coupon Discounts",
      value: -data.couponDiscount,
      type: "negative" as const,
    },
    {
      label: "Less: Subscription Discounts",
      value: -data.subscriptionDiscount,
      type: "negative" as const,
    },
    {
      label: "= Customer Net Revenue",
      value: data.netOrderValue,
      type: "total" as const,
    },
    {
      label: "Plus: Platform Fees",
      value: data.platformFees,
      type: "positive" as const,
    },
    {
      label: "Plus: Delivery Fees",
      value: data.deliveryFees,
      type: "positive" as const,
    },
    {
      label: "Plus: Express Surcharges",
      value: data.expressSurcharges,
      type: "positive" as const,
    },
    {
      label: "Plus: Surge Charges",
      value: data.surgeCharges,
      type: "positive" as const,
    },
    {
      label: "Plus: Taxes (GST)",
      value: data.taxes,
      type: "positive" as const,
    },
    {
      label: "= Customer Amount Charged",
      value: data.grossRevenue,
      type: "total" as const,
    },
    {
      label: "Less: Refunds",
      value: -data.refunds,
      type: "negative" as const,
    },
    {
      label: "Less: Est. Commission (10%)",
      value: -data.estimatedCommission,
      type: "negative" as const,
    },
    {
      label: "= Est. Vendor Earnings",
      value: data.estimatedVendorEarnings,
      type: "final" as const,
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
          onClick={() => onExportCSV(serviceExportData, "sales-services")}
        >
          <Download className="h-3.5 w-3.5 mr-1" /> CSV (Services)
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="text-xs h-8"
          onClick={() =>
            onExportPDF(
              "Sales & Revenue by Service",
              serviceExportData,
              serviceColumns,
            )
          }
        >
          <FileDown className="h-3.5 w-3.5 mr-1" /> PDF
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="text-xs h-8"
          onClick={() =>
            onExportCSV(dailyExportData, "sales-daily")
          }
        >
          <Download className="h-3.5 w-3.5 mr-1" /> CSV (Daily)
        </Button>
      </div>

      {/* KPI cards */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {kpiStats.map((s) => (
          <StatCard key={s.label} {...s} />
        ))}
      </div>

      {/* Reconciliation block */}
      <Card className="p-6 shadow-soft">
        <h3 className="text-sm font-semibold mb-1">
          Financial Reconciliation
        </h3>
        <p className="text-xs text-muted-foreground mb-4">
          Estimated. Settlements tab shows authoritative payout records.
        </p>
        <div className="space-y-1.5 text-sm">
          {reconciliationRows.map((row, i) => {
            const isTotal =
              row.type === "total" ||
              row.type === "final";
            const isNegative = row.type === "negative";
            const isPositive = row.type === "positive";
            const isSeparator =
              row.type === "total" &&
              i > 0 &&
              reconciliationRows[i - 1]?.type === "negative";

            return (
              <div key={row.label}>
                {isSeparator && (
                  <div className="border-t border-border/60 my-2" />
                )}
                <div
                  className={`flex items-center justify-between py-0.5 ${
                    isTotal || row.type === "final"
                      ? "font-semibold border-t border-border/60 pt-2 mt-1"
                      : ""
                  }`}
                >
                  <span
                    className={
                      row.type === "final"
                        ? "text-emerald-600 dark:text-emerald-400"
                        : ""
                    }
                  >
                    {row.label}
                  </span>
                  <span
                    className={`tabular-nums ${
                      isNegative
                        ? "text-rose-600 dark:text-rose-400"
                        : isPositive
                          ? "text-emerald-600 dark:text-emerald-400"
                          : row.type === "final"
                            ? "text-emerald-600 dark:text-emerald-400"
                            : ""
                    }`}
                  >
                    {row.value < 0 ? "- " : ""}
                    {formatINR(Math.abs(row.value))}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Daily Revenue Chart */}
      <Card className="p-5 shadow-soft">
        <div className="mb-3">
          <h3 className="font-semibold text-sm">Daily Revenue</h3>
          <p className="text-xs text-muted-foreground">
            Customer amount charged per day
          </p>
        </div>
        <ResponsiveContainer width="100%" height={280}>
          <AreaChart
            data={data.dailyRevenue}
            margin={{ left: -16, right: 8 }}
          >
            <defs>
              <linearGradient
                id="sales-rev-grad"
                x1="0"
                y1="0"
                x2="0"
                y2="1"
              >
                <stop
                  offset="0%"
                  stopColor="var(--chart-1)"
                  stopOpacity={0.4}
                />
                <stop
                  offset="100%"
                  stopColor="var(--chart-1)"
                  stopOpacity={0}
                />
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
              tickFormatter={(d: string) => d.slice(5)}
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
              formatter={(v: number) => [
                `Rs.${v.toLocaleString("en-IN")}`,
                "Revenue",
              ]}
            />
            <Area
              type="monotone"
              dataKey="revenue"
              stroke="var(--chart-1)"
              strokeWidth={2.5}
              fill="url(#sales-rev-grad)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </Card>

      {/* Breakdown charts */}
      <div className="grid lg:grid-cols-3 gap-4">
        {/* Revenue by Service */}
        <Card className="p-5 shadow-soft">
          <h3 className="font-semibold text-sm mb-3">
            Revenue by Service
          </h3>
          {(data.revenueByService ?? []).length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-8">
              No service data
            </p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={data.revenueByService}
                  dataKey="revenue"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  label={({ name, percentage }: any) =>
                    `${name} ${percentage}%`
                  }
                >
                  {(data.revenueByService ?? []).map((_, i) => (
                    <Cell
                      key={i}
                      fill={PIE_COLORS[i % PIE_COLORS.length]}
                    />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    borderRadius: 12,
                    border: "1px solid hsl(var(--border))",
                    background: "hsl(var(--card))",
                    fontSize: 12,
                  }}
                  formatter={(v: number) => [
                    `Rs.${v.toLocaleString("en-IN")}`,
                    "Revenue",
                  ]}
                />
              </PieChart>
            </ResponsiveContainer>
          )}
        </Card>

        {/* Revenue by Payment Method */}
        <Card className="p-5 shadow-soft">
          <h3 className="font-semibold text-sm mb-3">
            Revenue by Payment
          </h3>
          {(data.revenueByPaymentMethod ?? []).length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-8">
              No payment data
            </p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={data.revenueByPaymentMethod}
                  dataKey="revenue"
                  nameKey="method"
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={3}
                  label={({ method, percentage }: any) =>
                    `${method} ${percentage}%`
                  }
                >
                  {(data.revenueByPaymentMethod ?? []).map((_, i) => (
                    <Cell
                      key={i}
                      fill={PIE_COLORS[i % PIE_COLORS.length]}
                    />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    borderRadius: 12,
                    border: "1px solid hsl(var(--border))",
                    background: "hsl(var(--card))",
                    fontSize: 12,
                  }}
                  formatter={(v: number) => [
                    `Rs.${v.toLocaleString("en-IN")}`,
                    "Revenue",
                  ]}
                />
              </PieChart>
            </ResponsiveContainer>
          )}
        </Card>

        {/* Revenue by Day of Week */}
        <Card className="p-5 shadow-soft">
          <h3 className="font-semibold text-sm mb-3">
            Revenue by Day
          </h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={data.revenueByDayOfWeek ?? []}>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="hsl(var(--border))"
                vertical={false}
              />
              <XAxis
                dataKey="day"
                tick={{ fontSize: 10 }}
                stroke="hsl(var(--muted-foreground))"
              />
              <YAxis
                tick={{ fontSize: 10 }}
                stroke="hsl(var(--muted-foreground))"
              />
              <Tooltip
                contentStyle={{
                  borderRadius: 12,
                  border: "1px solid hsl(var(--border))",
                  background: "hsl(var(--card))",
                  fontSize: 12,
                }}
                formatter={(v: number) => [
                  `Rs.${v.toLocaleString("en-IN")}`,
                  "Revenue",
                ]}
              />
              <Bar
                dataKey="revenue"
                fill="var(--chart-4)"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* Service Revenue Table */}
      {(data.revenueByService ?? []).length > 0 && (
        <Card className="p-6 shadow-soft">
          <h3 className="text-sm font-semibold mb-4">
            Revenue by Service
          </h3>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Service</TableHead>
                <TableHead className="text-right">Revenue</TableHead>
                <TableHead className="text-right">Share</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(data.revenueByService ?? []).map((s) => (
                <TableRow key={s.name}>
                  <TableCell className="font-medium">
                    {s.name}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatINR(s.revenue)}
                  </TableCell>
                  <TableCell className="text-right">
                    {s.percentage}%
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* Daily Breakdown Table */}
      {(data.dailyRevenue ?? []).length > 0 && (
        <Card className="p-6 shadow-soft">
          <h3 className="text-sm font-semibold mb-4">
            Daily Breakdown
          </h3>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Revenue</TableHead>
                <TableHead className="text-right">Orders</TableHead>
                <TableHead className="text-right">
                  Avg Order
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(data.dailyRevenue ?? []).map((d) => (
                <TableRow key={d.day}>
                  <TableCell className="font-medium">
                    {d.day}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatINR(d.revenue)}
                  </TableCell>
                  <TableCell className="text-right">
                    {d.orders}
                  </TableCell>
                  <TableCell className="text-right">
                    {d.orders > 0
                      ? formatINR(Math.round(d.revenue / d.orders))
                      : "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}

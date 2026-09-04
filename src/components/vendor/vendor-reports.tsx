import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { exportToCSV, exportToPDF, buildExportFilename } from "@/lib/export";
import type { ReportParams } from "@/lib/hooks/useVendorReports";
import type { ViewQuery } from "@/lib/hooks/use-router-view";
import { useServices } from "@/lib/hooks/useServices";
import { ReportOverview } from "./vendor-reports/report-overview";
import { ReportSalesRevenue } from "./vendor-reports/report-sales-revenue";
import { ReportOrdersOperations } from "./vendor-reports/report-orders-operations";
import { ReportServices } from "./vendor-reports/report-services";
import { ReportCustomers } from "./vendor-reports/report-customers";
import { ReportSettlements } from "./vendor-reports/report-settlements";
import { ReportRatingsIssues } from "./vendor-reports/report-ratings-issues";
import { ReportCancellations } from "./vendor-reports/report-cancellations";

const TABS = [
  { value: "overview", label: "Overview" },
  { value: "sales-revenue", label: "Sales & Revenue" },
  { value: "orders-operations", label: "Orders & Operations" },
  { value: "services", label: "Services" },
  { value: "customers", label: "Customers" },
  { value: "settlements", label: "Settlements" },
  { value: "ratings-issues", label: "Ratings & Issues" },
  { value: "cancellations", label: "Cancellations" },
];

const PRESETS = [
  { label: "Today", days: 0 },
  { label: "Last 7 days", days: 7 },
  { label: "Last 30 days", days: 30 },
  { label: "This month", days: 0 },
  { label: "Last 3 months", days: 90 },
];

function toLocalDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function getDateRange(preset: string, customStart?: string, customEnd?: string) {
  const now = new Date();
  if (preset === "custom" && customStart && customEnd) {
    return {
      startStr: customStart,
      endStr: customEnd,
      startDate: customStart,
      endDate: customEnd,
    };
  }
  if (preset === "Today") {
    const today = toLocalDateStr(now);
    return { startStr: today, endStr: today, startDate: today, endDate: today };
  }
  if (preset === "This month") {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    return {
      startStr: toLocalDateStr(start),
      endStr: toLocalDateStr(now),
      startDate: toLocalDateStr(start),
      endDate: toLocalDateStr(now),
    };
  }
  const days = PRESETS.find((p) => p.label === preset)?.days || 30;
  const start = new Date(now);
  start.setDate(start.getDate() - days);
  return {
    startStr: toLocalDateStr(start),
    endStr: toLocalDateStr(now),
    startDate: toLocalDateStr(start),
    endDate: toLocalDateStr(now),
  };
}

const STATUS_OPTIONS = [
  { value: "_all", label: "All Statuses" },
  { value: "placed", label: "Placed" },
  { value: "vendor_assigned", label: "Assigned" },
  { value: "processing", label: "Processing" },
  { value: "ready", label: "Ready" },
  { value: "out_for_delivery", label: "Out for Delivery" },
  { value: "delivered", label: "Delivered" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
];

interface Props {
  onNavigate: (view: string, opts?: ViewQuery) => void;
}

export function VendorReports({ onNavigate }: Props) {
  const [activeTab, setActiveTab] = useState("overview");
  const [preset, setPreset] = useState("Last 30 days");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [serviceFilter, setServiceFilter] = useState<string>("_all");
  const [statusFilter, setStatusFilter] = useState<string>("_all");

  const { data: services } = useServices();
  const { startStr, endStr, startDate, endDate } = getDateRange(preset, customStart, customEnd);

  const params: ReportParams = {
    startDate,
    endDate,
    service: serviceFilter === "_all" ? undefined : serviceFilter,
    status: statusFilter === "_all" ? undefined : statusFilter,
  };

  const handleDrillDown = (filters: { status?: string; delayed?: boolean; startDate?: string; endDate?: string; service?: string; orderStatus?: string }) => {
    onNavigate("orders", {
      filter: filters.status || "processing",
      delayed: filters.delayed,
      startDate: filters.startDate || startStr,
      endDate: filters.endDate || endStr,
      service: filters.service || (serviceFilter !== "_all" ? serviceFilter : undefined),
      status: filters.orderStatus || (statusFilter !== "_all" ? statusFilter : undefined),
    });
  };

  const handleExportCSV = (data: Record<string, unknown>[], reportType: string) => {
    const filename = buildExportFilename(reportType, serviceFilter === "_all" ? undefined : serviceFilter, startStr, endStr) + ".csv";
    exportToCSV(data, filename);
  };

  const handleExportPDF = (title: string, data: Record<string, unknown>[], columns: { header: string; dataKey: string }[]) => {
    const subtitle = `Period: ${startStr} — ${endStr}${serviceFilter !== "_all" ? ` · Service: ${serviceFilter}` : ""}`;
    const filename = buildExportFilename(title.toLowerCase().replace(/\s+/g, "-"), serviceFilter === "_all" ? undefined : serviceFilter, startStr, endStr) + ".pdf";
    exportToPDF(title, subtitle, data, columns);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Reports</h2>
          <p className="text-sm text-muted-foreground">
            Business insights and financial reporting
          </p>
        </div>
        <div className="text-right text-xs text-muted-foreground">
          <span className="font-medium text-foreground">Period:</span>{" "}
          {startStr} — {endStr}
          {serviceFilter !== "_all" && (
            <>
              {" "}&middot;{" "}
              <span className="font-medium text-foreground">Service:</span> {serviceFilter}
            </>
          )}
        </div>
      </div>

      {/* Sticky Filters */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b pb-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1">
            {PRESETS.map((p) => (
              <Button
                key={p.label}
                variant={preset === p.label ? "default" : "outline"}
                size="sm"
                className="text-xs h-8"
                onClick={() => setPreset(p.label)}
              >
                {p.label}
              </Button>
            ))}
            <Button
              variant={preset === "custom" ? "default" : "outline"}
              size="sm"
              className="text-xs h-8"
              onClick={() => setPreset("custom")}
            >
              Custom
            </Button>
          </div>

          {preset === "custom" && (
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                className="h-8 rounded-md border bg-background px-2 text-xs"
              />
              <span className="text-xs text-muted-foreground">to</span>
              <input
                type="date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="h-8 rounded-md border bg-background px-2 text-xs"
              />
            </div>
          )}

          <Select value={serviceFilter} onValueChange={setServiceFilter}>
            <SelectTrigger className="h-8 w-[160px] text-xs">
              <SelectValue placeholder="All Services" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="_all">All Services</SelectItem>
              {services?.map((s) => (
                <SelectItem key={s.name} value={s.name}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-8 w-[150px] text-xs">
              <SelectValue placeholder="All Statuses" />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="flex items-center justify-between">
          <TabsList className="h-auto flex-wrap gap-1 bg-muted/50 p-1">
            {TABS.map((t) => (
              <TabsTrigger key={t.value} value={t.value} className="text-xs">
                {t.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        <div className="mt-6">
          <TabsContent value="overview">
            <ReportOverview params={params} onTabChange={setActiveTab} onExportCSV={handleExportCSV} onExportPDF={handleExportPDF} />
          </TabsContent>
          <TabsContent value="sales-revenue">
            <ReportSalesRevenue params={params} onExportCSV={handleExportCSV} onExportPDF={handleExportPDF} />
          </TabsContent>
          <TabsContent value="orders-operations">
            <ReportOrdersOperations params={params} onDrillDown={handleDrillDown} onExportCSV={handleExportCSV} onExportPDF={handleExportPDF} />
          </TabsContent>
          <TabsContent value="services">
            <ReportServices params={params} onExportCSV={handleExportCSV} onExportPDF={handleExportPDF} />
          </TabsContent>
          <TabsContent value="customers">
            <ReportCustomers params={params} onExportCSV={handleExportCSV} onExportPDF={handleExportPDF} />
          </TabsContent>
          <TabsContent value="settlements">
            <ReportSettlements params={params} onExportCSV={handleExportCSV} onExportPDF={handleExportPDF} />
          </TabsContent>
          <TabsContent value="ratings-issues">
            <ReportRatingsIssues params={params} onExportCSV={handleExportCSV} onExportPDF={handleExportPDF} />
          </TabsContent>
          <TabsContent value="cancellations">
            <ReportCancellations params={params} onDrillDown={handleDrillDown} onExportCSV={handleExportCSV} onExportPDF={handleExportPDF} />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}

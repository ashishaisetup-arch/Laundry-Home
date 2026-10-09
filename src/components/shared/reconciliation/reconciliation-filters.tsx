import { Search, RefreshCw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ReconciliationSubjectType } from "@/lib/types";

export interface ReconciliationFilterValues {
  q: string;
  status: string;
  severity: string;
  subjectType: string;
  checkCode: string;
}

const ALL = "all";

const STATUS_OPTIONS = [
  { value: "open", label: "Open" },
  { value: "acknowledged", label: "Acknowledged" },
  { value: "resolved", label: "Resolved" },
];

const SEVERITY_OPTIONS = [
  { value: "critical", label: "Critical" },
  { value: "warning", label: "Warning" },
  { value: "info", label: "Info" },
];

const SUBJECT_TYPE_OPTIONS: Array<{ value: ReconciliationSubjectType; label: string }> = [
  { value: "payment", label: "Payment" },
  { value: "refund", label: "Refund" },
  { value: "order", label: "Order" },
  { value: "webhook_event", label: "Webhook Event" },
  { value: "wallet_user", label: "Wallet User" },
];

interface ReconciliationFiltersProps {
  value: ReconciliationFilterValues;
  onChange: (patch: Partial<ReconciliationFilterValues>) => void;
  onReset: () => void;
  onRefresh: () => void;
  qInvalid: boolean;
  checkCodeInvalid: boolean;
}

export function ReconciliationFilters({
  value,
  onChange,
  onReset,
  onRefresh,
  qInvalid,
  checkCodeInvalid,
}: ReconciliationFiltersProps) {
  const hasFilters =
    value.q !== "" || value.status !== "" || value.severity !== "" || value.subjectType !== "" || value.checkCode !== "";

  return (
    <div className="space-y-2">
      <div className="flex flex-col md:flex-row md:items-center gap-3">
        <div className="flex-1 flex items-center rounded-lg border border-input bg-background px-3">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            value={value.q}
            onChange={(e) => onChange({ q: e.target.value })}
            placeholder="Search summary or subject id…"
            aria-label="Search findings"
            className="flex-1 bg-transparent px-2 py-2 outline-none text-sm"
          />
        </div>

        <Select
          value={value.status || ALL}
          onValueChange={(v) => onChange({ status: v === ALL ? "" : v })}
        >
          <SelectTrigger className="w-full md:w-[170px]" aria-label="Status filter">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All statuses</SelectItem>
            {STATUS_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={value.severity || ALL}
          onValueChange={(v) => onChange({ severity: v === ALL ? "" : v })}
        >
          <SelectTrigger className="w-full md:w-[170px]" aria-label="Severity filter">
            <SelectValue placeholder="Severity" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All severities</SelectItem>
            {SEVERITY_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={value.subjectType || ALL}
          onValueChange={(v) => onChange({ subjectType: v === ALL ? "" : v })}
        >
          <SelectTrigger className="w-full md:w-[170px]" aria-label="Subject type filter">
            <SelectValue placeholder="Subject type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All subjects</SelectItem>
            {SUBJECT_TYPE_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="w-full md:w-[190px]">
          <Input
            value={value.checkCode}
            onChange={(e) => onChange({ checkCode: e.target.value })}
            placeholder="Check code (e.g. C5)"
            aria-label="Check code filter"
            className="h-9"
          />
        </div>

        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="h-9" onClick={onRefresh}>
            <RefreshCw className="h-4 w-4 mr-1.5" />
            Refresh
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-9"
            onClick={onReset}
            disabled={!hasFilters}
          >
            <X className="h-4 w-4 mr-1.5" />
            Reset
          </Button>
        </div>
      </div>

      {qInvalid && (
        <p className="text-[11px] text-rose-600" role="alert">
          Search supports letters, numbers and spaces only, plus _ . / : @ # -
        </p>
      )}
      {checkCodeInvalid && (
        <p className="text-[11px] text-rose-600" role="alert">
          Check code supports letters, numbers and underscores (max 64).
        </p>
      )}
    </div>
  );
}

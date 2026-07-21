import { useState, useCallback, useEffect, useRef } from "react";
import { Search, X, CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";

export interface OrderFilterValues {
  search: string;
  status: string;
  vendorId: string;
  deliveryExecutiveId: string;
  paymentStatus: string;
  delayRisk: string;
  pickupArea: string;
  express: string;
  fromDate: string;
  toDate: string;
}

const defaultFilters: OrderFilterValues = {
  search: "",
  status: "",
  vendorId: "",
  deliveryExecutiveId: "",
  paymentStatus: "",
  delayRisk: "",
  pickupArea: "",
  express: "",
  fromDate: "",
  toDate: "",
};

interface Props {
  filters: OrderFilterValues;
  onChange: (filters: OrderFilterValues) => void;
  vendors: { id: string; name: string }[];
  deliveryExecutives: { id: string; name: string }[];
}

const STAGES = [
  "placed", "vendor_assigned", "vendor_accepted", "pickup_scheduled",
  "pickup_completed", "laundry_received", "sorting", "tagging",
  "washing", "drying", "ironing", "dry_cleaning", "quality_inspection",
  "packing", "ready_for_dispatch", "out_for_delivery", "delivered",
  "completed", "cancelled",
];

export function AdminOrderFilters({ filters, onChange, vendors, deliveryExecutives }: Props) {
  const [localSearch, setLocalSearch] = useState(filters.search);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const filtersRef = useRef(filters);
  filtersRef.current = filters;

  const update = useCallback((patch: Partial<OrderFilterValues>) => {
    onChange({ ...filtersRef.current, ...patch });
  }, [onChange]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      if (localSearch !== filtersRef.current.search) {
        onChange({ ...filtersRef.current, search: localSearch });
      }
    }, 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [localSearch]);

  useEffect(() => {
    setLocalSearch(filters.search);
  }, [filters.search]);

  const activeCount = [
    filters.status, filters.vendorId, filters.deliveryExecutiveId,
    filters.paymentStatus, filters.delayRisk, filters.pickupArea,
    filters.express, filters.fromDate, filters.toDate,
  ].filter(Boolean).length;

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by order code, customer or vendor..."
          value={localSearch}
          onChange={(e) => setLocalSearch(e.target.value)}
          className="pl-9 pr-8 h-9 text-sm"
        />
        {localSearch && (
          <button
            onClick={() => { setLocalSearch(""); update({ search: "" }); }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Select value={filters.status} onValueChange={(v) => update({ status: v })}>
          <SelectTrigger className="h-8 text-xs w-[130px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="" className="text-xs">All Statuses</SelectItem>
            <SelectItem value="active" className="text-xs">Active</SelectItem>
            <SelectItem value="delayed" className="text-xs">Delayed Risk</SelectItem>
            <SelectItem value="completed" className="text-xs">Completed</SelectItem>
            <SelectItem value="cancelled" className="text-xs">Cancelled</SelectItem>
            {STAGES.map((s) => (
              <SelectItem key={s} value={s} className="text-xs capitalize">{s.replace(/_/g, " ")}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filters.vendorId} onValueChange={(v) => update({ vendorId: v })}>
          <SelectTrigger className="h-8 text-xs w-[140px]">
            <SelectValue placeholder="Vendor" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="" className="text-xs">All Vendors</SelectItem>
            {vendors.map((v) => (
              <SelectItem key={v.id} value={v.id} className="text-xs">{v.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filters.deliveryExecutiveId} onValueChange={(v) => update({ deliveryExecutiveId: v })}>
          <SelectTrigger className="h-8 text-xs w-[150px]">
            <SelectValue placeholder="Delivery Exec" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="" className="text-xs">All Executives</SelectItem>
            {deliveryExecutives.map((ex) => (
              <SelectItem key={ex.id} value={ex.id} className="text-xs">{ex.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filters.paymentStatus} onValueChange={(v) => update({ paymentStatus: v })}>
          <SelectTrigger className="h-8 text-xs w-[130px]">
            <SelectValue placeholder="Payment" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="" className="text-xs">All Payments</SelectItem>
            <SelectItem value="paid" className="text-xs">Paid</SelectItem>
            <SelectItem value="pending" className="text-xs">Pending</SelectItem>
            <SelectItem value="refunded" className="text-xs">Refunded</SelectItem>
          </SelectContent>
        </Select>

        <Select value={filters.delayRisk} onValueChange={(v) => update({ delayRisk: v })}>
          <SelectTrigger className="h-8 text-xs w-[110px]">
            <SelectValue placeholder="Delay Risk" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="" className="text-xs">All Risks</SelectItem>
            <SelectItem value="low" className="text-xs">Low</SelectItem>
            <SelectItem value="medium" className="text-xs">Medium</SelectItem>
            <SelectItem value="high" className="text-xs">High</SelectItem>
          </SelectContent>
        </Select>

        <div className="flex items-center gap-1.5">
          <Checkbox
            id="express-filter"
            checked={filters.express === "true"}
            onCheckedChange={(v) => update({ express: v ? "true" : "" })}
            className="h-4 w-4"
          />
          <Label htmlFor="express-filter" className="text-xs cursor-pointer">Express</Label>
        </div>

        <Input
          placeholder="Area..."
          value={filters.pickupArea}
          onChange={(e) => update({ pickupArea: e.target.value })}
          className="h-8 text-xs w-[100px]"
        />

        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="h-8 text-xs gap-1 font-normal">
              <CalendarIcon className="h-3.5 w-3.5" />
              {filters.fromDate ? new Date(filters.fromDate).toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : "From"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={filters.fromDate ? new Date(filters.fromDate) : undefined}
              onSelect={(d) => update({ fromDate: d ? d.toISOString().split("T")[0] : "" })}
            />
          </PopoverContent>
        </Popover>

        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="h-8 text-xs gap-1 font-normal">
              <CalendarIcon className="h-3.5 w-3.5" />
              {filters.toDate ? new Date(filters.toDate).toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : "To"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={filters.toDate ? new Date(filters.toDate) : undefined}
              onSelect={(d) => update({ toDate: d ? d.toISOString().split("T")[0] : "" })}
            />
          </PopoverContent>
        </Popover>

        {activeCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="h-8 text-xs text-muted-foreground gap-1"
            onClick={() => onChange(defaultFilters)}
          >
            <X className="h-3.5 w-3.5" />
            Clear {activeCount > 0 && <Badge variant="secondary" className="ml-0.5 text-[10px] px-1">{activeCount}</Badge>}
          </Button>
        )}
      </div>
    </div>
  );
}

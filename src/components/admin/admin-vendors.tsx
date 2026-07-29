import { useState, useEffect } from "react";
import { Search, UserCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useVendors } from "@/lib/hooks";
import { cn, formatINR } from "@/lib/utils";
import { toast } from "sonner";
import type { Vendor } from "@/lib/types";

export function AdminVendors() {
  const { data: vendorsList } = useVendors();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [vendors, setVendors] = useState<Vendor[]>(() => vendorsList || []);

  useEffect(() => {
    if (vendorsList) setVendors(vendorsList);
  }, [vendorsList]);

  const filteredVendors = vendors.filter((v) => {
    const matchesSearch = !search ||
      v.name.toLowerCase().includes(search.toLowerCase()) ||
      v.area.toLowerCase().includes(search.toLowerCase()) ||
      v.city.toLowerCase().includes(search.toLowerCase());
    const matchesStatus =
      statusFilter === "all" ||
      (statusFilter === "verified" && v.kycStatus === "approved") ||
      (statusFilter === "pending" && v.kycStatus === "pending") ||
      (statusFilter === "suspended" && v.kycStatus === "rejected");
    return matchesSearch && matchesStatus;
  });

  const handleApprove = (vendorId: string) => {
    const vendor = vendors.find((v) => v.id === vendorId);
    setVendors((prev) => prev.map((v) => v.id === vendorId ? { ...v, kycStatus: "approved" as const } : v));
    toast.success(`Vendor ${vendor?.name} approved`, { description: "Welcome email sent." });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row gap-3">
        <div className="flex-1 flex items-center rounded-lg border border-input bg-background px-3">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search vendors by name, area, city…"
            className="flex-1 bg-transparent px-2 py-2 outline-none text-sm"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All vendors</SelectItem>
            <SelectItem value="verified">Verified</SelectItem>
            <SelectItem value="pending">KYC pending</SelectItem>
            <SelectItem value="suspended">Suspended</SelectItem>
          </SelectContent>
        </Select>
        <Button className="bg-primary hover:bg-primary/90" onClick={() => toast.success("Onboarding form opened", { description: "Use the Super Admin panel to onboard new vendors." })}>
          <UserCheck className="h-4 w-4 mr-1.5" />
          Onboard Vendor
        </Button>
      </div>

      <div className="text-xs text-muted-foreground">
        Showing <strong className="text-foreground">{filteredVendors.length}</strong> of {vendors.length} vendors
        {(search || statusFilter !== "all") && (
          <button onClick={() => { setSearch(""); setStatusFilter("all"); }} className="ml-2 text-primary hover:underline">Clear filters</button>
        )}
      </div>

      <Card className="shadow-soft overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left p-3 font-medium text-xs text-muted-foreground">Vendor</th>
                <th className="text-left p-3 font-medium text-xs text-muted-foreground">Location</th>
                <th className="text-center p-3 font-medium text-xs text-muted-foreground">Rating</th>
                <th className="text-center p-3 font-medium text-xs text-muted-foreground">Orders</th>
                <th className="text-right p-3 font-medium text-xs text-muted-foreground">Monthly Revenue</th>
                <th className="text-center p-3 font-medium text-xs text-muted-foreground">KYC</th>
                <th className="text-right p-3 font-medium text-xs text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredVendors.length === 0 ? (
                <tr><td colSpan={7} className="p-8 text-center text-muted-foreground text-sm">No vendors match your filters.</td></tr>
              ) : (
                filteredVendors.map((v) => (
                  <tr key={v.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <div className={cn("flex h-9 w-9 items-center justify-center rounded-lg bg-primary-surface text-primary-foreground text-xs font-semibold", v.logoColor)}>
                          {v.logoInitials}
                        </div>
                        <div>
                          <p className="font-medium">{v.name}</p>
                          <p className="text-[11px] text-muted-foreground">Joined {new Date(v.joinedDate).toLocaleDateString("en-IN", { month: "short", year: "numeric" })}</p>
                        </div>
                      </div>
                    </td>
                    <td className="p-3 text-muted-foreground">{v.area}, {v.city}</td>
                    <td className="p-3 text-center">
                      <span className="font-semibold">{v.rating}★</span>
                      <p className="text-[10px] text-muted-foreground">{v.reviewCount}</p>
                    </td>
                    <td className="p-3 text-center font-medium">{v.totalOrders.toLocaleString()}</td>
                    <td className="p-3 text-right font-semibold">{formatINR(v.monthlyRevenue)}</td>
                    <td className="p-3 text-center">
                      <Badge variant="outline" className={cn(
                        "text-[10px]",
                        v.kycStatus === "approved" && "border-emerald-300 text-emerald-700 bg-emerald-50 dark:bg-emerald-950/30",
                        v.kycStatus === "pending" && "border-amber-300 text-amber-700 bg-amber-50 dark:bg-amber-950/30",
                        v.kycStatus === "rejected" && "border-rose-300 text-rose-700 bg-rose-50 dark:bg-rose-950/30",
                      )}>
                        {v.kycStatus}
                      </Badge>
                    </td>
                    <td className="p-3 text-right whitespace-nowrap">
                      <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => toast.info(`Viewing ${v.name}`, { description: `${v.area}, ${v.city} · ${v.totalOrders.toLocaleString()} orders · ${v.rating}★` })}>View</Button>
                      {v.kycStatus === "pending" && (
                        <Button size="sm" variant="outline" className="h-7 ml-1 text-xs" onClick={() => handleApprove(v.id)}>
                          Approve
                        </Button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

import { useEffect, useState } from "react";
import { Store, Package, Search, Loader2 } from "lucide-react";
import { useAppStore } from "@/lib/store";
import { api } from "@/lib/api/client";
import type { Vendor, Order } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Icon } from "./icon";
import type { NavGroup } from "./app-shell";

interface SearchResultsProps {
  query: string;
  groups: NavGroup[];
  onNavigate: (view: string) => void;
}

const VENDOR_TARGET: Record<string, string> = {
  customer: "discover",
  vendor: "services",
  admin: "vendors",
  superadmin: "vendors",
  delivery: "dashboard",
};

export function SearchResults({ query, groups, onNavigate }: SearchResultsProps) {
  const { role, userId, setPendingSearchQuery } = useAppStore();
  const [vendors, setVendors] = useState<Vendor[] | null>(null);
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const q = query.toLowerCase();
  const seen = new Set<string>();
  const navMatches = groups.flatMap((g) =>
    g.items
      .filter((item) => item.label.toLowerCase().includes(q))
      .filter((item) => (seen.has(item.id) ? false : (seen.add(item.id), true)))
      .map((item) => ({ ...item, group: g.label }))
  );

  useEffect(() => {
    let cancelled = false;
    setVendors(null);
    setOrders(null);
    setError(null);

    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const vendorUrl = `/api/vendors?search=${encodeURIComponent(query)}&limit=5`;
        const vendorsRes = await api.get<Vendor[]>(vendorUrl);
        if (cancelled) return;
        setVendors(vendorsRes);

        let ordersUrl: string | null = null;
        if (role === "customer" && userId) {
          ordersUrl = `/api/orders?search=${encodeURIComponent(query)}&limit=5`;
        } else if (role === "vendor" && userId) {
          const mine = await api.get<{ id: string }[]>(`/api/vendors?owner_id=${userId}`);
          const vid = mine?.[0]?.id;
          if (cancelled) return;
          if (vid) ordersUrl = `/api/orders?vendorId=${vid}&search=${encodeURIComponent(query)}&limit=5`;
        } else if (role === "admin") {
          ordersUrl = `/api/admin/orders?search=${encodeURIComponent(query)}&limit=5`;
        }

        if (ordersUrl) {
          const ordersRes = await api.get<Order[]>(ordersUrl);
          if (cancelled) return;
          setOrders(ordersRes);
        } else {
          setOrders([]);
        }
      } catch (err) {
        console.error("[search] fetch error", err);
        if (!cancelled) {
          setError("Search failed. Please try again.");
          setVendors([]);
          setOrders([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 300);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, role, userId]);

  const openVendor = () => {
    const target = VENDOR_TARGET[role] || "dashboard";
    setPendingSearchQuery(query);
    onNavigate(target);
  };

  const openOrders = () => {
    setPendingSearchQuery(query);
    onNavigate("orders");
  };

  const vendorTarget = VENDOR_TARGET[role];
  const hasVendors = (vendors?.length || 0) > 0;
  const hasOrders = (orders?.length || 0) > 0;
  const done = vendors !== null && (role === "delivery" || role === "superadmin" || orders !== null);

  return (
    <div className="space-y-6 pb-16">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Search className="h-4 w-4" />
        <span>
          Results for <strong className="text-foreground">“{query}”</strong>
        </span>
        {loading && <Loader2 className="h-3.5 w-3.5 animate-spin ml-1" />}
      </div>

      {error && (
        <div className="rounded-xl border border-dashed border-rose-200 bg-rose-50/50 p-8 text-center text-sm text-rose-600 dark:border-rose-900/40 dark:bg-rose-950/20 dark:text-rose-400">
          {error}
        </div>
      )}

      {navMatches.length > 0 && (
        <section>
          <h2 className="text-[13px] font-semibold uppercase tracking-wide text-muted-foreground mb-3">Go to</h2>
          <div className="divide-y rounded-xl border bg-card">
            {navMatches.map((item) => (
              <button
                key={item.id}
                onClick={() => {
                  if (item.id === "discover") setPendingSearchQuery(query);
                  onNavigate(item.id);
                }}
                className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-tonal transition-colors"
              >
                <Icon name={item.icon} className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="text-[13px] font-medium">{item.label}</span>
                {item.badge !== undefined && (
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                    {item.badge}
                  </span>
                )}
                <span className="ml-auto text-xs text-muted-foreground/60">{item.group}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      {!error && done && !hasVendors && !hasOrders && navMatches.length === 0 && (
        <div className="rounded-xl border border-dashed p-10 text-center">
          <p className="text-sm text-muted-foreground">No vendors or orders match “{query}”.</p>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
            {vendorTarget && (
              <button onClick={openVendor} className="text-xs font-medium text-primary hover:underline">
                Browse all vendors
              </button>
            )}
            {(role === "customer" || role === "vendor" || role === "admin") && (
              <>
                {vendorTarget && <span className="text-muted-foreground/40">·</span>}
                <button onClick={openOrders} className="text-xs font-medium text-primary hover:underline">
                  Browse all orders
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {vendorTarget && (
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-[13px] font-semibold uppercase tracking-wide text-muted-foreground">Vendors</h2>
            {hasVendors && (
              <button onClick={openVendor} className="text-xs text-primary hover:underline">
                See all vendors
              </button>
            )}
          </div>
          {vendors === null ? (
            <div className="h-24 animate-pulse rounded-xl bg-tonal" />
          ) : vendors.length === 0 ? (
            <p className="text-sm text-muted-foreground/70">No vendors found.</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {vendors.map((v) => (
                <button
                  key={v.id}
                  onClick={openVendor}
                  className="flex items-center gap-3 rounded-xl border bg-card p-4 text-left shadow-soft hover:border-primary/40 hover:bg-tonal transition-colors"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary-surface text-white">
                    <Store className="h-4.5 w-4.5" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{v.name}</p>
                    <p className="truncate text-xs text-muted-foreground">{v.area}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </section>
      )}

      {(role === "customer" || role === "vendor" || role === "admin") && (
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-[13px] font-semibold uppercase tracking-wide text-muted-foreground">Orders</h2>
            {hasOrders && (
              <button onClick={openOrders} className="text-xs text-primary hover:underline">
                See all orders
              </button>
            )}
          </div>
          {orders === null ? (
            <div className="h-24 animate-pulse rounded-xl bg-tonal" />
          ) : orders.length === 0 ? (
            <p className="text-sm text-muted-foreground/70">No orders found.</p>
          ) : (
            <div className="divide-y rounded-xl border bg-card">
              {orders.map((o) => (
                <button
                  key={o.id}
                  onClick={openOrders}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-tonal transition-colors"
                >
                  <Package className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="font-mono text-[13px] font-medium">{o.code}</span>
                  <span className="truncate text-xs text-muted-foreground">
                    {o.customerName}
                    {o.vendorName ? ` · ${o.vendorName}` : ""}
                  </span>
                  {o.status && (
                    <span
                      className={cn(
                        "ml-auto shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium capitalize",
                        o.status === "delivered" || o.status === "completed"
                          ? "bg-emerald-500/10 text-emerald-600"
                          : o.status === "cancelled"
                            ? "bg-rose-500/10 text-rose-600"
                            : "bg-muted text-muted-foreground"
                      )}
                    >
                      {o.status}
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}

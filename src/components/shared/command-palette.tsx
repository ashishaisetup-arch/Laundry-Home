import { useMemo } from "react";
import {
  Store,
  Package,
  Sparkles,
  User,
  Settings,
  Moon,
  Sun,
  LogOut,
} from "lucide-react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { useAppStore } from "@/lib/store";
import { useFetch } from "@/lib/hooks/use-fetch";
import type { Vendor, Order } from "@/lib/types";
import { Icon } from "./icon";
import type { NavGroup } from "./app-shell";

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groups: NavGroup[];
  onNavigate: (view: string) => void;
}

export function CommandPalette({ open, onOpenChange, groups, onNavigate }: CommandPaletteProps) {
  const { role, userId, theme, toggleAi, toggleTheme, logout } = useAppStore();

  const vendorsResult = useFetch<Vendor[]>("/api/vendors");
  const vendors = vendorsResult.data || [];

  const myVendorResult = useFetch<{ id: string }[]>(
    role === "vendor" && userId ? `/api/vendors?owner_id=${userId}` : null
  );
  const vendorId = (myVendorResult.data || [])[0]?.id;

  const ordersUrl = useMemo(() => {
    if (!userId) return null;
    if (role === "customer") return "/api/orders?limit=20";
    if (role === "vendor") return vendorId ? `/api/orders?vendorId=${vendorId}&limit=20` : null;
    if (role === "admin") return "/api/admin/orders?limit=20";
    return null;
  }, [role, userId, vendorId]);

  const ordersResult = useFetch<Order[]>(ordersUrl);
  const orders = ordersResult.data || [];

  const navItems = useMemo(
    () => groups.flatMap((g) => g.items.map((item) => ({ ...item, group: g.label }))),
    [groups]
  );

  const close = () => onOpenChange(false);

  const go = (view: string) => {
    close();
    onNavigate(view);
  };

  const vendorTarget: Record<string, string> = {
    customer: "discover",
    vendor: "services",
    admin: "vendors",
    superadmin: "vendors",
  };

  const actions = [
    { id: "ai", label: "AI Assistant", icon: <Sparkles className="h-4 w-4" />, run: () => { close(); toggleAi(); } },
    { id: "profile", label: "Profile", icon: <User className="h-4 w-4" />, run: () => go("profile") },
    { id: "settings", label: "Settings", icon: <Settings className="h-4 w-4" />, run: () => go("settings") },
    {
      id: "theme",
      label: theme === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode",
      icon: theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />,
      run: () => { close(); toggleTheme(); },
    },
    { id: "logout", label: "Sign out", icon: <LogOut className="h-4 w-4" />, run: () => { close(); logout(); } },
  ];

  const showOrders = role === "customer" || role === "vendor" || role === "admin";
  const showVendors = !!vendorTarget[role];

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Search pages, vendors, orders, actions…" />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        {navItems.length > 0 && (
          <CommandGroup heading="Go to">
            {navItems.map((item) => (
              <CommandItem
                key={`nav-${item.id}`}
                value={`nav ${item.label} ${item.id}`}
                onSelect={() => go(item.id)}
              >
                <Icon name={item.icon} className="mr-2 h-4 w-4" />
                <span>{item.label}</span>
                <span className="ml-auto text-xs text-muted-foreground/60">{item.group}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
        {showVendors && vendors.length > 0 && (
          <CommandGroup heading="Vendors">
            {vendors.slice(0, 10).map((v) => (
              <CommandItem
                key={`vendor-${v.id}`}
                value={`vendor ${v.name} ${v.area} ${v.category || ""}`}
                onSelect={() => go(vendorTarget[role])}
              >
                <Store className="mr-2 h-4 w-4" />
                <span>{v.name}</span>
                <span className="ml-auto text-xs text-muted-foreground/60">{v.area}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
        {showOrders && orders.length > 0 && (
          <CommandGroup heading="Orders">
            {orders.slice(0, 10).map((o) => (
              <CommandItem
                key={`order-${o.id}`}
                value={`order ${o.code} ${o.customerName || ""} ${o.vendorName || ""} ${o.status || ""}`}
                onSelect={() => go("orders")}
              >
                <Package className="mr-2 h-4 w-4" />
                <span className="font-mono">{o.code}</span>
                <span className="ml-2 text-xs text-muted-foreground/70">{o.customerName}</span>
                <span className="ml-auto text-xs text-muted-foreground/60">{o.status}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
        <CommandSeparator />
        <CommandGroup heading="Actions">
          {actions.map((a) => (
            <CommandItem key={`action-${a.id}`} value={`action ${a.label}`} onSelect={a.run}>
              {a.icon}
              <span className="ml-2">{a.label}</span>
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}

"use client";

import {
  User,
  Store,
  Bike,
  Shield,
  Crown,
  ArrowRightLeft,
} from "lucide-react";
import { useAppStore } from "@/lib/store";
import type { Role } from "@/lib/types";
import { cn } from "@/lib/utils";

const ROLES: { id: Role; label: string; icon: React.ComponentType<{ className?: string }>; desc: string }[] = [
  { id: "customer", label: "Customer", icon: User, desc: "Book & track laundry" },
  { id: "vendor", label: "Vendor", icon: Store, desc: "Manage operations" },
  { id: "delivery", label: "Delivery Exec", icon: Bike, desc: "Pickups & deliveries" },
  { id: "admin", label: "Admin", icon: Shield, desc: "Control center" },
  { id: "superadmin", label: "Super Admin", icon: Crown, desc: "Unrestricted access" },
];

export function RoleSwitcher({ compact = false }: { compact?: boolean }) {
  const { role, switchRole } = useAppStore();

  if (compact) {
    return (
      <div className="grid grid-cols-2 gap-1">
        {ROLES.map((r) => (
          <button
            key={r.id}
            onClick={() => switchRole(r.id)}
            className={cn(
              "flex items-center gap-2 rounded-md px-2 py-1.5 text-xs font-medium transition-colors",
              role === r.id
                ? "bg-primary text-primary-foreground"
                : "hover:bg-muted"
            )}
          >
            <r.icon className="h-3.5 w-3.5" />
            {r.label}
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground px-2 pb-1 flex items-center gap-1.5">
        <ArrowRightLeft className="h-3 w-3" />
        Switch Role (Demo)
      </p>
      {ROLES.map((r) => (
        <button
          key={r.id}
          onClick={() => switchRole(r.id)}
          className={cn(
            "w-full flex items-center gap-3 rounded-md px-2 py-2 text-left transition-colors",
            role === r.id
              ? "bg-primary/10 text-primary"
              : "hover:bg-muted"
          )}
        >
          <r.icon className="h-4 w-4 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium leading-tight">{r.label}</p>
            <p className="text-[11px] text-muted-foreground leading-tight">{r.desc}</p>
          </div>
          {role === r.id && (
            <span className="h-1.5 w-1.5 rounded-full bg-primary" />
          )}
        </button>
      ))}
    </div>
  );
}

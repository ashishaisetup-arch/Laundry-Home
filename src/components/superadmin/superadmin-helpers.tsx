import { type NavGroup } from "@/components/shared/app-shell";

export const NAV_GROUPS: NavGroup[] = [
  {
    label: "Super Admin",
    items: [
      { id: "dashboard", label: "Control Center", icon: "LayoutDashboard" },
      { id: "onboard", label: "Onboard Vendor", icon: "Store", badge: "New" },
      { id: "vendors", label: "Vendors", icon: "Store" },
      { id: "areas", label: "Locations", icon: "MapPin" },
      { id: "rbac", label: "Roles & Permissions", icon: "Shield" },
      { id: "users", label: "User Management", icon: "UserCog" },
      { id: "audit", label: "Audit Logs", icon: "ScrollText" },
      { id: "features", label: "Feature Flags", icon: "Flag" },
      { id: "catalog", label: "Service Catalog", icon: "Package" },
      { id: "integrations", label: "API & Webhooks", icon: "Plug" },
      { id: "system", label: "System Config", icon: "Settings" },
    ],
  },
];

export function pageTitle(view: string) {
  return {
      dashboard: "Control Center",
    vendors: "Vendors",
    areas: "Locations",
    rbac: "Roles & Permissions",
    users: "User Management",
    audit: "Audit Logs",
    features: "Feature Flags",
    catalog: "Service Catalog",
    integrations: "API & Webhooks",
    system: "System Configuration",
    profile: "My Profile",
    settings: "Settings",
  }[view] || "Super Admin";
}

export function pageSubtitle(view: string) {
  return {
      dashboard: "Super Admin · Full platform access",
    profile: "Manage your account details",
    settings: "Account and app preferences",
    vendors: "All platform vendors · KYC status, approvals and management",
    areas: "Manage cities, service areas and vendor coverage",
    rbac: "Configure role-based access control across all modules",
    users: "Manage platform users, staff and administrators",
    audit: "Track every action across the platform",
    features: "Toggle features on/off without deploying",
    catalog: "Manage service categories, services and item pricing",
    integrations: "API keys, third-party integrations and webhooks",
    system: "Global platform settings and configuration",
  }[view];
}

export function Crown({ className }: { className?: string }) {
  return (
    <svg className={className} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M2 4l3 12h14l3-12-6 7-4-7-4 7-6-7zm3 16h14" />
    </svg>
  );
}

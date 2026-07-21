
import {
  WashingMachine,
  Shirt,
  Sparkles,
  Wind,
  Crown,
  Feather,
  Footprints,
  BedDouble,
  Blinds,
  Square,
  Package,
} from "lucide-react";
import type { ServiceKey } from "@/lib/types";
import { cn } from "@/lib/utils";

const ICON_MAP: Record<string, React.ComponentType<{ className?: string; size?: number }>> = {
  WashingMachine,
  Shirt,
  Sparkles,
  Wind,
  Crown,
  Feather,
  Footprints,
  BedDouble,
  Blinds,
  Square,
  Package,
};

const SERVICE_ICON_KEYS: Record<string, string> = {
  wash_fold: "WashingMachine",
  wash_iron: "Shirt",
  dry_cleaning: "Sparkles",
  steam_ironing: "Wind",
  premium_care: "Crown",
  delicate_care: "Feather",
  shoe_cleaning: "Footprints",
  blanket: "BedDouble",
  curtain: "Blinds",
  carpet: "Square",
  bulk: "Package",
};

interface ServiceIconProps {
  serviceKey: ServiceKey;
  className?: string;
  size?: number;
  withGradient?: boolean;
}

export function ServiceIcon({ serviceKey, className, size = 20, withGradient = false }: ServiceIconProps) {
  const iconKey = SERVICE_ICON_KEYS[serviceKey];
  if (!iconKey) return null;
  const Icon = ICON_MAP[iconKey] || Package;

  if (withGradient) {
    return (
      <div className={cn("flex items-center justify-center rounded-xl bg-tonal-accent text-primary", className)}>
        <Icon className="h-5 w-5" />
      </div>
    );
  }

  return <Icon className={className} size={size} />;
}

export function getServiceMeta(key: ServiceKey) {
  const iconKey = SERVICE_ICON_KEYS[key];
  return { key, icon: iconKey || "Package" };
}

"use client";

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
import { SERVICES } from "@/lib/mock-data";
import { cn } from "@/lib/utils";

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
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

interface ServiceIconProps {
  serviceKey: ServiceKey;
  className?: string;
  size?: number;
  withGradient?: boolean;
}

export function ServiceIcon({ serviceKey, className, size = 20, withGradient = false }: ServiceIconProps) {
  const service = SERVICES.find((s) => s.key === serviceKey);
  if (!service) return null;
  const Icon = ICON_MAP[service.icon] || Package;

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
  return SERVICES.find((s) => s.key === key)!;
}

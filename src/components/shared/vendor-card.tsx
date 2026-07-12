"use client";

import { motion } from "framer-motion";
import { Star, Clock, MapPin, BadgeCheck, Zap, Heart } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Vendor } from "@/lib/types";
import { cn, formatINR } from "@/lib/utils";

interface VendorCardProps {
  vendor: Vendor;
  onView?: () => void;
  onBook?: () => void;
  isSelected?: boolean;
  className?: string;
}

export function VendorCard({ vendor, onView, onBook, isSelected, className }: VendorCardProps) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -3 }}
      transition={{ duration: 0.2 }}
    >
      <Card
        className={cn(
          "relative overflow-hidden p-0 transition-all",
          isSelected ? "ring-2 ring-primary shadow-glow" : "shadow-soft hover:shadow-glow",
          className
        )}
      >
        {/* Header band */}
        <div className={cn("h-20 bg-gradient-to-br relative", vendor.logoColor)}>
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_30%,rgba(255,255,255,0.2),transparent_50%)]" />
          {vendor.verified && (
            <Badge className="absolute top-3 right-3 bg-white/20 backdrop-blur text-white border-0 gap-1">
              <BadgeCheck className="h-3 w-3" />
              Verified
            </Badge>
          )}
          <div className="absolute -bottom-6 left-5">
            <div className={cn(
              "flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-br shadow-lg ring-4 ring-card text-white font-bold text-lg",
              vendor.logoColor
            )}>
              {vendor.logoInitials}
            </div>
          </div>
        </div>

        <div className="p-5 pt-8">
          <div className="flex items-start justify-between gap-2 mb-1">
            <div className="min-w-0">
              <h3 className="font-semibold text-base leading-tight truncate">{vendor.name}</h3>
              <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                <MapPin className="h-3 w-3" />
                {vendor.area} · {vendor.distanceKm} km
              </div>
            </div>
            <Button variant="ghost" size="icon" className="h-7 w-7 -mr-1 -mt-1">
              <Heart className="h-4 w-4 text-muted-foreground hover:text-rose-500" />
            </Button>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-3 gap-2 my-3">
            <div className="rounded-lg bg-muted/50 px-2 py-1.5 text-center">
              <div className="flex items-center justify-center gap-0.5 text-sm font-semibold text-amber-600">
                <Star className="h-3 w-3 fill-amber-500 text-amber-500" />
                {vendor.rating}
              </div>
              <p className="text-[10px] text-muted-foreground mt-0.5">{vendor.reviewCount} reviews</p>
            </div>
            <div className="rounded-lg bg-muted/50 px-2 py-1.5 text-center">
              <div className="flex items-center justify-center gap-0.5 text-sm font-semibold">
                <Clock className="h-3 w-3" />
                {vendor.estimatedDeliveryHrs}h
              </div>
              <p className="text-[10px] text-muted-foreground mt-0.5">delivery</p>
            </div>
            <div className="rounded-lg bg-muted/50 px-2 py-1.5 text-center">
              <div className="text-sm font-semibold">
                {"₹".repeat(vendor.priceLevel)}
              </div>
              <p className="text-[10px] text-muted-foreground mt-0.5">price level</p>
            </div>
          </div>

          {/* Tags */}
          <div className="flex flex-wrap gap-1 mb-3">
            {vendor.tags.slice(0, 3).map((tag) => (
              <Badge key={tag} variant="secondary" className="text-[10px] font-medium">
                {tag}
              </Badge>
            ))}
          </div>

          {/* Capacity indicator */}
          <div className="mb-3">
            <div className="flex items-center justify-between text-[11px] mb-1">
              <span className="text-muted-foreground">Current capacity</span>
              <span className="font-medium">
                {vendor.capacityUsedPct}% {vendor.capacityUsedPct > 80 ? "(busy)" : ""}
              </span>
            </div>
            <div className="h-1.5 rounded-full bg-muted overflow-hidden">
              <div
                className={cn(
                  "h-full rounded-full bg-gradient-to-r",
                  vendor.capacityUsedPct > 80 ? "from-amber-400 to-rose-500" :
                  vendor.capacityUsedPct > 60 ? "from-teal-400 to-amber-400" :
                  "from-teal-400 to-emerald-500"
                )}
                style={{ width: `${vendor.capacityUsedPct}%` }}
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="flex-1" onClick={onView}>
              View
            </Button>
            <Button
              size="sm"
              className="flex-1 bg-gradient-to-r from-teal-500 to-cyan-600 hover:opacity-90"
              onClick={onBook}
              disabled={!vendor.isOpen}
            >
              {vendor.isOpen ? "Book Now" : "Closed"}
            </Button>
          </div>
        </div>
      </Card>
    </motion.div>
  );
}

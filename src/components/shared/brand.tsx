"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

// ============================================================================
// Animated gradient orb (decorative background)
// ============================================================================
export function GradientOrb({ className }: { className?: string }) {
  return (
    <div className={cn("pointer-events-none absolute overflow-hidden", className)}>
      <motion.div
        className="h-full w-full rounded-full opacity-50 blur-3xl"
        style={{
          background:
            "radial-gradient(circle at 30% 30%, oklch(0.62 0.13 180), transparent 60%)",
        }}
        animate={{
          scale: [1, 1.1, 1],
          opacity: [0.3, 0.5, 0.3],
        }}
        transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
      />
    </div>
  );
}

// ============================================================================
// Logo mark
// ============================================================================
export function LogoMark({ className, size = 32 }: { className?: string; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <defs>
        <linearGradient id="lh-grad" x1="0" y1="0" x2="48" y2="48">
          <stop stopColor="#14b8a6" />
          <stop offset="0.5" stopColor="#10b981" />
          <stop offset="1" stopColor="#06b6d4" />
        </linearGradient>
      </defs>
      <rect width="48" height="48" rx="14" fill="url(#lh-grad)" />
      <circle cx="24" cy="24" r="11" stroke="white" strokeWidth="2.5" fill="none" opacity="0.95" />
      <circle cx="24" cy="24" r="5.5" fill="white" opacity="0.95" />
      <circle cx="20.5" cy="20.5" r="1.6" fill="#0d9488" />
      <circle cx="27" cy="22" r="1.1" fill="#0d9488" opacity="0.6" />
      <rect x="34" y="13" width="3" height="3" rx="1" fill="white" opacity="0.95" />
    </svg>
  );
}

// ============================================================================
// Brand lockup
// ============================================================================
export function BrandLockup({
  className,
  size = "md",
}: {
  className?: string;
  size?: "sm" | "md" | "lg";
}) {
  const dims = {
    sm: { logo: 24, text: "text-base", weight: "font-semibold" },
    md: { logo: 32, text: "text-lg", weight: "font-bold" },
    lg: { logo: 44, text: "text-2xl", weight: "font-extrabold" },
  }[size];

  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <LogoMark size={dims.logo} />
      <div className={cn(dims.text, dims.weight, "tracking-tight")}>
        <span className="text-foreground">Laundry</span>
        <span className="text-primary"> Home</span>
      </div>
    </div>
  );
}

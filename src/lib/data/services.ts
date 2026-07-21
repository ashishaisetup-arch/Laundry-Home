import type { ServiceType, ServiceKey } from "@/lib/types";

export const SERVICES: ServiceType[] = [
  { key: "wash_fold", name: "Wash & Fold", description: "Daily wear washed with care, tumble-dried and neatly folded.", icon: "WashingMachine", pricingType: "per_kg", basePrice: 60, expressMultiplier: 1.5, gradient: "from-teal-400 to-cyan-500", category: "everyday" },
  { key: "wash_iron", name: "Wash & Iron", description: "Crisply pressed shirts and formals, ready to wear.", icon: "Shirt", pricingType: "per_piece", basePrice: 15, expressMultiplier: 1.5, gradient: "from-emerald-400 to-teal-500", category: "everyday" },
  { key: "dry_cleaning", name: "Dry Cleaning", description: "Solvent-based care for suits, sarees and delicate fabrics.", icon: "Sparkles", pricingType: "per_piece", basePrice: 120, expressMultiplier: 1.8, gradient: "from-violet-400 to-purple-500", category: "premium" },
  { key: "steam_ironing", name: "Steam Ironing", description: "Professional steam press for a flawless finish.", icon: "Wind", pricingType: "per_piece", basePrice: 18, expressMultiplier: 1.6, gradient: "from-sky-400 to-cyan-500", category: "everyday" },
  { key: "premium_care", name: "Premium Garment Care", description: "Bespoke treatment for designer and luxury garments.", icon: "Crown", pricingType: "per_piece", basePrice: 250, expressMultiplier: 2, gradient: "from-amber-400 to-orange-500", category: "premium" },
  { key: "delicate_care", name: "Delicate Fabric Care", description: "Hand-finished care for silks, lace and woolens.", icon: "Feather", pricingType: "per_piece", basePrice: 180, expressMultiplier: 1.8, gradient: "from-pink-400 to-rose-500", category: "premium" },
  { key: "shoe_cleaning", name: "Shoe Cleaning", description: "Sneakers, formals and heels — refreshed and deodorised.", icon: "Footprints", pricingType: "per_piece", basePrice: 149, expressMultiplier: 1.5, gradient: "from-slate-400 to-slate-600", category: "specialty" },
  { key: "blanket", name: "Blanket Cleaning", description: "Deep-clean bulky blankets, quilts and comforters.", icon: "BedDouble", pricingType: "per_piece", basePrice: 199, expressMultiplier: 1.4, gradient: "from-orange-400 to-red-500", category: "specialty" },
  { key: "curtain", name: "Curtain Cleaning", description: "On-site pickup and pressing for curtains and drapes.", icon: "Blinds", pricingType: "per_piece", basePrice: 220, expressMultiplier: 1.4, gradient: "from-lime-400 to-emerald-500", category: "specialty" },
  { key: "carpet", name: "Carpet Cleaning", description: "Hot-extraction cleaning for rugs and carpets.", icon: "Square", pricingType: "per_piece", basePrice: 499, expressMultiplier: 1.3, gradient: "from-rose-400 to-pink-500", category: "specialty" },
  { key: "bulk", name: "Bulk Laundry", description: "Volume pricing for hostels, PGs and offices.", icon: "Package", pricingType: "per_kg", basePrice: 45, expressMultiplier: 1.2, gradient: "from-cyan-400 to-blue-500", category: "bulk" },
];

export const SERVICE_KEYS: ServiceKey[] = SERVICES.map((s) => s.key);

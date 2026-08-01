import { MapPin, Truck, Sparkles, Shield } from "lucide-react";

export const FEATURES = [
  { icon: MapPin, title: "Verified vendors near you", desc: "AI-matched to your location, ratings and budget." },
  { icon: Truck, title: "Doorstep pickup & delivery", desc: "Live 18-stage tracking from pickup to delivery." },
  { icon: Sparkles, title: "AI-powered intelligence", desc: "Smart vendor assignment, delay prediction, demand forecasting." },
  { icon: Shield, title: "Bank-grade security", desc: "OAuth 2.0, OpenID Connect, JWT with MFA." },
];

export const SERVICES = [
  { name: "Wash & Fold", price: "₹60/kg", icon: "🫧" },
  { name: "Wash & Iron", price: "₹15/piece", icon: "👔" },
  { name: "Dry Cleaning", price: "₹120/piece", icon: "✨" },
  { name: "Premium Care", price: "₹250/piece", icon: "👑" },
  { name: "Shoe Cleaning", price: "₹149/piece", icon: "👟" },
  { name: "Bulk Laundry", price: "₹45/kg", icon: "📦" },
];

export type AuthMethod = "otp" | "google" | "apple" | "microsoft" | "email";
export type AuthStep = "method" | "otp" | "password" | "forgot";

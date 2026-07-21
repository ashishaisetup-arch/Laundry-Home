// ============================================================================
// Laundry Home — Central Type Definitions
// ============================================================================

export type Role =
  | "guest"
  | "customer"
  | "vendor"
  | "delivery"
  | "admin"
  | "superadmin";

export type ServiceKey =
  | "wash_fold"
  | "wash_iron"
  | "dry_cleaning"
  | "steam_ironing"
  | "premium_care"
  | "delicate_care"
  | "shoe_cleaning"
  | "blanket"
  | "curtain"
  | "carpet"
  | "bulk";

export interface ServiceType {
  key: ServiceKey;
  name: string;
  description: string;
  icon: string; // lucide icon name
  pricingType: "per_kg" | "per_piece" | "both";
  basePrice: number;
  expressMultiplier: number;
  gradient: string;
  category: "everyday" | "premium" | "specialty" | "bulk";
}

export interface Vendor {
  id: string;
  name: string;
  rating: number;
  reviewCount: number;
  distanceKm: number;
  area: string;
  city: string;
  estimatedDeliveryHrs: number;
  isOpen: boolean;
  tags: string[];
  servicesOffered: ServiceKey[];
  priceLevel: 1 | 2 | 3;
  logoColor: string;
  logoInitials: string;
  capacityUsedPct: number;
  repeatCustomerRate: number;
  avgTurnaroundHrs: number;
  monthlyRevenue: number;
  verified: boolean;
  kycStatus: "approved" | "pending" | "rejected";
  joinedDate: string;
  totalOrders: number;
  responseTimeMins: number;
  businessHours?: Record<string, { open: string; close: string; active: boolean }>;
  serviceRadiusKm?: number;
  minOrderValue?: number;
  expressEnabled?: boolean;
}

export type OrderStage =
  | "placed"
  | "vendor_assigned"
  | "vendor_accepted"
  | "pickup_scheduled"
  | "pickup_completed"
  | "laundry_received"
  | "sorting"
  | "tagging"
  | "washing"
  | "drying"
  | "ironing"
  | "dry_cleaning"
  | "quality_inspection"
  | "packing"
  | "ready_for_dispatch"
  | "out_for_delivery"
  | "delivered"
  | "completed"
  | "cancelled";

export interface OrderStageEvent {
  stage: OrderStage;
  label: string;
  timestamp: string;
  done: boolean;
}

export interface OrderItem {
  serviceKey: ServiceKey;
  serviceName: string;
  qty: number;
  unit: "kg" | "piece";
  unitPrice: number;
  express: boolean;
}

export interface Order {
  id: string;
  code: string;
  customerId: string;
  customerName: string;
  customerAvatar: string;
  vendorId: string;
  vendorName: string;
  vendorLogoInitials: string;
  vendorLogoColor: string;
  deliveryExecutiveId?: string;
  deliveryExecutiveName?: string;
  status: OrderStage;
  currentStageIndex: number;
  stages: OrderStageEvent[];
  items: OrderItem[];
  pickupLat: number | null;
  pickupLng: number | null;
  deliveryLat: number | null;
  deliveryLng: number | null;
  pickupAddress: string;
  pickupArea: string;
  pickupDate: string;
  pickupSlot: string;
  deliveryDate: string;
  deliverySlot: string;
  estimatedDeliveryAt: string;
  amount: number;
  taxes: number;
  platformFee: number;
  deliveryFee: number;
  total: number;
  paymentMethod: string;
  paymentStatus: "paid" | "pending" | "refunded";
  express: boolean;
  notes?: string;
  garmentCount: number;
  weightKg?: number;
  createdAt: string;
  aiPrediction?: {
    confidence: number;
    estimatedCompletionHrs: number;
    delayRisk: "low" | "medium" | "high";
    delayReason?: string;
  };
}

export interface Address {
  id: string;
  label: string;
  line: string;
  area: string;
  city: string;
  pincode: string;
  isDefault: boolean;
  lat: number;
  lng: number;
}

export interface Coupon {
  code: string;
  description: string;
  discountPct: number;
  maxDiscount: number;
  minOrder: number;
  expiresAt: string;
  type: "percentage" | "flat";
}

export interface Review {
  id: string;
  orderId: string;
  customerName: string;
  customerAvatar: string;
  vendorName: string;
  date: string;
  overall: number;
  vendorRating: number;
  pickupRating: number;
  laundryRating: number;
  deliveryRating: number;
  comment: string;
  images?: string[];
  helpful: number;
  vendorReply?: string;
}

export interface DeliveryTask {
  id: string;
  type: "pickup" | "delivery";
  orderId: string;
  orderCode: string;
  customerName: string;
  customerPhone: string;
  vendorName: string;
  vendorPhone: string;
  address: string;
  area: string;
  distanceKm: number;
  slot: string;
  status: "pending" | "heading_to_pickup" | "picked_up" | "heading_to_vendor" | "reached_vendor" | "ready_for_delivery" | "out_for_delivery" | "delivered";
  estimatedMins: number;
  paymentMode: string;
  amount: number;
  items: string;
  execId?: string;
  deliveryOtp?: string;
  otpVerified?: boolean;
  photos?: string[];
  signature?: string;
  pickupLat?: number | null;
  pickupLng?: number | null;
  deliveryLat?: number | null;
  deliveryLng?: number | null;
}

export interface Notification {
  id: string;
  type: "booking" | "vendor" | "pickup" | "delivery" | "payment" | "promo" | "system" | "ai";
  title: string;
  body: string;
  time: string;
  read: boolean;
  channel: "push" | "sms" | "email" | "whatsapp";
}

export interface AdminKpi {
  label: string;
  value: string;
  change: number;
  trend: "up" | "down" | "flat";
  spark: number[];
  icon: string;
  accent: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  time: string;
}

import { createContext, useContext } from "react";
import type { Dispatch, SetStateAction } from "react";
import type { Address, ServiceItem } from "@/lib/types";

// ─── Types ────────────────────────────────────────────────

export type BookingType = "count_items" | "laundry_bag" | "mixed";
export type StepV2 = "category" | "serviceType" | "inventory" | "addons" | "schedule" | "vendor" | "review" | "confirmed";

export interface ItemQty {
  itemId: string;
  qty: number;
  instructions: string[];
}

export interface NewAddress {
  label: string;
  line: string;
  flatNo: string;
  area: string;
  city: string;
  pincode: string;
  place_id: string;
}

export interface PricingBreakdown {
  subtotal: number;
  couponDiscount: number;
  couponCode?: string;
  subscriptionDiscount: number;
  rewardPointsUsed: number;
  rewardDiscount: number;
  walletUsed: number;
  taxes: number;
  platformFee: number;
  deliveryFee: number;
  expressSurcharge: number;
  surgeCharge: number;
  total: number;
  breakdown: { label: string; amount: number }[];
}

export interface ConfirmedOrder {
  code: string;
  total: number;
  pickupDate: string;
  pickupSlot: string;
  deliveryDate: string;
  deliverySlot: string;
  vendorName: string;
}

export interface BookingStep {
  id: StepV2;
  label: string;
}

// ─── Catalog shapes (server catalog is richer than lib types) ──

export interface CatalogService {
  id: string;
  name: string;
  description?: string;
  unit?: string;
  categoryId?: string;
  isActive?: boolean;
  items?: ServiceItem[];
}

export interface CatalogCategory {
  id: string;
  slug: string;
  name: string;
  icon?: string;
  description?: string;
  grouping?: string;
  services?: CatalogService[];
}

export type CatalogServiceWithCategory = CatalogService & {
  categoryName: string;
  categorySlug: string;
};

// ─── Steps ────────────────────────────────────────────────

export const STEPS: BookingStep[] = [
  { id: "category", label: "Category" },
  { id: "serviceType", label: "Service" },
  { id: "inventory", label: "Items" },
  { id: "addons", label: "Add-ons" },
  { id: "schedule", label: "Schedule" },
  { id: "vendor", label: "Vendor" },
  { id: "review", label: "Review" },
];

// ─── Contexts ─────────────────────────────────────────────

export interface BookingNavigationValue {
  step: StepV2;
  goToStep: (step: StepV2) => void;
  back: () => void;
  next: () => void;
  currentIndex: number;
  canContinue: boolean;
  close: () => void;
}

export interface BookingSelectionValue {
  catalog: CatalogCategory[] | undefined;
  mainCategories: CatalogCategory[];
  addonCategories: CatalogCategory[];
  addonServices: CatalogService[];
  servicesData: CatalogServiceWithCategory[];
  selectedCategoryIds: string[];
  setSelectedCategoryIds: Dispatch<SetStateAction<string[]>>;
  selectedServiceIds: string[];
  setSelectedServiceIds: Dispatch<SetStateAction<string[]>>;
  selectedCategoryObjs: CatalogCategory[];
  selectedServiceObjs: CatalogServiceWithCategory[];
  catalogItems: ServiceItem[];
  weightMap: Record<string, number>;
  defaultPrices: Record<string, number>;
  totalItems: number;
  totalAddonItems: number;
  bookingType: BookingType;
  setBookingType: Dispatch<SetStateAction<BookingType>>;
  laundryBagQty: number;
  setLaundryBagQty: Dispatch<SetStateAction<number>>;
  itemQtys: Record<string, ItemQty>;
  setItemQtys: Dispatch<SetStateAction<Record<string, ItemQty>>>;
  addonQtys: Record<string, number>;
  setAddonQtys: Dispatch<SetStateAction<Record<string, number>>>;
  selectedAddonCat: string | null;
  setSelectedAddonCat: Dispatch<SetStateAction<string | null>>;
  addrList: Address[];
  pickupAddr: string;
  setPickupAddr: Dispatch<SetStateAction<string>>;
  deliveryAddr: string;
  setDeliveryAddr: Dispatch<SetStateAction<string>>;
  pickupDate: string;
  setPickupDate: Dispatch<SetStateAction<string>>;
  pickupSlot: string;
  setPickupSlot: Dispatch<SetStateAction<string>>;
  deliveryDate: string;
  setDeliveryDate: Dispatch<SetStateAction<string>>;
  deliverySlot: string;
  setDeliverySlot: Dispatch<SetStateAction<string>>;
  notes: string;
  setNotes: Dispatch<SetStateAction<string>>;
  vendorMode: "auto" | "manual";
  setVendorMode: Dispatch<SetStateAction<"auto" | "manual">>;
  selectedVendor: string;
  setSelectedVendor: Dispatch<SetStateAction<string>>;
  showAddAddr: boolean;
  setShowAddAddr: Dispatch<SetStateAction<boolean>>;
  newAddr: NewAddress;
  setNewAddr: Dispatch<SetStateAction<NewAddress>>;
  refetchAddresses: () => void;
}

export interface BookingPricingValue {
  totalPrice: number;
  pricingResult: PricingBreakdown | null;
  pricingLoading: boolean;
  couponCode: string;
  setCouponCode: Dispatch<SetStateAction<string>>;
  useWallet: boolean;
  setUseWallet: Dispatch<SetStateAction<boolean>>;
  redeemPoints: number;
  setRedeemPoints: Dispatch<SetStateAction<number>>;
  walletBalance: number;
  loyaltyPoints: number;
}

export interface BookingCheckoutValue {
  placing: boolean;
  confirmedOrder: ConfirmedOrder | null;
  placeOrder: () => Promise<void>;
}

export const BookingNavigationContext = createContext<BookingNavigationValue | null>(null);
export const BookingSelectionContext = createContext<BookingSelectionValue | null>(null);
export const BookingPricingContext = createContext<BookingPricingValue | null>(null);
export const BookingCheckoutContext = createContext<BookingCheckoutValue | null>(null);

// ─── Hooks ────────────────────────────────────────────────

function useBookingContext<T>(ctx: React.Context<T | null>, name: string): T {
  const value = useContext(ctx);
  if (!value) throw new Error(`${name} must be used within BookingProvider`);
  return value;
}

export function useBookingNavigation(): BookingNavigationValue {
  return useBookingContext(BookingNavigationContext, "useBookingNavigation");
}

export function useBookingSelection(): BookingSelectionValue {
  return useBookingContext(BookingSelectionContext, "useBookingSelection");
}

export function useBookingPricing(): BookingPricingValue {
  return useBookingContext(BookingPricingContext, "useBookingPricing");
}

export function useBookingCheckout(): BookingCheckoutValue {
  return useBookingContext(BookingCheckoutContext, "useBookingCheckout");
}

export function useBooking() {
  return {
    navigation: useBookingNavigation(),
    selection: useBookingSelection(),
    pricing: useBookingPricing(),
    checkout: useBookingCheckout(),
  };
}

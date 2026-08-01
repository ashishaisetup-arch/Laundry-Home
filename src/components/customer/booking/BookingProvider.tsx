import { useState, useEffect, useCallback, useMemo, type ReactNode } from "react";
import { useServiceCatalog, useVendors, useAddresses, useOrders } from "@/lib/hooks";
import { useAppStore } from "@/lib/store";
import { api } from "@/lib/api/client";
import { toast } from "sonner";
import type { ServiceItem } from "@/lib/types";
import {
  BookingNavigationContext,
  BookingSelectionContext,
  BookingPricingContext,
  BookingCheckoutContext,
  STEPS,
  type BookingNavigationValue,
  type BookingSelectionValue,
  type BookingPricingValue,
  type BookingCheckoutValue,
  type CatalogCategory,
  type BookingType,
  type StepV2,
  type ItemQty,
  type PricingBreakdown,
  type ConfirmedOrder,
} from "./use-booking";

interface BookingProviderProps {
  location?: { lat: number; lng: number } | null;
  onClose: () => void;
  children: ReactNode;
}

function resolveDate(label: string): string {
  const d = new Date();
  if (label === "Tomorrow") d.setDate(d.getDate() + 1);
  else if (label === "Day after") d.setDate(d.getDate() + 2);
  else if (label === "3 days") d.setDate(d.getDate() + 3);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function BookingProvider({ location, onClose, children }: BookingProviderProps) {
  // ─── Data ────────────────────────────────────────────────
  const { data: catalog } = useServiceCatalog();
  const { data: vendorsList } = useVendors(location ? { lat: location.lat, lng: location.lng, radiusKm: 5 } : undefined);
  const { data: addresses, refetch: refetchAddresses } = useAddresses();
  const { refetch: refetchOrders } = useOrders();
  const walletBalance = useAppStore((s) => s.walletBalance);
  const loyaltyPoints = useAppStore((s) => s.loyaltyPoints);
  const fetchWallet = useAppStore((s) => s.fetchWallet);

  // ─── State ───────────────────────────────────────────────
  const [step, setStep] = useState<StepV2>("category");
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([]);
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>([]);
  const [bookingType, setBookingType] = useState<BookingType>("count_items");
  const [laundryBagQty, setLaundryBagQty] = useState(0);
  const [itemQtys, setItemQtys] = useState<Record<string, ItemQty>>({});
  const [addonQtys, setAddonQtys] = useState<Record<string, number>>({});
  const [selectedAddonCat, setSelectedAddonCat] = useState<string | null>(null);

  const [pickupAddr, setPickupAddr] = useState("");
  const [deliveryAddr, setDeliveryAddr] = useState("");
  const [pickupDate, setPickupDate] = useState("Today");
  const [pickupSlot, setPickupSlot] = useState("");
  const [deliveryDate, setDeliveryDate] = useState("Tomorrow");
  const [deliverySlot, setDeliverySlot] = useState("");

  const [vendorMode, setVendorMode] = useState<"auto" | "manual">("auto");
  const [selectedVendor, setSelectedVendor] = useState("");
  const [notes, setNotes] = useState("");
  const [couponCode, setCouponCode] = useState("");
  const [placing, setPlacing] = useState(false);
  const [pricingResult, setPricingResult] = useState<PricingBreakdown | null>(null);
  const [pricingLoading, setPricingLoading] = useState(false);
  const [useWallet, setUseWallet] = useState(false);
  const [redeemPoints, setRedeemPoints] = useState(0);
  const [confirmedOrder, setConfirmedOrder] = useState<ConfirmedOrder | null>(null);

  // ─── Derived ─────────────────────────────────────────────
  const catalogData = (catalog || []) as unknown as CatalogCategory[];
  const servicesData = useMemo(
    () =>
      catalogData.flatMap((cat) =>
        (cat.services || []).map((s) => ({
          ...s,
          categoryName: cat.name,
          categorySlug: cat.slug,
        }))
      ),
    [catalogData]
  );
  const addrList = addresses || [];
  const mainCategories = useMemo(() => catalogData.filter((c) => c.grouping !== "addon"), [catalogData]);
  const addonCategories = useMemo(() => catalogData.filter((c) => c.grouping === "addon"), [catalogData]);
  const addonServices = useMemo(
    () => addonCategories.flatMap((c) => (c.services || []).filter((s) => s.isActive !== false)),
    [addonCategories]
  );
  const selectedCategoryObjs = useMemo(
    () => catalogData.filter((c) => selectedCategoryIds.includes(c.id)),
    [catalogData, selectedCategoryIds]
  );
  const selectedServiceObjs = useMemo(
    () => servicesData.filter((s) => selectedServiceIds.includes(s.id)),
    [servicesData, selectedServiceIds]
  );
  const catalogItems = useMemo<ServiceItem[]>(() => selectedServiceObjs.flatMap((s) => s.items || []), [selectedServiceObjs]);
  const weightMap = useMemo(() => {
    const map: Record<string, number> = {};
    for (const item of catalogItems) {
      if (item.itemMasterId) map[item.itemMasterId] = item.estimatedWeightKg || 0;
    }
    return map;
  }, [catalogItems]);
  const totalItems = useMemo(() => Object.values(itemQtys).reduce((sum, i) => sum + i.qty, 0), [itemQtys]);
  const totalAddonItems = useMemo(() => Object.values(addonQtys).reduce((sum, q) => sum + q, 0), [addonQtys]);
  const totalWeight = useMemo(
    () => Object.entries(itemQtys).reduce((sum, [id, q]) => sum + (weightMap[id] || 0) * q.qty, 0),
    [itemQtys, weightMap]
  );
  const defaultPrices = useMemo(() => {
    const map: Record<string, number> = {};
    for (const svc of selectedServiceObjs) {
      for (const si of svc.items || []) {
        if (si.itemMasterId) map[si.itemMasterId] = si.defaultPrice || 0;
      }
    }
    return map;
  }, [selectedServiceObjs]);
  const totalPrice = useMemo(
    () => Object.entries(itemQtys).reduce((sum, [id, q]) => sum + (defaultPrices[id] || 0) * q.qty, 0),
    [itemQtys, defaultPrices]
  );

  const currentIndex = STEPS.findIndex((s) => s.id === step);

  const canContinue = useMemo(
    () =>
      step === "category"
        ? selectedCategoryIds.length > 0
        : step === "serviceType"
          ? selectedServiceIds.length > 0
          : step === "inventory"
            ? (bookingType === "laundry_bag" ? laundryBagQty > 0 : totalItems > 0) || (bookingType === "mixed" && (laundryBagQty > 0 || totalItems > 0))
            : step === "addons"
              ? true
              : step === "schedule"
                ? !!pickupAddr && !!pickupSlot && !!deliveryAddr && !!deliverySlot
                : step === "vendor"
                  ? vendorMode === "auto" || !!selectedVendor
                  : true,
    [step, selectedCategoryIds, selectedServiceIds, bookingType, laundryBagQty, totalItems, pickupAddr, pickupSlot, deliveryAddr, deliverySlot, vendorMode, selectedVendor]
  );

  // ─── Effects ─────────────────────────────────────────────
  useEffect(() => {
    if (!addresses || addresses.length === 0) return;
    const defaultAddr = addresses.find((a) => a.isDefault) || addresses[0];
    if (!pickupAddr) setPickupAddr(defaultAddr.id);
    if (!deliveryAddr) setDeliveryAddr(defaultAddr.id);
  }, [addresses, pickupAddr, deliveryAddr]);

  // ─── Pricing ─────────────────────────────────────────────
  function buildOrderItemsPayload() {
    const items: any[] = [];
    if (bookingType === "count_items" || bookingType === "mixed") {
      for (const iq of Object.values(itemQtys)) {
        if (iq.qty <= 0) continue;
        const svc = selectedServiceObjs.find((s) =>
          s.items?.some((si) => si.itemMasterId === iq.itemId)
        );
        items.push({
          itemId: iq.itemId, // itemMasterId → valid FK to item_master
          serviceId: svc?.id || selectedServiceIds[0],
          qty: iq.qty,
          specialInstructions: iq.instructions,
        });
      }
    }
    // Include add-on items
    for (const [svcId, qty] of Object.entries(addonQtys)) {
      if (qty <= 0) continue;
      const svc = servicesData.find((s) => s.id === svcId);
      if (!svc) continue;
      for (const addonItem of svc.items || []) {
        items.push({
          itemId: addonItem.itemMasterId || addonItem.id || svcId,
          serviceId: svcId,
          qty,
          specialInstructions: [],
        });
      }
      // If service has no items, push a placeholder
      if (!svc.items?.length) {
        items.push({
          itemId: svcId,
          serviceId: svcId,
          qty,
          specialInstructions: [],
        });
      }
    }
    return items;
  }

  useEffect(() => {
    if (step !== "review") return;
    if (!selectedServiceIds.length && !Object.values(addonQtys).some((q) => q > 0)) return;

    const orderItems = buildOrderItemsPayload();
    if (!orderItems.length && !laundryBagQty) return;

    setPricingLoading(true);
    const vendorId = vendorMode === "manual" && selectedVendor
      ? selectedVendor
      : (vendorsList?.[0]?.id);
    api.post<PricingBreakdown>("/api/orders/pricing", {
      items: orderItems,
      vendorId,
      couponCode,
      redeemPoints,
      useWalletAmount: useWallet ? walletBalance : 0,
    }).then(setPricingResult).catch(() => {
      toast.error("Failed to calculate pricing");
    }).finally(() => setPricingLoading(false));
  }, [step, selectedServiceIds, itemQtys, laundryBagQty, addonQtys, couponCode, redeemPoints, useWallet, vendorMode, selectedVendor, vendorsList, walletBalance]);

  // ─── Actions ─────────────────────────────────────────────
  const resetState = useCallback(() => {
    setSelectedCategoryIds([]);
    setSelectedServiceIds([]);
    setBookingType("count_items");
    setItemQtys({});
    setAddonQtys({});
    setLaundryBagQty(0);
    setCouponCode("");
    setRedeemPoints(0);
    setPickupSlot("");
    setDeliverySlot("");
    setPickupDate("");
    setDeliveryDate("");
    setPickupAddr("");
    setNotes("");
    setStep("category");
    setPricingResult(null);
  }, []);

  const close = useCallback(() => {
    resetState();
    onClose();
  }, [resetState, onClose]);

  // ─── Place Order ─────────────────────────────────────────
  const placeOrder = useCallback(async () => {
    if (placing) return;
    setPlacing(true);
    try {
      const selectedAddr = addrList.find((a) => a.id === pickupAddr);
      const selectedDelAddr = addrList.find((a) => a.id === deliveryAddr);
      const vendorId = vendorMode === "manual" && selectedVendor ? selectedVendor : (vendorsList?.[0]?.id || "00000000-0000-0000-0000-000000000001");

      const orderItems = buildOrderItemsPayload();

      const body: any = {
        orderItems,
        bookingType,
        laundryBagQty: (bookingType === "laundry_bag" || bookingType === "mixed") ? laundryBagQty : 0,
        estimatedWeightKg: Object.values(itemQtys).reduce((sum, i) => {
          return sum + (weightMap[i.itemId] || 0) * i.qty;
        }, 0),
        vendor_id: vendorId,
        pickup_address: selectedAddr?.fullAddress || selectedAddr?.line || "",
        pickup_area: selectedAddr?.area || "",
        pickup_date: resolveDate(pickupDate),
        pickup_slot: pickupSlot,
        delivery_date: resolveDate(deliveryDate),
        delivery_slot: deliverySlot,
        delivery_address: selectedDelAddr?.fullAddress || selectedDelAddr?.line || "",
        delivery_area: selectedDelAddr?.area || "",
        payment_method: "cod",
        notes,
        couponCode,
        redeemPoints,
        useWalletAmount: useWallet ? walletBalance : 0,
        express: false,
        garment_count: totalItems,
      };

      const order = await api.post<any>("/api/orders", body);
      setConfirmedOrder({
        code: order.code,
        total: order.total,
        pickupDate,
        pickupSlot,
        deliveryDate,
        deliverySlot,
        vendorName: order.vendor_name || "Vendor",
      });
      setStep("confirmed");
      fetchWallet();
      refetchOrders();
    } catch (err: any) {
      toast.error("Failed to place order", { description: err.message });
    } finally {
      setPlacing(false);
    }
  }, [placing, addrList, pickupAddr, deliveryAddr, vendorMode, selectedVendor, vendorsList, bookingType, laundryBagQty, itemQtys, weightMap, pickupDate, pickupSlot, deliveryDate, deliverySlot, notes, couponCode, redeemPoints, useWallet, walletBalance, totalItems, fetchWallet, refetchOrders]);

  // ─── Context values ──────────────────────────────────────
  const navigation = useMemo<BookingNavigationValue>(
    () => ({
      step,
      goToStep: setStep,
      back: () => setStep(STEPS[Math.max(0, currentIndex - 1)].id),
      next: () => setStep(STEPS[Math.min(STEPS.length - 1, currentIndex + 1)].id),
      currentIndex,
      canContinue,
      close,
    }),
    [step, currentIndex, canContinue, close]
  );

  const selection = useMemo<BookingSelectionValue>(
    () => ({
      catalog: catalogData,
      mainCategories,
      addonCategories,
      addonServices,
      servicesData,
      selectedCategoryIds,
      setSelectedCategoryIds,
      selectedServiceIds,
      setSelectedServiceIds,
      selectedCategoryObjs,
      selectedServiceObjs,
      catalogItems,
      weightMap,
      defaultPrices,
      totalItems,
      totalAddonItems,
      totalWeight,
      vendorsList,
      bookingType,
      setBookingType,
      laundryBagQty,
      setLaundryBagQty,
      itemQtys,
      setItemQtys,
      addonQtys,
      setAddonQtys,
      selectedAddonCat,
      setSelectedAddonCat,
      addrList,
      pickupAddr,
      setPickupAddr,
      deliveryAddr,
      setDeliveryAddr,
      pickupDate,
      setPickupDate,
      pickupSlot,
      setPickupSlot,
      deliveryDate,
      setDeliveryDate,
      deliverySlot,
      setDeliverySlot,
      notes,
      setNotes,
      vendorMode,
      setVendorMode,
      selectedVendor,
      setSelectedVendor,
      refetchAddresses,
    }),
    [catalogData, mainCategories, addonCategories, addonServices, servicesData, selectedCategoryIds, selectedServiceIds, selectedCategoryObjs, selectedServiceObjs, catalogItems, weightMap, defaultPrices, totalItems, totalAddonItems, totalWeight, vendorsList, bookingType, laundryBagQty, itemQtys, addonQtys, selectedAddonCat, addrList, pickupAddr, deliveryAddr, pickupDate, pickupSlot, deliveryDate, deliverySlot, notes, vendorMode, selectedVendor, refetchAddresses]
  );

  const pricing = useMemo<BookingPricingValue>(
    () => ({
      totalPrice,
      pricingResult,
      pricingLoading,
      couponCode,
      setCouponCode,
      useWallet,
      setUseWallet,
      redeemPoints,
      setRedeemPoints,
      walletBalance,
      loyaltyPoints,
    }),
    [totalPrice, pricingResult, pricingLoading, couponCode, useWallet, redeemPoints, walletBalance, loyaltyPoints]
  );

  const checkout = useMemo<BookingCheckoutValue>(
    () => ({
      placing,
      confirmedOrder,
      placeOrder,
    }),
    [placing, confirmedOrder, placeOrder]
  );

  return (
    <BookingNavigationContext.Provider value={navigation}>
      <BookingSelectionContext.Provider value={selection}>
        <BookingPricingContext.Provider value={pricing}>
          <BookingCheckoutContext.Provider value={checkout}>
            {children}
          </BookingCheckoutContext.Provider>
        </BookingPricingContext.Provider>
      </BookingSelectionContext.Provider>
    </BookingNavigationContext.Provider>
  );
}

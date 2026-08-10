import { useState, useEffect, useCallback, useMemo, useRef, type ReactNode } from "react";
import { useServiceCatalog, useVendors, useAddresses, useOrders, useCustomerFeatures } from "@/lib/hooks";
import { useAppStore } from "@/lib/store";
import { api } from "@/lib/api/client";
import { formatAddress } from "@/lib/address";
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
import {
  getAddonKinds,
  reconcileSchedule,
  type ScheduleKinds,
} from "./schedule-windows";

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
  else if (label === "4 days") d.setDate(d.getDate() + 4);
  else if (label === "5 days") d.setDate(d.getDate() + 5);
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
  const { data: features } = useCustomerFeatures();
  const { refetch: refetchOrders } = useOrders();
  const walletBalance = useAppStore((s) => s.walletBalance);
  const loyaltyPoints = useAppStore((s) => s.loyaltyPoints);
  const fetchWallet = useAppStore((s) => s.fetchWallet);

  // ─── State ───────────────────────────────────────────────
  const [step, setStep] = useState<StepV2>("category");
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([]);
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>([]);
  const [bookingType, setBookingType] = useState<BookingType>("count_items");
  const [itemQtys, setItemQtys] = useState<Record<string, ItemQty>>({});
  // Non-bag selections stashed while laundry_bag mode hides them, restored on
  // switching back to count_items / mixed so mode changes never lose services.
  const stashRef = useRef<{ services: string[]; qtys: Record<string, ItemQty> } | null>(null);
  const [addonEnabled, setAddonEnabled] = useState<Record<string, boolean>>({});
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
          pricingType: s.pricingType ?? (s as any).pricing_type ?? "ITEM",
          bagPrice: s.bagPrice ?? (s as any).bag_price,
          isActive: s.isActive ?? (s as any).is_active ?? true,
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
  // Time-based add-ons (by slug) drive the schedule windows shown to the user.
  const timeAddonKinds = useMemo<ScheduleKinds>(() => getAddonKinds(addonEnabled, addonServices), [addonEnabled, addonServices]);
  const pickupMode = timeAddonKinds.express ? "express" : "scheduled";
  const deliverySpeed = timeAddonKinds.sameDay ? "same_day" : timeAddonKinds.twentyFourHour ? "24_hour" : "standard";
  // Main categories that offer item (non-bag) services — auto-selected when
  // switching to Mixed / Count Items mode with no item category chosen, so
  // service selection is always visible.
  const itemMainCategoryIds = useMemo(() => {
    const itemCatIds = new Set(
      servicesData
        .filter((s) => s.pricingType !== "BAG" && s.isActive !== false)
        .map((s) => s.categoryId)
        .filter(Boolean) as string[]
    );
    return mainCategories.filter((c) => itemCatIds.has(c.id)).map((c) => c.id);
  }, [mainCategories, servicesData]);
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

  // BAG-type services selected by the customer (Laundry Bag, Premium Laundry Bag, …)
  const bagServices = useMemo(
    () => selectedServiceObjs.filter((s) => s.pricingType === "BAG"),
    [selectedServiceObjs]
  );
  const bagServiceIds = useMemo(() => new Set(bagServices.map((s) => s.id)), [bagServices]);
  const isBagLine = useCallback((iq: ItemQty) => bagServiceIds.has(iq.serviceId), [bagServiceIds]);

  // Non-bag (item) lines only
  const itemLines = useMemo(
    () => Object.values(itemQtys).filter((iq) => iq.qty > 0 && !isBagLine(iq)),
    [itemQtys, isBagLine]
  );
  const bagLines = useMemo(
    () => Object.values(itemQtys).filter((iq) => iq.qty > 0 && isBagLine(iq)),
    [itemQtys, isBagLine]
  );
  const totalItems = useMemo(() => itemLines.reduce((sum, i) => sum + i.qty, 0), [itemLines]);
  const bagQty = useMemo(() => bagLines.reduce((sum, i) => sum + i.qty, 0), [bagLines]);
  const totalAddonItems = useMemo(
    () => Object.values(addonEnabled).filter((on) => on).length,
    [addonEnabled]
  );
  const totalWeight = useMemo(
    () => itemLines.reduce((sum, i) => sum + (weightMap[i.itemId] || 0) * i.qty, 0),
    [itemLines, weightMap]
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
    () => itemLines.reduce((sum, i) => sum + (defaultPrices[i.itemId] || 0) * i.qty, 0),
    [itemLines, defaultPrices]
  );

  const currentIndex = STEPS.findIndex((s) => s.id === step);

  const canContinue = useMemo(
    () =>
      step === "category"
        ? selectedCategoryIds.length > 0
        : step === "serviceType"
          ? selectedServiceIds.length > 0
          : step === "inventory"
            ? bookingType === "laundry_bag"
              ? bagQty > 0
              : bookingType === "mixed"
                ? bagQty > 0 || totalItems > 0
                : totalItems > 0
            : step === "addons"
              ? true
              : step === "schedule"
                ? !!pickupAddr && !!pickupSlot && !!deliveryAddr && !!deliverySlot
                : step === "vendor"
                  ? vendorMode === "auto" || !!selectedVendor
                  : true,
    [step, selectedCategoryIds, selectedServiceIds, bookingType, bagQty, totalItems, pickupAddr, pickupSlot, deliveryAddr, deliverySlot, vendorMode, selectedVendor]
  );

  // ─── Effects ─────────────────────────────────────────────
  useEffect(() => {
    if (!addresses || addresses.length === 0) return;
    const defaultAddr = addresses.find((a) => a.isDefault) || addresses[0];
    if (!pickupAddr) setPickupAddr(defaultAddr.id);
    if (!deliveryAddr) setDeliveryAddr(defaultAddr.id);
  }, [addresses, pickupAddr, deliveryAddr]);

  useEffect(() => {
    if (!features) return;
    if (features.enableCoupons === false) setCouponCode("");
    if (features.enableWallet === false) setUseWallet(false);
    if (features.enableLoyalty === false) setRedeemPoints(0);
    const enabled: BookingType[] = [];
    if (features.enableCountItems !== false) enabled.push("count_items");
    if (features.enableLaundryBag !== false) enabled.push("laundry_bag");
    if (features.enableMixedBooking !== false) enabled.push("mixed");
    if (enabled.length > 0 && !enabled.includes(bookingType)) setBookingType(enabled[0]);
  }, [features, bookingType]);

  // ─── Booking mode → selection enforcement ─────────────────
  // laundry_bag allows only bag services; mixed allows items + bags;
  // count_items allows only item services.
  // Non-bag selections are stashed on entering laundry_bag and restored on
  // leaving, so switching modes never loses the customer's service choices.
  const applyStashRestore = useCallback(() => {
    const stash = stashRef.current;
    if (!stash) return;
    stashRef.current = null;
    const valid = stash.services.filter((id) =>
      servicesData.some(
        (s) => s.id === id && s.pricingType !== "BAG" && selectedCategoryIds.includes(s.categoryId || "")
      )
    );
    if (valid.length === 0) return;
    setSelectedServiceIds((prev) => [...new Set([...prev, ...valid])]);
    setItemQtys((prev) => {
      const next = { ...prev };
      for (const [k, v] of Object.entries(stash.qtys)) {
        if (valid.includes(v.serviceId)) next[k] = v;
      }
      return next;
    });
  }, [servicesData, selectedCategoryIds]);

  const pruneBagOnlyCategories = useCallback(
    (ids: string[]) =>
      ids.filter((cid) => {
        const catServices = servicesData.filter((s) => s.categoryId === cid);
        return catServices.length === 0 || catServices.some((s) => s.pricingType !== "BAG");
      }),
    [servicesData]
  );
  // When switching to Mixed / Count Items with no item category selected,
  // auto-select all item categories so service selection is always visible.
  const ensureItemCategories = useCallback(
    (ids: string[]) => {
      const hasItemCat = ids.some((id) => itemMainCategoryIds.includes(id));
      return hasItemCat ? ids : [...new Set([...ids, ...itemMainCategoryIds])];
    },
    [itemMainCategoryIds]
  );

  // Auto-adapt booking type to the selected services: bags selected while in
  // count_items mode would otherwise be invisible in the inventory step.
  useEffect(() => {
    const hasBag = bagServices.length > 0;
    const hasNonBag = selectedServiceObjs.some((s) => s.pricingType !== "BAG");
    if (!features) return;
    if (hasBag && bookingType === "count_items") {
      if (!hasNonBag && features.enableLaundryBag !== false) {
        setBookingType("laundry_bag");
      } else if (features.enableMixedBooking !== false) {
        setBookingType("mixed");
      } else if (features.enableLaundryBag !== false) {
        setBookingType("laundry_bag");
      }
    } else if (hasBag && hasNonBag && bookingType === "laundry_bag" && features.enableMixedBooking !== false) {
      setBookingType("mixed");
    } else if (!hasBag && bookingType === "laundry_bag") {
      const nextMode =
        features.enableCountItems !== false ? "count_items" : features.enableMixedBooking !== false ? "mixed" : null;
      if (nextMode) {
        setBookingType(nextMode);
        applyStashRestore();
        setSelectedCategoryIds((prev) =>
          ensureItemCategories(nextMode === "count_items" ? pruneBagOnlyCategories(prev) : prev)
        );
      }
    }
  }, [bagServices, selectedServiceObjs, bookingType, features]);

  const handleBookingTypeChange = useCallback(
    (type: BookingType) => {
      setBookingType(type);
      const activeBagIds = new Set(
        servicesData.filter((s) => s.pricingType === "BAG" && s.isActive !== false).map((s) => s.id)
      );
      const bagCatIds = new Set(
        servicesData.filter((s) => activeBagIds.has(s.id)).map((s) => s.categoryId).filter(Boolean) as string[]
      );
      const isLaundryBag = type === "laundry_bag";
      let stash: { services: string[]; qtys: Record<string, ItemQty> } | null = null;
      if (isLaundryBag) {
        if (stashRef.current) {
          stash = stashRef.current;
        } else {
          const nonBagIds = selectedServiceIds.filter((id) => {
            const svc = servicesData.find((s) => s.id === id);
            return svc && svc.pricingType !== "BAG";
          });
          const qtys: Record<string, ItemQty> = {};
          for (const [k, v] of Object.entries(itemQtys)) {
            if (nonBagIds.includes(v.serviceId)) qtys[k] = v;
          }
          stash = { services: nonBagIds, qtys };
          stashRef.current = stash;
        }
      } else {
        stash = stashRef.current;
        stashRef.current = null;
      }
      const validStashServices = (stash?.services || []).filter((id) => {
        const svc = servicesData.find((s) => s.id === id);
        return svc && selectedCategoryIds.includes(svc.categoryId || "");
      });
      const stashedIds = isLaundryBag ? new Set<string>() : new Set(validStashServices);
      setSelectedServiceIds((prev) => {
        const next = new Set(prev);
        if (type === "laundry_bag") {
          for (const id of activeBagIds) next.add(id);
          for (const s of servicesData) if (s.pricingType !== "BAG") next.delete(s.id);
        } else if (type === "mixed") {
          for (const id of activeBagIds) next.add(id);
          for (const id of validStashServices) next.add(id);
        } else {
          for (const id of activeBagIds) next.delete(id);
          for (const id of validStashServices) next.add(id);
        }
        return [...next];
      });
      setSelectedCategoryIds((prev) => {
        if (type === "count_items") {
          // Prune categories that only contain bag services (e.g. "Laundry Bags"),
          // then auto-add item categories if none are selected.
          return ensureItemCategories(pruneBagOnlyCategories(prev));
        }
        // laundry_bag / mixed: keep categories that have bag services or (mixed)
        // still-selected item services, then ensure bag categories are included.
        // Mixed with no item category chosen auto-adds item categories so both
        // bag and service selection are visible.
        const kept = prev.filter((cid) => {
          const catServices = servicesData.filter((s) => s.categoryId === cid);
          return catServices.some(
            (s) => activeBagIds.has(s.id) || (type === "mixed" && (selectedServiceIds.includes(s.id) || stashedIds.has(s.id)))
          );
        });
        for (const cid of bagCatIds) if (!kept.includes(cid)) kept.push(cid);
        return type === "mixed" ? ensureItemCategories(kept) : kept;
      });
      setItemQtys((prev) => {
        const next = { ...prev };
        for (const key of Object.keys(next)) {
          const serviceId = key.split(":")[0];
          const isBag = activeBagIds.has(serviceId);
          if (type === "laundry_bag" && !isBag) delete next[key];
          if (type === "count_items" && isBag) delete next[key];
        }
        if (stash) {
          for (const [k, v] of Object.entries(stash.qtys)) {
            if (!next[k] && stashedIds.has(v.serviceId)) next[k] = v;
          }
        }
        return next;
      });
    },
    [servicesData, selectedServiceIds, itemQtys, selectedCategoryIds]
  );

  // ─── Pricing ─────────────────────────────────────────────
  function buildOrderItemsPayload() {
    const items: any[] = [];
    for (const iq of Object.values(itemQtys)) {
      if (iq.qty <= 0) continue;
      const isBag = bagServiceIds.has(iq.serviceId);
      if (isBag && bookingType === "count_items") continue;
      if (!isBag && bookingType === "laundry_bag") continue;
      items.push({
        serviceId: iq.serviceId,
        itemId: iq.itemId,
        qty: iq.qty,
        specialInstructions: iq.instructions,
      });
    }
    // Include enabled add-on services (one line, qty 1)
    for (const [svcId, on] of Object.entries(addonEnabled)) {
      if (!on) continue;
      const svc = servicesData.find((s) => s.id === svcId);
      if (!svc) continue;
      const addonItem = (svc.items || [])[0];
      items.push({
        serviceId: svcId,
        itemId: addonItem?.itemMasterId || addonItem?.id || svcId,
        qty: 1,
        specialInstructions: [],
      });
    }
    return items;
  }

  useEffect(() => {
    if (step !== "review") return;
    if (!selectedServiceIds.length && !Object.values(addonEnabled).some((on) => on)) return;

    const orderItems = buildOrderItemsPayload();
    if (!orderItems.length) return;

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
  }, [step, selectedServiceIds, itemQtys, bagServiceIds, addonEnabled, couponCode, redeemPoints, useWallet, vendorMode, selectedVendor, vendorsList, walletBalance]);

  // ─── Schedule reconciliation ─────────────────────────────
  // Time-based add-ons constrain the schedule, and Standard delivery enforces
  // a 48-hour turnaround: picks stay inside the SLA window, but delivery is
  // never invented before the pickup is chosen.
  useEffect(() => {
    const adjusted = reconcileSchedule({ pickupDate, pickupSlot, deliveryDate, deliverySlot }, timeAddonKinds);
    if (adjusted.pickupDate !== pickupDate) setPickupDate(adjusted.pickupDate);
    if (adjusted.pickupSlot !== pickupSlot) setPickupSlot(adjusted.pickupSlot);
    if (adjusted.deliveryDate !== deliveryDate) setDeliveryDate(adjusted.deliveryDate);
    if (adjusted.deliverySlot !== deliverySlot) setDeliverySlot(adjusted.deliverySlot);
  }, [timeAddonKinds, pickupDate, pickupSlot, deliveryDate, deliverySlot]);

  // ─── Actions ─────────────────────────────────────────────
  const resetState = useCallback(() => {
    setSelectedCategoryIds([]);
    setSelectedServiceIds([]);
    setBookingType("count_items");
    setItemQtys({});
    setAddonEnabled({});
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
        items: orderItems,
        orderItems,
        bookingType,
        laundryBagQty: bookingType === "count_items" ? 0 : bagQty,
        estimatedWeightKg: itemLines.reduce((sum, i) => {
          return sum + (weightMap[i.itemId] || 0) * i.qty;
        }, 0),
        vendor_id: vendorId,
        pickup_address: selectedAddr ? formatAddress(selectedAddr) : "",
        pickup_area: selectedAddr?.area || "",
        pickup_date: resolveDate(pickupDate),
        pickup_slot: pickupSlot,
        delivery_date: resolveDate(deliveryDate),
        delivery_slot: deliverySlot,
        pickup_mode: pickupMode,
        delivery_speed: deliverySpeed,
        delivery_address: selectedDelAddr ? formatAddress(selectedDelAddr) : "",
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
  }, [placing, addrList, pickupAddr, deliveryAddr, vendorMode, selectedVendor, vendorsList, bookingType, bagQty, itemQtys, itemLines, weightMap, pickupDate, pickupSlot, deliveryDate, deliverySlot, notes, couponCode, redeemPoints, useWallet, walletBalance, totalItems, fetchWallet, refetchOrders]);

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
      setBookingType: handleBookingTypeChange,
      bagQty,
      bagServices,
      itemQtys,
      setItemQtys,
      addonEnabled,
      setAddonEnabled,
      selectedAddonCat,
      setSelectedAddonCat,
      timeAddonKinds,
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
      features,
    }),
    [catalogData, mainCategories, addonCategories, addonServices, servicesData, selectedCategoryIds, selectedServiceIds, selectedCategoryObjs, selectedServiceObjs, catalogItems, weightMap, defaultPrices, totalItems, totalAddonItems, totalWeight, vendorsList, bookingType, handleBookingTypeChange, bagQty, bagServices, itemQtys, addonEnabled, selectedAddonCat, timeAddonKinds, addrList, pickupAddr, deliveryAddr, pickupDate, pickupSlot, deliveryDate, deliverySlot, notes, vendorMode, selectedVendor, refetchAddresses, features]
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

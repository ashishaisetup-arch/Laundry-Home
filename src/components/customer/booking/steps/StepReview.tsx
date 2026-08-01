import { MapPin, Package, ShoppingBag, Star, Store, Tag, Wallet, Zap } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { cn, formatINRDecimal } from "@/lib/utils";
import { useBookingNavigation, useBookingSelection, useBookingPricing } from "../use-booking";

export function StepReview() {
  const {
    selectedCategoryObjs,
    selectedServiceObjs,
    itemQtys,
    laundryBagQty,
    addonQtys,
    addonServices,
    totalItems,
    totalAddonItems,
    bookingType,
    addrList,
    pickupAddr,
    deliveryAddr,
    pickupDate,
    pickupSlot,
    deliveryDate,
    deliverySlot,
    vendorMode,
    selectedVendor,
    vendorsList,
  } = useBookingSelection();
  const {
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
  } = useBookingPricing();
  const { goToStep } = useBookingNavigation();

  const pBreakdown = pricingResult || { subtotal: 0, taxes: 0, platformFee: 0, deliveryFee: 0, total: 0, breakdown: [] };
  const selectedAddonSvcs = addonServices.filter((s) => (addonQtys[s.id] || 0) > 0);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold" style={{ fontFamily: "var(--font-display)" }}>Review & Confirm</h2>
        <p className="text-xs text-muted-foreground mt-0.5">Please review your order before confirming</p>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {/* Left — Items Summary */}
        <div className="space-y-3">
          <Card className="p-4 space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Package className="h-3.5 w-3.5" /> Order Summary
            </p>

            {selectedCategoryObjs.length > 0 && (
              <div className="flex flex-wrap gap-1 pb-2 border-b border-border/40">
                {selectedCategoryObjs.map((cat) => (
                  <Badge key={cat.id} variant="secondary" className="text-[10px]">{cat.name}</Badge>
                ))}
              </div>
            )}

            {selectedServiceObjs.map((svc) => {
              const svcItems = Object.values(itemQtys).filter((iq) => {
                return svc.items?.some((si) => si.itemMasterId === iq.itemId);
              });
              if (!svcItems.length) return null;
              return (
                <div key={svc.id}>
                  <p className="text-sm font-semibold mt-2 mb-1">{svc.name}</p>
                  {svcItems.map((iq) => {
                    const si = svc.items?.find((s) => s.itemMasterId === iq.itemId);
                    return (
                      <div key={iq.itemId} className="flex items-center justify-between text-sm py-0.5">
                        <span>{si?.itemName || iq.itemId}</span>
                        <span className="text-muted-foreground">× {iq.qty}</span>
                      </div>
                    );
                  })}
                </div>
              );
            })}

            {laundryBagQty > 0 && (
              <div className="flex items-center justify-between text-sm py-0.5">
                <span><ShoppingBag className="h-3.5 w-3.5 inline mr-1" />Laundry Bags</span>
                <span className="text-muted-foreground">× {laundryBagQty}</span>
              </div>
            )}

            {selectedAddonSvcs.length > 0 && (
              <>
                <Separator />
                <p className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
                  <Zap className="h-3 w-3" /> Add-ons
                </p>
                {selectedAddonSvcs.map((svc) => (
                  <div key={svc.id} className="flex items-center justify-between text-sm py-0.5">
                    <span>{svc.name}</span>
                    <span className="text-muted-foreground">× {addonQtys[svc.id]}</span>
                  </div>
                ))}
              </>
            )}

            <Separator />
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Total Items</span>
              <span className="font-semibold">{totalItems + (bookingType !== "count_items" ? laundryBagQty : 0) + totalAddonItems}</span>
            </div>
          </Card>

          <Card className="p-4 space-y-1">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5" /> Schedule
            </p>
            {(() => { const a = addrList.find((x) => x.id === pickupAddr); return a ? (
              <p className="text-xs text-muted-foreground"><span className="font-medium">Pickup:</span> {a.label} — {a.flatNo ? a.flatNo + ', ' : ''}{a.line}, {a.area}, {a.city}</p>
            ) : null; })()}
            {(() => { const a = addrList.find((x) => x.id === deliveryAddr); return a ? (
              <p className="text-xs text-muted-foreground"><span className="font-medium">Delivery:</span> {a.label} — {a.flatNo ? a.flatNo + ', ' : ''}{a.line}, {a.area}, {a.city}</p>
            ) : null; })()}
            <p className="text-xs text-muted-foreground"><span className="font-medium">Pickup slot:</span> {pickupDate}, {pickupSlot}</p>
            <p className="text-xs text-muted-foreground"><span className="font-medium">Delivery slot:</span> {deliveryDate}, {deliverySlot}</p>
          </Card>

          <Card className="p-4 space-y-1">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Store className="h-3.5 w-3.5" /> Vendor
            </p>
            {vendorMode === "auto" && vendorsList?.[0] ? (
              <div className="flex items-center gap-3">
                <div className={cn(
                  "flex h-9 w-9 items-center justify-center rounded-lg text-white text-sm font-bold shrink-0",
                  vendorsList[0].logoColor || "bg-primary"
                )}>
                  {vendorsList[0].logoInitials}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">{vendorsList[0].name}</p>
                  <p className="text-xs text-muted-foreground truncate">{vendorsList[0].area} · {vendorsList[0].distanceKm} km</p>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                    {vendorsList[0].rating}
                  </div>
                </div>
              </div>
            ) : vendorMode === "manual" && selectedVendor ? (
              <p className="text-sm font-medium">
                {(vendorsList || []).find((v) => v.id === selectedVendor)?.name || "Selected Vendor"}
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">No vendor assigned</p>
            )}
          </Card>
        </div>

        {/* Right — Pricing */}
        <div className="space-y-3">
          <Card className="p-4 space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Wallet className="h-3.5 w-3.5" /> Price Estimate
            </p>
            {pricingLoading ? (
              <p className="text-sm text-muted-foreground animate-pulse">Calculating...</p>
            ) : (
              <>
                {(pBreakdown.breakdown || []).filter((b) => b.amount > 0).map((b, i) => (
                  <div key={i} className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{b.label}</span>
                    <span>{formatINRDecimal(b.amount)}</span>
                  </div>
                ))}
                <Separator />
                <div className="flex items-center justify-between text-sm font-semibold">
                  <span>Total</span>
                  <span>{formatINRDecimal(pBreakdown.total)}</span>
                </div>
              </>
            )}
          </Card>

          {/* Coupon */}
          <Card className="p-4 space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Tag className="h-3.5 w-3.5" /> Coupon
            </p>
            <div className="flex gap-2">
              <Input value={couponCode} onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                placeholder="Enter code" className="text-sm uppercase flex-1" />
              <Button variant="outline" size="sm" onClick={() => goToStep("review")}>Apply</Button>
            </div>
          </Card>

          {/* Wallet */}
          {walletBalance > 0 && (
            <label className="flex items-center gap-2 rounded-lg border border-border/60 p-3 cursor-pointer hover:bg-muted/30">
              <input type="checkbox" checked={useWallet} onChange={(e) => setUseWallet(e.target.checked)} className="accent-primary" />
              <div>
                <p className="text-sm font-medium">Use Wallet</p>
                <p className="text-xs text-muted-foreground">Balance: {formatINRDecimal(walletBalance)}</p>
              </div>
            </label>
          )}

          {/* Points */}
          {loyaltyPoints >= 100 && (
            <Card className="p-4 space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Reward Points</p>
              <div className="flex gap-2">
                <Input type="number" value={redeemPoints || ""}
                  onChange={(e) => setRedeemPoints(Math.min(Number(e.target.value) || 0, loyaltyPoints))}
                  placeholder={`You have ${loyaltyPoints} pts`} className="text-sm flex-1" />
                <Button variant="outline" size="sm" onClick={() => setRedeemPoints(Math.min(loyaltyPoints, Math.floor(pBreakdown.total * 100)))}>
                  Max
                </Button>
              </div>
              <p className="text-[10px] text-muted-foreground">100 pts = ₹1. {redeemPoints > 0 ? `${formatINRDecimal(redeemPoints / 100)} off` : ""}</p>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { formatINRDecimal } from "@/lib/utils";
import { useBookingNavigation, useBookingSelection, useBookingCheckout } from "../use-booking";

export function StepConfirmed() {
  const { close } = useBookingNavigation();
  const { addrList, pickupAddr } = useBookingSelection();
  const { confirmedOrder } = useBookingCheckout();

  if (!confirmedOrder) return null;
  const selAddr = addrList.find((a) => a.id === pickupAddr);

  return (
    <div className="text-center py-8 space-y-4">
      <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto">
        <CheckCircle2 className="h-8 w-8 text-green-600" />
      </div>
      <div>
        <h2 className="text-xl font-bold" style={{ fontFamily: "var(--font-display)" }}>Order Confirmed!</h2>
        <p className="text-sm text-muted-foreground mt-1">Your order code is <span className="font-mono font-bold text-foreground">{confirmedOrder.code}</span></p>
      </div>
      <Card className="max-w-sm mx-auto p-4 text-left space-y-1">
        <p className="text-sm">Pickup: <strong>{confirmedOrder.pickupDate}</strong>, <strong>{confirmedOrder.pickupSlot}</strong></p>
        <p className="text-sm">Delivery: <strong>{confirmedOrder.deliveryDate}</strong>, <strong>{confirmedOrder.deliverySlot}</strong></p>
        {selAddr && <p className="text-xs text-muted-foreground">{selAddr.line}, {selAddr.area}</p>}
        <p className="text-sm">Vendor: <strong>{confirmedOrder.vendorName}</strong></p>
        <p className="text-sm font-semibold">Total: {formatINRDecimal(confirmedOrder.total)}</p>
      </Card>
      <div className="flex gap-2 justify-center">
        <Button variant="outline" onClick={close}>Close</Button>
        <Button onClick={close}>Track Order</Button>
      </div>
    </div>
  );
}

import { ArrowLeft, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatINRDecimal } from "@/lib/utils";
import { useBookingNavigation, useBookingPricing, useBookingCheckout } from "./use-booking";

export function BookingFooter() {
  const { step, currentIndex, canContinue, back, next, close } = useBookingNavigation();
  const { pricingResult, pricingLoading } = useBookingPricing();
  const { placing, placeOrder } = useBookingCheckout();

  return (
    <footer className="flex gap-2 pt-6 shrink-0">
      {currentIndex > 0 ? (
        <Button variant="outline" onClick={back} className="gap-1">
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
      ) : (
        <Button variant="outline" onClick={close} className="gap-1">Cancel</Button>
      )}

      {step === "review" ? (
        <Button className="flex-1 gap-1" onClick={placeOrder} disabled={placing || pricingLoading}>
          {placing ? "Placing..." : `Confirm Order${pricingResult ? ` · ${formatINRDecimal(pricingResult.total)}` : ""}`}
          <ArrowRight className="h-4 w-4" />
        </Button>
      ) : (
        <Button className="flex-1 gap-1" onClick={next} disabled={!canContinue}>
          Continue <ArrowRight className="h-4 w-4" />
        </Button>
      )}
    </footer>
  );
}

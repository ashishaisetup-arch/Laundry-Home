import { useState, useEffect, useRef, useLayoutEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { api } from "@/lib/api/client";
import { BookingProvider } from "./booking/BookingProvider";
import { useBookingNavigation } from "./booking/use-booking";
import { useIsMobile } from "./booking/use-is-mobile";
import { BookingHeader } from "./booking/BookingHeader";
import { BookingFooter } from "./booking/BookingFooter";
import { BookingStepper } from "./booking/BookingStepper";
import { StepCategory } from "./booking/steps/StepCategory";
import { StepServices } from "./booking/steps/StepServices";
import { StepItems } from "./booking/steps/StepItems";
import { StepAddons } from "./booking/steps/StepAddons";
import { StepSchedule } from "./booking/steps/StepSchedule";
import { StepVendor } from "./booking/steps/StepVendor";
import { StepReview } from "./booking/steps/StepReview";
import { StepConfirmed } from "./booking/steps/StepConfirmed";

interface BookingFlowProps {
  open: boolean;
  onClose: () => void;
  location?: { lat: number; lng: number } | null;
}

export function BookingFlowV2({ open, onClose, location: externalLocation }: BookingFlowProps) {
  const [detectedLocation, setDetectedLocation] = useState<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    if (externalLocation) return;
    if (!open) return;
    if (detectedLocation) return;
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const result = await api.get<{ lat: number; lng: number }>(
            `/api/geocode/reverse?lat=${pos.coords.latitude}&lng=${pos.coords.longitude}`
          );
          if (result?.lat) setDetectedLocation({ lat: result.lat, lng: result.lng });
          else setDetectedLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        } catch {
          setDetectedLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        }
      },
      () => {},
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    );
  }, [open, externalLocation, detectedLocation]);

  const activeLocation = externalLocation || detectedLocation;

  return (
    <BookingProvider location={activeLocation} onClose={onClose}>
      <BookingDialog open={open} />
    </BookingProvider>
  );
}

function BookingDialog({ open }: { open: boolean }) {
  const { step, currentIndex, close } = useBookingNavigation();
  const isMobile = useIsMobile();
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    scrollContainerRef.current?.scrollTo({ top: 0, behavior: "auto" });
  }, [currentIndex]);

  useEffect(() => {
    const el = document.querySelector("[data-booking-scroll]");
    if (el) el.scrollTop = 0;
  }, [step]);

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) close(); }}>
      <DialogContent
        data-booking-scroll
        onInteractOutside={(e) => e.preventDefault()}
        className="max-w-3xl max-h-[95dvh] lg:max-w-5xl"
      >
        <DialogTitle className="sr-only">Book Laundry Service</DialogTitle>

        {step !== "confirmed" && (isMobile ? <BookingStepper /> : <BookingHeader />)}

        {/* Scrollable Content */}
        <div ref={scrollContainerRef} className="flex-1 min-h-0 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={isMobile ? { opacity: 0, scale: 0.96, y: 8 } : { opacity: 0, y: 28 }}
              animate={isMobile ? { opacity: 1, scale: 1, y: 0 } : { opacity: 1, y: 0 }}
              exit={isMobile ? { opacity: 0, scale: 0.96, y: -8 } : { opacity: 0, y: -28 }}
              transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            >
              {step === "category" && <StepCategory />}
              {step === "serviceType" && <StepServices />}
              {step === "inventory" && <StepItems />}
              {step === "addons" && <StepAddons />}
              {step === "schedule" && <StepSchedule />}
              {step === "vendor" && <StepVendor />}
              {step === "review" && <StepReview />}
              {step === "confirmed" && <StepConfirmed />}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Navigation */}
        {step !== "confirmed" && <BookingFooter />}
      </DialogContent>
    </Dialog>
  );
}

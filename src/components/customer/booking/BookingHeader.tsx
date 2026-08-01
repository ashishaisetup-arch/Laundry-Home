import { BookingStepper } from "./BookingStepper";
import { BookingProgress } from "./BookingProgress";
import { useBookingNavigation, STEPS } from "./use-booking";

export function BookingHeader() {
  const { currentIndex } = useBookingNavigation();
  const pct = Math.round(((currentIndex + 1) / STEPS.length) * 100);

  return (
    <header className="shrink-0 h-20 z-20 border-b bg-background flex flex-col justify-center gap-1 px-1">
      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
        <span className="font-semibold tracking-tight" style={{ fontFamily: "var(--font-display)" }}>Booking</span>
        <span>Step {currentIndex + 1} of {STEPS.length} · {pct}% Complete</span>
      </div>
      <BookingStepper />
      <BookingProgress />
    </header>
  );
}

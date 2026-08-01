import { useBookingNavigation, STEPS } from "./use-booking";

export function BookingProgress() {
  const { currentIndex } = useBookingNavigation();
  const pct = Math.round(((currentIndex + 1) / STEPS.length) * 100);

  return (
    <div className="h-0.5 rounded-full bg-border/70 overflow-hidden">
      <div
        className="h-full rounded-full bg-primary transition-[width] duration-[350ms] ease-out"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

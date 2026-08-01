import { useEffect, useLayoutEffect, useRef, useState, Fragment } from "react";
import { motion } from "framer-motion";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { useBookingNavigation, STEPS } from "./use-booking";
import { useIsMobile } from "./use-is-mobile";

function DesktopStepper() {
  const { currentIndex } = useBookingNavigation();

  return (
    <div className="w-full max-w-[1100px] mx-auto flex items-center">
      {STEPS.map((s, i) => {
        const isActive = i === currentIndex;
        const isCompleted = i < currentIndex;
        return (
          <Fragment key={s.id}>
            <div className="flex flex-col items-center gap-1 min-w-0 flex-1">
              <div className="relative w-7 h-7">
                {isActive && (
                  <motion.span
                    layoutId="activeIndicator"
                    className="absolute inset-0 rounded-full bg-primary shadow-lg ring-4 ring-primary/20"
                    transition={{ type: "spring", stiffness: 350, damping: 28 }}
                  />
                )}
                <span className={cn(
                  "relative z-10 flex items-center justify-center w-full h-full rounded-full text-[11px] font-semibold",
                  isActive ? "text-primary-foreground" : isCompleted ? "bg-green-600 text-white" : "bg-border/60 text-muted-foreground"
                )}>
                  {isCompleted ? <Check className="h-3 w-3" /> : i + 1}
                </span>
              </div>
              <span className={cn(
                "text-[10px] leading-none truncate max-w-full",
                isActive ? "font-bold text-foreground" : isCompleted ? "text-green-600" : "text-muted-foreground"
              )}>
                {s.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div className="flex-1 h-0.5 rounded-full bg-border overflow-hidden mx-1 mb-[7px]">
                <div className={cn(
                  "h-full rounded-full bg-green-600 transition-[width] duration-300 ease-out",
                  isCompleted ? "w-full" : "w-0"
                )} />
              </div>
            )}
          </Fragment>
        );
      })}
    </div>
  );
}

export function BookingStepper() {
  const isMobile = useIsMobile();
  const { step, currentIndex } = useBookingNavigation();

  const stepperRef = useRef<HTMLDivElement>(null);
  const stepRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [edgeSpacer, setEdgeSpacer] = useState(0);
  const [showLeftFade, setShowLeftFade] = useState(false);
  const [showRightFade, setShowRightFade] = useState(false);

  useLayoutEffect(() => {
    const container = stepperRef.current;
    if (!container || !isMobile) return;

    const updateSpacer = () => {
      const containerWidth = container.clientWidth;
      const activeChip = stepRefs.current[currentIndex]?.querySelector("[data-step-chip]");
      const chipWidth = activeChip?.clientWidth ?? 112;
      setEdgeSpacer(Math.max(24, containerWidth / 2 - chipWidth / 2));
    };

    updateSpacer();

    const observer = new ResizeObserver(updateSpacer);
    observer.observe(container);

    const activeChip = stepRefs.current[currentIndex]?.querySelector("[data-step-chip]");
    if (activeChip) observer.observe(activeChip);

    return () => observer.disconnect();
  }, [currentIndex, isMobile]);

  useEffect(() => {
    const container = stepperRef.current;
    if (!container || !isMobile) return;

    let raf = 0;
    const handleScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const el = stepperRef.current;
        if (!el) return;
        setShowLeftFade(el.scrollLeft > 10);
        setShowRightFade(el.scrollLeft + el.clientWidth < el.scrollWidth - 10);
      });
    };

    container.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();

    return () => {
      container.removeEventListener("scroll", handleScroll);
      cancelAnimationFrame(raf);
    };
  }, [isMobile, currentIndex]);

  useLayoutEffect(() => {
    const el = stepRefs.current[currentIndex];
    if (!el || !isMobile) return;

    const container = stepperRef.current;
    if (container) {
      const cRect = container.getBoundingClientRect();
      const eRect = el.getBoundingClientRect();
      const centerDist = Math.abs(eRect.left + eRect.width / 2 - cRect.left - cRect.width / 2);
      if (centerDist < 8) return;
    }

    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    el.scrollIntoView({
      behavior: prefersReducedMotion ? "auto" : "smooth",
      inline: "center",
      block: "nearest",
    });
  }, [currentIndex, isMobile]);

  if (!isMobile) {
    return <DesktopStepper />;
  }

  return (
    <div className="relative mb-5 shrink-0">
      <div
        className={cn(
          "absolute inset-y-0 left-0 z-10 bg-gradient-to-r from-background to-transparent pointer-events-none transition-opacity duration-150",
          showLeftFade ? "opacity-100" : "opacity-0"
        )}
        style={{ width: "var(--stepper-fade-width, 20px)" }}
        aria-hidden="true"
      />
      <div
        className={cn(
          "absolute inset-y-0 right-0 z-10 bg-gradient-to-l from-background to-transparent pointer-events-none transition-opacity duration-150",
          showRightFade ? "opacity-100" : "opacity-0"
        )}
        style={{ width: "var(--stepper-fade-width, 20px)" }}
        aria-hidden="true"
      />
      <div key={currentIndex} ref={stepperRef} className="flex items-center gap-6 overflow-x-auto pb-1 snap-x snap-proximity scroll-smooth scrollbar-none">
        <div className="flex-none" style={{ width: edgeSpacer }} />
        {STEPS.map((s, i) => {
          const dist = Math.abs(i - currentIndex);
          const opacity = Math.max(0.08, 1 - dist * 0.35);
          const itemScale = Math.max(0.6, 1 - dist * 0.1);
          const isPast = i < currentIndex;
          return (
            <div key={s.id} ref={(el) => { stepRefs.current[i] = el; }} className="flex-none snap-center">
              <button
                type="button"
                data-step-chip
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs whitespace-nowrap transition-all focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
                  dist === 0
                    ? "bg-primary/10 text-primary font-semibold shadow-sm ring-1 ring-primary/20"
                    : isPast ? "text-green-600" : "text-muted-foreground"
                )}
                style={{ opacity, scale: itemScale }}
                aria-current={dist === 0 ? "step" : undefined}
                aria-label={`Step ${i + 1} of ${STEPS.length}: ${s.label}`}
              >
                {isPast ? (
                  <motion.span
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", stiffness: 400, damping: 20 }}
                  >
                    <Check className="h-3 w-3" />
                  </motion.span>
                ) : (
                  <span className={cn(
                    "w-3 h-3 rounded-full border-2 inline-block transition-all",
                    dist === 0 ? "border-primary bg-primary" : "border-current"
                  )} />
                )}
                <span className="font-medium tracking-tight">{s.label}</span>
              </button>
              {i < STEPS.length - 1 && (
                <div
                  className={cn("h-px shrink-0", isPast ? "bg-green-600" : "bg-border")}
                  style={{ width: 24, opacity: Math.max(0.08, 1 - dist * 0.35) }}
                />
              )}
            </div>
          );
        })}
        <div className="flex-none" style={{ width: edgeSpacer }} />
      </div>
    </div>
  );
}

import { useState, useEffect } from "react";
import { AnimatePresence } from "framer-motion";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AppShell, type NavGroup } from "@/components/shared/app-shell";
import { useAppStore } from "@/lib/store";
import { useOrders } from "@/lib/hooks";
import { useRouterView } from "@/lib/hooks/use-router-view";
import { toast } from "sonner";
import { api } from "@/lib/api/client";
import { BookingFlowV2 as BookingFlow } from "./booking-flow-v2";
import { OrderTracking } from "./order-tracking";
import { ErrorState } from "@/components/shared/error-state";
import { DashboardSkeleton, OrderCardSkeleton } from "@/components/shared/skeleton-card";
import { CustomerDashboard } from "./customer-dashboard";
import { SettingsPage } from "@/components/shared/settings-page";
import { pageTitle, pageSubtitle } from "./customer-helpers";
import { CustomerDiscover } from "./customer-discover";
import { CustomerOrders } from "./customer-orders";
import { CustomerPayments } from "./customer-payments";
import { CustomerCoupons } from "./customer-coupons";
import { CustomerFavorites } from "./customer-favorites";
import { CustomerReviews } from "./customer-reviews";
import { CustomerSubscriptions } from "./customer-subscriptions";
import { CustomerProfile } from "./customer-profile";

export function CustomerApp() {
  const { userId, walletBalance, loyaltyPoints } = useAppStore();
  const [view, setView, handleNavigateFromRouter] = useRouterView("dashboard");
  const [showBooking, setShowBooking] = useState(false);
  const [trackingOrder, setTrackingOrder] = useState<string | null>(null);
  const [discoverArea, setDiscoverArea] = useState<string | null>(null);
  const [bookingLocation, setBookingLocation] = useState<{lat: number; lng: number} | null>(null);
  const { data: ordersHook, loading: ordersLoading, error: ordersError, refetch: refetchOrders } = useOrders(userId ? { customerId: userId } : undefined);
  const setOrders = useAppStore((s) => s.setOrders);
  const patchOrder = useAppStore((s) => s.patchOrder);
  const orders = useAppStore((s) => s.orders);

  useEffect(() => {
    if (ordersHook) setOrders(ordersHook);
  }, [ordersHook, setOrders]);

  const handleNavigate = (v: string) => {
    if (v === "booking") {
      setShowBooking(true);
      return;
    }
    handleNavigateFromRouter(v);
  };

  const handleBookingClose = () => {
    setShowBooking(false);
    refetchOrders();
  };

  const handleCancelOrder = async (orderId: string) => {
    try {
      await api.post(`/api/orders/${orderId}/cancel`);
      patchOrder(orderId, { status: "cancelled", paymentStatus: "refunded" });
      refetchOrders();
      toast.success("Order cancelled", {
        description: "Refund will be processed in 3-5 business days.",
      });
    } catch (err: any) {
      toast.error("Cancel failed", { description: err.message });
    }
  };

  const activeOrders = (orders || []).filter((o) => !["completed", "cancelled"].includes(o.status));
  const completedOrders = (orders || []).filter((o) => o.status === "completed");

  const NAV_GROUPS: NavGroup[] = [
    {
      label: "Customer",
      items: [
        { id: "dashboard", label: "Dashboard", icon: "LayoutDashboard" },
        { id: "profile", label: "My Profile", icon: "User" },
        { id: "discover", label: "Find Vendors", icon: "MapPin" },
        { id: "booking", label: "Book Pickup", icon: "Package", badge: "New" },
        { id: "orders", label: "My Orders", icon: "ClipboardList", badge: activeOrders.length || undefined },
        { id: "subscriptions", label: "Subscription Plans", icon: "Calendar" },
        { id: "payments", label: "Payments & Wallet", icon: "Wallet" },
        { id: "coupons", label: "Coupons & Rewards", icon: "Ticket" },
        { id: "favorites", label: "Favorites", icon: "Heart" },
        { id: "reviews", label: "My Reviews", icon: "Star" },
      ],
    },
  ];

  return (
    <AppShell
      groups={NAV_GROUPS}
      activeView={view}
      onNavigate={handleNavigate}
      pageTitle={pageTitle(view)}
      pageSubtitle={pageSubtitle(view, discoverArea)}
      actions={
        view === "dashboard" || view === "discover" ? (
          <Button
            className="bg-primary hover:bg-primary/90"
            onClick={() => setShowBooking(true)}
          >
            <Plus className="mr-1.5 h-4 w-4" />
            Book Pickup
          </Button>
        ) : undefined
      }
    >
      <AnimatePresence mode="wait">
        {view === "dashboard" && (
          ordersLoading ? <DashboardSkeleton /> : ordersError ? <ErrorState message={ordersError} onRetry={refetchOrders} /> :
          <CustomerDashboard key="d" onTrack={(id) => setTrackingOrder(id)} onBook={() => setShowBooking(true)} onNavigate={setView} onCancel={handleCancelOrder} />
        )}
        {view === "profile" && <CustomerProfile key="pf" />}
        {view === "settings" && <SettingsPage key="set" />}
        {view === "discover" && <CustomerDiscover key="disc" onBook={() => setShowBooking(true)} onLocationChange={setDiscoverArea} onLocationUpdate={(loc) => setBookingLocation(loc ? {lat: loc.lat, lng: loc.lng} : null)} />}
        {view === "orders" && (
          ordersLoading ? <div className="grid md:grid-cols-2 gap-4"><OrderCardSkeleton /><OrderCardSkeleton /></div> : ordersError ? <ErrorState message={ordersError} onRetry={refetchOrders} /> :
          <CustomerOrders
            key="o"
            activeOrders={activeOrders}
            completedOrders={completedOrders}
            onTrack={(id) => setTrackingOrder(id)}
            onCancel={handleCancelOrder}
          />
        )}
        {view === "payments" && <CustomerPayments key="p" walletBalance={walletBalance} />}
        {view === "subscriptions" && <CustomerSubscriptions key="sub" />}
        {view === "coupons" && <CustomerCoupons key="c" loyaltyPoints={loyaltyPoints} />}
        {view === "favorites" && <CustomerFavorites key="f" onBook={() => setShowBooking(true)} />}
        {view === "reviews" && <CustomerReviews key="r" />}
      </AnimatePresence>

      {/* Booking modal */}
      <BookingFlow open={showBooking} onClose={handleBookingClose} location={bookingLocation} />

      {/* Order tracking modal */}
      <OrderTracking
        orderId={trackingOrder}
        onClose={() => setTrackingOrder(null)}
        onCancel={refetchOrders}
      />
    </AppShell>
  );
}

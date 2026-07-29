export function pageTitle(view: string) {
  return {
    dashboard: "Dashboard",
    profile: "My Profile",
    discover: "Find Vendors",
    booking: "Book Pickup",
    orders: "My Orders",
    subscriptions: "Subscription Plans",
    payments: "Payments & Wallet",
    coupons: "Coupons & Rewards",
    favorites: "Favorite Vendors",
    reviews: "My Reviews",
    settings: "Settings",
  }[view] || "Dashboard";
}

export function pageSubtitle(view: string, discoverArea?: string | null) {
  const subtitles: Record<string, string> = {
    dashboard: "Your laundry at a glance",
    profile: "Manage your personal details",
    settings: "Account and app preferences",
    discover: "Discover verified vendors near you",
    booking: "Schedule a pickup in 30 seconds",
    orders: "Track and manage your laundry orders",
    subscriptions: "Save more with monthly subscription plans",
    payments: "Wallet, payment methods & invoices",
    coupons: "Save more on every order",
    favorites: "Your go-to laundry vendors",
    reviews: "Reviews you've shared",
  };
  if (view === "discover" && discoverArea) {
    return `Verified laundry services near ${discoverArea}`;
  }
  return subtitles[view];
}

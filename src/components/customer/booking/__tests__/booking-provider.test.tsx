import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { BookingProvider } from "../BookingProvider";
import { StepCategory } from "../steps/StepCategory";
import { StepServices } from "../steps/StepServices";
import { useBookingNavigation, useBookingSelection, useBookingPricing } from "../use-booking";

const catalog = [
  {
    id: "c1",
    slug: "wash",
    name: "Wash & Fold",
    icon: "Shirt",
    grouping: "main",
    services: [
      {
        id: "s1",
        name: "Wash",
        description: "Standard wash",
        unit: "kg",
        categoryId: "c1",
        isActive: true,
        items: [
          { id: "i1", serviceId: "s1", itemName: "Shirt", itemCategory: "Apparel", unit: "piece", defaultPrice: 30, estimatedTime: "10m", estimatedWeightKg: 0.2, itemMasterId: "m1", isActive: true },
        ],
      },
      {
        id: "s3",
        name: "Laundry Bag",
        description: "Fill a bag and we charge per bag",
        unit: "item",
        categoryId: "c1",
        pricingType: "BAG",
        bagPrice: 99,
        isActive: true,
        items: [
          { id: "i3", serviceId: "s3", itemName: "Laundry Bag", itemCategory: "Bags", unit: "bag", defaultPrice: 99, estimatedTime: "24h", estimatedWeightKg: 1, itemMasterId: "m3", isActive: true },
        ],
      },
    ],
  },
  {
    id: "c2",
    slug: "addons",
    name: "Add-ons",
    icon: "Zap",
    grouping: "addon",
    services: [
      { id: "s2", name: "Stain Removal", slug: "stain_removal", description: "Extra", unit: "flat", categoryId: "c2", isActive: true, items: [] },
      { id: "s6", name: "24 Hour Delivery", slug: "24_hour_delivery", description: "Delivery within 24 hours", unit: "flat", categoryId: "c2", isActive: true, items: [{ id: "i6", serviceId: "s6", itemName: "24 Hour Delivery", itemCategory: "Add-on", unit: "piece", defaultPrice: 49, estimatedTime: "24h", estimatedWeightKg: 0, itemMasterId: "m6", isActive: true }] },
      { id: "s7", name: "Same Day Delivery", slug: "same_day_delivery", description: "Guaranteed same-day delivery", unit: "flat", categoryId: "c2", isActive: true, items: [{ id: "i7", serviceId: "s7", itemName: "Same Day Delivery", itemCategory: "Add-on", unit: "piece", defaultPrice: 99, estimatedTime: "24h", estimatedWeightKg: 0, itemMasterId: "m7", isActive: true }] },
      { id: "s8", name: "Express Pickup", slug: "express_pickup", description: "Pickup within 30 minutes", unit: "flat", categoryId: "c2", isActive: true, items: [{ id: "i8", serviceId: "s8", itemName: "Express Pickup", itemCategory: "Add-on", unit: "piece", defaultPrice: 79, estimatedTime: "30m", estimatedWeightKg: 0, itemMasterId: "m8", isActive: true }] },
    ],
  },
  {
    id: "c3",
    slug: "dry-clean",
    name: "Dry Cleaning",
    icon: "Sparkles",
    grouping: "main",
    services: [
      {
        id: "s4",
        name: "Dry Clean Suit",
        description: "Professional dry cleaning",
        unit: "item",
        categoryId: "c3",
        isActive: true,
        items: [
          { id: "i4", serviceId: "s4", itemName: "Suit", itemCategory: "Apparel", unit: "piece", defaultPrice: 120, estimatedTime: "48h", estimatedWeightKg: 0.5, itemMasterId: "m4", isActive: true },
        ],
      },
    ],
  },
];

// Mirrors the real server payload: services carry snake_case pricing fields
// (pricing_type / bag_price / is_active), items are already camelCase.
const snakeCatalog = [
  {
    id: "c1",
    slug: "wash",
    name: "Wash & Fold",
    icon: "Shirt",
    grouping: "main",
    services: [
      {
        id: "s1",
        name: "Wash",
        description: "Standard wash",
        unit: "kg",
        categoryId: "c1",
        pricing_type: "ITEM",
        is_active: true,
        items: [
          { id: "i1", serviceId: "s1", itemName: "Shirt", itemCategory: "Apparel", unit: "piece", defaultPrice: 30, estimatedTime: "10m", estimatedWeightKg: 0.2, itemMasterId: "m1", isActive: true },
        ],
      },
    ],
  },
  {
    id: "c4",
    slug: "laundry-bags",
    name: "Laundry Bags",
    icon: "ShoppingBag",
    grouping: "main",
    services: [
      {
        id: "s3",
        name: "Laundry Bag",
        description: "Fill a bag and we charge per bag",
        unit: "item",
        categoryId: "c4",
        pricing_type: "BAG",
        bag_price: 99,
        is_active: true,
        items: [
          { id: "i3", serviceId: "s3", itemName: "Laundry Bag", itemCategory: "Bags", unit: "bag", defaultPrice: 99, estimatedTime: "24h", estimatedWeightKg: 1, itemMasterId: "m3", isActive: true },
        ],
      },
      {
        id: "s5",
        name: "Premium Laundry Bag",
        description: "Larger capacity premium bag",
        unit: "item",
        categoryId: "c4",
        pricing_type: "BAG",
        bag_price: 149,
        is_active: true,
        items: [
          { id: "i5", serviceId: "s5", itemName: "Premium Laundry Bag", itemCategory: "Bags", unit: "bag", defaultPrice: 149, estimatedTime: "24h", estimatedWeightKg: 1, itemMasterId: "m5", isActive: true },
        ],
      },
    ],
  },
];

let catalogOverride: unknown[] | null = null;

vi.mock("@/lib/hooks", () => ({
  useServiceCatalog: () => ({ data: catalogOverride ?? catalog }),
  useVendors: () => ({ data: [{ id: "v1", name: "Test Vendor", rating: 4.5, distanceKm: 2 }] }),
  useAddresses: () => ({ data: [], refetch: vi.fn() }),
  useOrders: () => ({ data: [], refetch: vi.fn() }),
  useCustomerFeatures: () => ({
    data: {
      enableSubscriptions: true,
      enableCoupons: true,
      enableWallet: true,
      enableLoyalty: true,
      enableFavorites: true,
      enableReviews: true,
      enableDiscover: true,
      enableOrders: true,
      enableCountItems: true,
      enableLaundryBag: true,
      enableMixedBooking: true,
    },
  }),
}));

vi.mock("@/lib/store", () => ({
  useAppStore: (selector: any) => selector({ walletBalance: 500, loyaltyPoints: 200, fetchWallet: vi.fn() }),
}));

vi.mock("@/lib/api/client", () => ({
  api: { post: vi.fn().mockResolvedValue({ total: 100, breakdown: [] }) },
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

function Probe() {
  const nav = useBookingNavigation();
  const sel = useBookingSelection();
  const pricing = useBookingPricing();
  return (
    <div>
      <span data-testid="step">{nav.step}</span>
      <span data-testid="index">{nav.currentIndex}</span>
      <span data-testid="can-continue">{String(nav.canContinue)}</span>
      <span data-testid="selected-categories">{sel.selectedCategoryIds.join(",")}</span>
      <span data-testid="selected-services">{sel.selectedServiceIds.join(",")}</span>
      <span data-testid="item-keys">{Object.keys(sel.itemQtys).join(",")}</span>
      <span data-testid="booking-type">{sel.bookingType}</span>
      <span data-testid="total-items">{sel.totalItems}</span>
      <span data-testid="total-weight">{sel.totalWeight}</span>
      <span data-testid="vendors-count">{(sel.vendorsList || []).length}</span>
      <span data-testid="total-price">{pricing.totalPrice}</span>
      <span data-testid="pickup-date">{sel.pickupDate}</span>
      <span data-testid="pickup-slot">{sel.pickupSlot}</span>
      <span data-testid="delivery-date">{sel.deliveryDate}</span>
      <span data-testid="delivery-slot">{sel.deliverySlot}</span>
      <span data-testid="addons">{Object.keys(sel.addonEnabled).filter((k) => sel.addonEnabled[k]).join(",")}</span>
      <button data-testid="select-cat" onClick={() => sel.setSelectedCategoryIds(["c1"])}>select category</button>
      <button data-testid="clear-cat" onClick={() => sel.setSelectedCategoryIds([])}>clear category</button>
      <button data-testid="select-svc" onClick={() => sel.setSelectedServiceIds(["s1"])}>select service</button>
      <button data-testid="select-bag" onClick={() => sel.setSelectedServiceIds(["s3"])}>select bag</button>
      <button data-testid="clear-svc" onClick={() => sel.setSelectedServiceIds([])}>clear services</button>
      <button data-testid="select-bag-and-wash" onClick={() => sel.setSelectedServiceIds(["s1", "s3"])}>select bag and wash</button>
      <button data-testid="mode-laundry-bag" onClick={() => sel.setBookingType("laundry_bag")}>mode laundry bag</button>
      <button data-testid="mode-mixed" onClick={() => sel.setBookingType("mixed")}>mode mixed</button>
      <button data-testid="mode-count" onClick={() => sel.setBookingType("count_items")}>mode count</button>
      <button data-testid="go-service" onClick={() => nav.goToStep("serviceType")}>go to services</button>
      <button data-testid="next" onClick={nav.next}>next</button>
      <button data-testid="back" onClick={nav.back}>back</button>
      <button data-testid="close" onClick={nav.close}>close</button>
      <button data-testid="set-items" onClick={() => sel.setItemQtys({ "s1:m1": { serviceId: "s1", itemId: "m1", qty: 2, instructions: [] } })}>set items</button>
      <button data-testid="set-item-qtys" onClick={() => sel.setItemQtys({
        "s1:m1": { serviceId: "s1", itemId: "m1", qty: 2, instructions: [] },
        "s3:m3": { serviceId: "s3", itemId: "m3", qty: 1, instructions: [] },
      })}>set both items</button>
      <button data-testid="toggle-24h" onClick={() => sel.setAddonEnabled((prev) => ({ ...prev, s6: !prev.s6 }))}>toggle 24h</button>
      <button data-testid="toggle-same-day" onClick={() => sel.setAddonEnabled((prev) => ({ ...prev, s7: !prev.s7 }))}>toggle same day</button>
      <button data-testid="toggle-express" onClick={() => sel.setAddonEnabled((prev) => ({ ...prev, s8: !prev.s8 }))}>toggle express</button>
      <button data-testid="pickup-morning" onClick={() => sel.setPickupSlot("9:00 AM - 11:00 AM")}>pickup morning</button>
      <button data-testid="pickup-evening" onClick={() => sel.setPickupSlot("5:00 PM - 7:00 PM")}>pickup evening</button>
    </div>
  );
}

function renderProbe(onClose = vi.fn()) {
  return render(
    <BookingProvider onClose={onClose}>
      <Probe />
    </BookingProvider>
  );
}

afterEach(() => {
  catalogOverride = null;
});

describe("BookingProvider", () => {
  it("starts on the category step with continue disabled", () => {
    renderProbe();
    expect(screen.getByTestId("step")).toHaveTextContent("category");
    expect(screen.getByTestId("index")).toHaveTextContent("0");
    expect(screen.getByTestId("can-continue")).toHaveTextContent("false");
  });

  it("enables continue once a category is selected", () => {
    renderProbe();
    fireEvent.click(screen.getByTestId("select-cat"));
    expect(screen.getByTestId("selected-categories")).toHaveTextContent("c1");
    expect(screen.getByTestId("can-continue")).toHaveTextContent("true");
  });

  it("validates the services step independently", () => {
    renderProbe();
    fireEvent.click(screen.getByTestId("select-cat"));
    fireEvent.click(screen.getByTestId("go-service"));
    expect(screen.getByTestId("step")).toHaveTextContent("serviceType");
    expect(screen.getByTestId("can-continue")).toHaveTextContent("false");

    fireEvent.click(screen.getByTestId("select-svc"));
    expect(screen.getByTestId("can-continue")).toHaveTextContent("true");
  });

  it("navigates next/back within the step list", () => {
    renderProbe();
    fireEvent.click(screen.getByTestId("select-cat"));
    fireEvent.click(screen.getByTestId("next"));
    expect(screen.getByTestId("step")).toHaveTextContent("serviceType");
    fireEvent.click(screen.getByTestId("back"));
    expect(screen.getByTestId("step")).toHaveTextContent("category");
  });

  it("derives item totals and prices from the selection", () => {
    renderProbe();
    fireEvent.click(screen.getByTestId("select-cat"));
    fireEvent.click(screen.getByTestId("select-svc"));
    fireEvent.click(screen.getByTestId("set-items"));
    expect(screen.getByTestId("total-items")).toHaveTextContent("2");
    expect(screen.getByTestId("total-price")).toHaveTextContent("60");
  });

  it("exposes totalWeight and vendorsList so steps never read undefined", () => {
    renderProbe();
    expect(screen.getByTestId("vendors-count")).toHaveTextContent("1");
    expect(screen.getByTestId("total-weight")).toHaveTextContent("0");
    fireEvent.click(screen.getByTestId("select-cat"));
    fireEvent.click(screen.getByTestId("select-svc"));
    fireEvent.click(screen.getByTestId("set-items"));
    expect(screen.getByTestId("total-weight")).toHaveTextContent("0.4");
  });

  it("close() resets all state and calls onClose", () => {
    const onClose = vi.fn();
    renderProbe(onClose);
    fireEvent.click(screen.getByTestId("select-cat"));
    fireEvent.click(screen.getByTestId("go-service"));
    fireEvent.click(screen.getByTestId("close"));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("step")).toHaveTextContent("category");
    expect(screen.getByTestId("selected-categories")).toHaveTextContent("");
    expect(screen.getByTestId("can-continue")).toHaveTextContent("false");
  });

  it("auto-switches to laundry_bag when only a bag service is selected", () => {
    renderProbe();
    expect(screen.getByTestId("booking-type")).toHaveTextContent("count_items");
    fireEvent.click(screen.getByTestId("select-bag"));
    expect(screen.getByTestId("booking-type")).toHaveTextContent("laundry_bag");
  });

  it("auto-switches to mixed when bag + item services are selected", () => {
    renderProbe();
    fireEvent.click(screen.getByTestId("select-bag-and-wash"));
    expect(screen.getByTestId("booking-type")).toHaveTextContent("mixed");
  });

  it("reverts to count_items when the bag service is deselected", () => {
    renderProbe();
    fireEvent.click(screen.getByTestId("select-bag"));
    expect(screen.getByTestId("booking-type")).toHaveTextContent("laundry_bag");
    fireEvent.click(screen.getByTestId("select-svc"));
    expect(screen.getByTestId("booking-type")).toHaveTextContent("count_items");
  });

  it("laundry_bag mode auto-selects bags and removes item services", () => {
    renderProbe();
    fireEvent.click(screen.getByTestId("select-svc"));
    fireEvent.click(screen.getByTestId("mode-laundry-bag"));
    expect(screen.getByTestId("booking-type")).toHaveTextContent("laundry_bag");
    expect(screen.getByTestId("selected-services")).toHaveTextContent("s3");
    expect(screen.getByTestId("can-continue")).toHaveTextContent("true");
  });

  it("mixed mode auto-selects bags and keeps item services", () => {
    renderProbe();
    fireEvent.click(screen.getByTestId("select-svc"));
    fireEvent.click(screen.getByTestId("mode-mixed"));
    expect(screen.getByTestId("booking-type")).toHaveTextContent("mixed");
    expect(screen.getByTestId("selected-services")).toHaveTextContent("s1,s3");
    expect(screen.getByTestId("can-continue")).toHaveTextContent("true");
  });

  it("count_items mode removes bag services from the selection", () => {
    renderProbe();
    fireEvent.click(screen.getByTestId("select-bag-and-wash"));
    fireEvent.click(screen.getByTestId("mode-count"));
    expect(screen.getByTestId("booking-type")).toHaveTextContent("count_items");
    expect(screen.getByTestId("selected-services")).toHaveTextContent("s1");
    fireEvent.click(screen.getByTestId("go-service"));
    expect(screen.getByTestId("can-continue")).toHaveTextContent("true");
  });

  it("category toggle prunes only the removed category's services and quantities", () => {
    render(
      <BookingProvider onClose={vi.fn()}>
        <StepCategory />
        <Probe />
      </BookingProvider>
    );
    fireEvent.click(screen.getByRole("button", { name: /Wash & Fold/ }));
    fireEvent.click(screen.getByRole("button", { name: /Dry Cleaning/ }));
    expect(screen.getByTestId("selected-categories")).toHaveTextContent("c1,c3");
    fireEvent.click(screen.getByTestId("select-svc"));
    fireEvent.click(screen.getByTestId("set-items"));
    expect(screen.getByTestId("item-keys")).toHaveTextContent("s1:m1");

    fireEvent.click(screen.getByRole("button", { name: /Wash & Fold/ }));
    expect(screen.getByTestId("selected-categories")).toHaveTextContent("c3");
    expect(screen.getByTestId("selected-services")).toHaveTextContent("");
    expect(screen.getByTestId("item-keys")).toBeEmptyDOMElement();
  });

  it("reverts to count_items when the selection is emptied via a category change", () => {
    renderProbe();
    fireEvent.click(screen.getByTestId("select-bag"));
    fireEvent.click(screen.getByTestId("mode-laundry-bag"));
    expect(screen.getByTestId("booking-type")).toHaveTextContent("laundry_bag");
    fireEvent.click(screen.getByTestId("clear-svc"));
    expect(screen.getByTestId("booking-type")).toHaveTextContent("count_items");
  });

  it("service toggle prunes only that service's quantities", () => {
    render(
      <BookingProvider onClose={vi.fn()}>
        <StepServices />
        <Probe />
      </BookingProvider>
    );
    fireEvent.click(screen.getByTestId("select-cat"));
    fireEvent.click(screen.getByTestId("select-bag-and-wash"));
    fireEvent.click(screen.getByTestId("set-item-qtys"));
    expect(screen.getByTestId("item-keys")).toHaveTextContent("s1:m1,s3:m3");

    fireEvent.click(screen.getByRole("button", { name: /Fill a bag and we charge per bag/ }));
    expect(screen.getByTestId("selected-services")).toHaveTextContent("s1");
    expect(screen.getByTestId("item-keys")).toHaveTextContent("s1:m1");
    expect(screen.getByTestId("item-keys")).not.toHaveTextContent("s3:m3");
  });

  it("laundry_bag mode with server-shaped catalog shows the bag category and bag services", () => {
    catalogOverride = snakeCatalog;
    renderProbe();
    fireEvent.click(screen.getByTestId("select-cat"));
    fireEvent.click(screen.getByTestId("select-svc"));
    fireEvent.click(screen.getByTestId("go-service"));
    fireEvent.click(screen.getByTestId("mode-laundry-bag"));
    expect(screen.getByTestId("booking-type")).toHaveTextContent("laundry_bag");
    expect(screen.getByTestId("selected-services")).toHaveTextContent("s3,s5");
    expect(screen.getByTestId("selected-services")).not.toHaveTextContent("s1");
    expect(screen.getByTestId("selected-categories")).toHaveTextContent("c4");
    expect(screen.getByTestId("selected-categories")).not.toHaveTextContent("c1");
    expect(screen.getByTestId("can-continue")).toHaveTextContent("true");
  });

  it("mixed mode with server-shaped catalog keeps both bag and item services", () => {
    catalogOverride = snakeCatalog;
    renderProbe();
    fireEvent.click(screen.getByTestId("select-cat"));
    fireEvent.click(screen.getByTestId("select-svc"));
    fireEvent.click(screen.getByTestId("mode-mixed"));
    expect(screen.getByTestId("booking-type")).toHaveTextContent("mixed");
    expect(screen.getByTestId("selected-services")).toHaveTextContent("s1");
    expect(screen.getByTestId("selected-services")).toHaveTextContent("s3,s5");
    expect(screen.getByTestId("selected-categories")).toHaveTextContent("c1");
    expect(screen.getByTestId("selected-categories")).toHaveTextContent("c4");
    expect(screen.getByTestId("can-continue")).toHaveTextContent("true");
  });

  it("switching laundry_bag -> count_items restores item services and quantities", () => {
    renderProbe();
    fireEvent.click(screen.getByTestId("select-cat"));
    fireEvent.click(screen.getByTestId("select-svc"));
    fireEvent.click(screen.getByTestId("set-items"));
    expect(screen.getByTestId("item-keys")).toHaveTextContent("s1:m1");

    fireEvent.click(screen.getByTestId("mode-laundry-bag"));
    expect(screen.getByTestId("booking-type")).toHaveTextContent("laundry_bag");
    expect(screen.getByTestId("selected-services")).toHaveTextContent("s3");
    expect(screen.getByTestId("selected-services")).not.toHaveTextContent("s1");
    expect(screen.getByTestId("item-keys")).toBeEmptyDOMElement();

    fireEvent.click(screen.getByTestId("mode-count"));
    expect(screen.getByTestId("booking-type")).toHaveTextContent("count_items");
    expect(screen.getByTestId("selected-services")).toHaveTextContent("s1");
    expect(screen.getByTestId("selected-services")).not.toHaveTextContent("s3");
    expect(screen.getByTestId("item-keys")).toHaveTextContent("s1:m1");
    expect(screen.getByTestId("can-continue")).toHaveTextContent("true");
  });

  it("switching laundry_bag -> mixed restores item services and keeps bags", () => {
    renderProbe();
    fireEvent.click(screen.getByTestId("select-cat"));
    fireEvent.click(screen.getByTestId("select-svc"));
    fireEvent.click(screen.getByTestId("set-items"));
    fireEvent.click(screen.getByTestId("mode-laundry-bag"));
    expect(screen.getByTestId("selected-services")).toHaveTextContent("s3");

    fireEvent.click(screen.getByTestId("mode-mixed"));
    expect(screen.getByTestId("booking-type")).toHaveTextContent("mixed");
    expect(screen.getByTestId("selected-services")).toHaveTextContent("s1");
    expect(screen.getByTestId("selected-services")).toHaveTextContent("s3");
    expect(screen.getByTestId("item-keys")).toHaveTextContent("s1:m1");
    expect(screen.getByTestId("can-continue")).toHaveTextContent("true");
  });

  it("auto-adapt revert restores stashed item services when the bag is deselected", () => {
    renderProbe();
    fireEvent.click(screen.getByTestId("select-cat"));
    fireEvent.click(screen.getByTestId("select-svc"));
    fireEvent.click(screen.getByTestId("mode-laundry-bag"));
    expect(screen.getByTestId("selected-services")).toHaveTextContent("s3");

    fireEvent.click(screen.getByTestId("select-svc"));
    expect(screen.getByTestId("booking-type")).toHaveTextContent("count_items");
    expect(screen.getByTestId("selected-services")).toHaveTextContent("s1");
    expect(screen.getByTestId("selected-services")).not.toHaveTextContent("s3");
  });

  it("re-clicking the active mode does not destroy the stash", () => {
    renderProbe();
    fireEvent.click(screen.getByTestId("select-cat"));
    fireEvent.click(screen.getByTestId("select-svc"));
    fireEvent.click(screen.getByTestId("mode-laundry-bag"));
    fireEvent.click(screen.getByTestId("mode-laundry-bag"));
    fireEvent.click(screen.getByTestId("mode-count"));
    expect(screen.getByTestId("booking-type")).toHaveTextContent("count_items");
    expect(screen.getByTestId("selected-services")).toHaveTextContent("s1");
  });

  it("mixed mode auto-adds item categories when none are selected", () => {
    renderProbe();
    fireEvent.click(screen.getByTestId("mode-mixed"));
    expect(screen.getByTestId("booking-type")).toHaveTextContent("mixed");
    expect(screen.getByTestId("selected-categories")).toHaveTextContent("c1");
    expect(screen.getByTestId("selected-services")).toHaveTextContent("s3");
    expect(screen.getByTestId("can-continue")).toHaveTextContent("true");
  });

  it("count_items mode auto-adds item categories when none are selected", () => {
    renderProbe();
    fireEvent.click(screen.getByTestId("mode-count"));
    expect(screen.getByTestId("booking-type")).toHaveTextContent("count_items");
    expect(screen.getByTestId("selected-categories")).toHaveTextContent("c1,c3");
    expect(screen.getByTestId("selected-services")).toHaveTextContent("");
  });

  it("mixed mode with server-shaped catalog shows both bag and service selection", () => {
    catalogOverride = snakeCatalog;
    renderProbe();
    fireEvent.click(screen.getByTestId("mode-mixed"));
    expect(screen.getByTestId("booking-type")).toHaveTextContent("mixed");
    expect(screen.getByTestId("selected-categories")).toHaveTextContent("c4,c1");
    expect(screen.getByTestId("selected-services")).toHaveTextContent("s3,s5");
    expect(screen.getByTestId("can-continue")).toHaveTextContent("true");
  });

  it("pre-selected item categories are respected when entering mixed mode", () => {
    renderProbe();
    fireEvent.click(screen.getByTestId("select-cat"));
    fireEvent.click(screen.getByTestId("mode-mixed"));
    expect(screen.getByTestId("selected-categories")).toHaveTextContent("c1");
    expect(screen.getByTestId("selected-categories")).not.toHaveTextContent("c3");
    expect(screen.getByTestId("selected-services")).toHaveTextContent("s3");
  });

  it("auto-adapt revert auto-adds item categories when leaving laundry_bag", () => {
    catalogOverride = snakeCatalog;
    renderProbe();
    fireEvent.click(screen.getByTestId("select-cat"));
    fireEvent.click(screen.getByTestId("mode-laundry-bag"));
    expect(screen.getByTestId("selected-categories")).toHaveTextContent("c4");
    fireEvent.click(screen.getByTestId("select-svc"));
    expect(screen.getByTestId("booking-type")).toHaveTextContent("count_items");
    expect(screen.getByTestId("selected-categories")).toHaveTextContent("c1");
    expect(screen.getByTestId("selected-services")).toHaveTextContent("s1");
  });

  it("24-hour add-on does not invent a delivery window before pickup is chosen", () => {
    renderProbe();
    fireEvent.click(screen.getByTestId("toggle-24h"));
    expect(screen.getByTestId("addons")).toHaveTextContent("s6");
    expect(screen.getByTestId("pickup-date")).toHaveTextContent("Today");
    expect(screen.getByTestId("pickup-slot")).toHaveTextContent("");
    expect(screen.getByTestId("delivery-date")).toHaveTextContent("Day after");
    expect(screen.getByTestId("delivery-slot")).toHaveTextContent("");
  });

  it("24-hour add-on mirrors the pickup window on the next day once pickup is chosen", () => {
    renderProbe();
    fireEvent.click(screen.getByTestId("toggle-24h"));
    fireEvent.click(screen.getByTestId("pickup-morning"));
    expect(screen.getByTestId("pickup-slot")).toHaveTextContent("9:00 AM - 11:00 AM");
    expect(screen.getByTestId("delivery-date")).toHaveTextContent("Tomorrow");
    expect(screen.getByTestId("delivery-slot")).toHaveTextContent("9:00 AM - 11:00 AM");
  });

  it("same-day add-on auto-picks the earliest compliant delivery slot once pickup is chosen", () => {
    renderProbe();
    fireEvent.click(screen.getByTestId("toggle-same-day"));
    expect(screen.getByTestId("delivery-slot")).toHaveTextContent("");
    fireEvent.click(screen.getByTestId("pickup-morning"));
    expect(screen.getByTestId("delivery-date")).toHaveTextContent("Today");
    expect(screen.getByTestId("delivery-slot")).toHaveTextContent("11:00 AM - 1:00 PM");
  });

  it("express pick-up add-on forces today + the express slot without touching delivery", () => {
    renderProbe();
    fireEvent.click(screen.getByTestId("toggle-express"));
    expect(screen.getByTestId("pickup-date")).toHaveTextContent("Today");
    expect(screen.getByTestId("pickup-slot")).toHaveTextContent("Express Pickup (within 30 mins)");
    expect(screen.getByTestId("delivery-date")).toHaveTextContent("Day after");
    expect(screen.getByTestId("delivery-slot")).toHaveTextContent("");
  });

  it("disabling a time add-on lifts the schedule constraints", () => {
    renderProbe();
    fireEvent.click(screen.getByTestId("toggle-24h"));
    fireEvent.click(screen.getByTestId("pickup-morning"));
    expect(screen.getByTestId("delivery-slot")).toHaveTextContent("9:00 AM - 11:00 AM");
    fireEvent.click(screen.getByTestId("toggle-24h"));
    fireEvent.click(screen.getByTestId("pickup-evening"));
    expect(screen.getByTestId("pickup-slot")).toHaveTextContent("5:00 PM - 7:00 PM");
    expect(screen.getByTestId("delivery-slot")).toHaveTextContent("9:00 AM - 11:00 AM");
  });
});

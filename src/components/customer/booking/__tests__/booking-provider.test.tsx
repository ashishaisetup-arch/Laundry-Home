import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { BookingProvider } from "../BookingProvider";
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
    ],
  },
  {
    id: "c2",
    slug: "addons",
    name: "Add-ons",
    icon: "Zap",
    grouping: "addon",
    services: [{ id: "s2", name: "Stain Removal", description: "Extra", unit: "flat", categoryId: "c2", isActive: true, items: [] }],
  },
];

vi.mock("@/lib/hooks", () => ({
  useServiceCatalog: () => ({ data: catalog }),
  useVendors: () => ({ data: [{ id: "v1", name: "Test Vendor", rating: 4.5, distanceKm: 2 }] }),
  useAddresses: () => ({ data: [], refetch: vi.fn() }),
  useOrders: () => ({ data: [], refetch: vi.fn() }),
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
      <span data-testid="total-items">{sel.totalItems}</span>
      <span data-testid="total-weight">{sel.totalWeight}</span>
      <span data-testid="vendors-count">{(sel.vendorsList || []).length}</span>
      <span data-testid="total-price">{pricing.totalPrice}</span>
      <button data-testid="select-cat" onClick={() => sel.setSelectedCategoryIds(["c1"])}>select category</button>
      <button data-testid="clear-cat" onClick={() => sel.setSelectedCategoryIds([])}>clear category</button>
      <button data-testid="select-svc" onClick={() => sel.setSelectedServiceIds(["s1"])}>select service</button>
      <button data-testid="go-service" onClick={() => nav.goToStep("serviceType")}>go to services</button>
      <button data-testid="next" onClick={nav.next}>next</button>
      <button data-testid="back" onClick={nav.back}>back</button>
      <button data-testid="close" onClick={nav.close}>close</button>
      <button data-testid="set-items" onClick={() => sel.setItemQtys({ m1: { itemId: "m1", qty: 2, instructions: [] } })}>set items</button>
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
});

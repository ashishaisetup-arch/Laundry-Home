import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { CustomerOrderTimeline } from "../customer-order-timeline";
import type { Order } from "@/lib/types";

function makeOrder(overrides: Partial<Order> = {}): Order {
  return {
    id: "o1",
    code: "LH100",
    customerId: "c1",
    customerName: "Test",
    customerAvatar: "",
    vendorId: "v1",
    vendorName: "Vendor",
    vendorLogoInitials: "V",
    vendorLogoColor: "#8b5cf6",
    status: "placed",
    currentStageIndex: 0,
    stages: [],
    items: [],
    pickupLat: null,
    pickupLng: null,
    deliveryLat: null,
    deliveryLng: null,
    pickupAddress: "",
    pickupArea: "",
    pickupDate: "",
    pickupSlot: "",
    deliveryDate: "",
    deliverySlot: "",
    estimatedDeliveryAt: "",
    amount: 0,
    taxes: 0,
    platformFee: 0,
    deliveryFee: 0,
    total: 0,
    paymentMethod: "cod",
    paymentStatus: "pending",
    express: false,
    garmentCount: 0,
    createdAt: "",
    ...overrides,
  };
}

describe("CustomerOrderTimeline", () => {
  it("renders all seven milestones", () => {
    render(<CustomerOrderTimeline order={makeOrder({ status: "placed" })} />);
    expect(screen.getByText("Order Confirmed")).toBeInTheDocument();
    expect(screen.getByText("Pickup Scheduled")).toBeInTheDocument();
    expect(screen.getByText("Picked Up")).toBeInTheDocument();
    expect(screen.getByText("Being Processed")).toBeInTheDocument();
    expect(screen.getByText("Ready for Delivery")).toBeInTheDocument();
    expect(screen.getByText("Out for Delivery")).toBeInTheDocument();
    expect(screen.getByText("Delivered")).toBeInTheDocument();
  });

  it("marks the active milestone with its description and ETA", () => {
    const order = makeOrder({ status: "washing", estimatedDeliveryAt: "2026-06-13T18:00:00" });
    render(<CustomerOrderTimeline order={order} />);
    expect(screen.getByText("Being Processed")).toBeInTheDocument();
    expect(screen.getByText("Your laundry is being cleaned and prepared.")).toBeInTheDocument();
    expect(screen.getByText(/Estimated completion/)).toBeInTheDocument();
  });

  it("shows done milestones as complete and skipped ones counted done", () => {
    const order = makeOrder({ status: "pickup_completed", currentStageIndex: 4 });
    render(<CustomerOrderTimeline order={order} />);
    expect(screen.getAllByTestId("milestone-check").length).toBeGreaterThanOrEqual(2);
  });

  it("shows liveEta on the out-for-delivery milestone", () => {
    const order = makeOrder({ status: "out_for_delivery", currentStageIndex: 15 });
    render(<CustomerOrderTimeline order={order} liveEta="Arriving in ~18 min" />);
    expect(screen.getByText("Arriving in ~18 min")).toBeInTheDocument();
  });

  it("shows the terminal cancelled state instead of the journey", () => {
    const order = makeOrder({ status: "cancelled", currentStageIndex: 8 });
    render(<CustomerOrderTimeline order={order} />);
    expect(screen.getByText("Order Cancelled")).toBeInTheDocument();
    expect(screen.queryByText("Pickup Scheduled")).not.toBeInTheDocument();
  });

  it("shows timestamps from the milestone's stage group", () => {
    const order = makeOrder({
      status: "washing",
      currentStageIndex: 8,
      stages: [
        { stage: "placed", label: "x", timestamp: "2026-06-12T10:32:00Z", done: true },
        { stage: "vendor_assigned", label: "x", timestamp: "2026-06-12T11:00:00Z", done: true },
        { stage: "washing", label: "x", timestamp: "2026-06-13T09:14:00Z", done: true },
      ],
    });
    render(<CustomerOrderTimeline order={order} />);
    expect(screen.getByText(/12 Jun, 04:30/)).toBeInTheDocument();
  });
});

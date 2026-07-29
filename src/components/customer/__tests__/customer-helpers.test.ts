import { describe, it, expect } from "vitest";
import { pageTitle, pageSubtitle } from "../customer-helpers";

describe("pageTitle", () => {
  it("returns title for known views", () => {
    expect(pageTitle("dashboard")).toBe("Dashboard");
    expect(pageTitle("discover")).toBe("Find Vendors");
    expect(pageTitle("booking")).toBe("Book Pickup");
    expect(pageTitle("orders")).toBe("My Orders");
    expect(pageTitle("subscriptions")).toBe("Subscription Plans");
    expect(pageTitle("payments")).toBe("Payments & Wallet");
    expect(pageTitle("coupons")).toBe("Coupons & Rewards");
    expect(pageTitle("favorites")).toBe("Favorite Vendors");
    expect(pageTitle("reviews")).toBe("My Reviews");
    expect(pageTitle("profile")).toBe("My Profile");
    expect(pageTitle("settings")).toBe("Settings");
  });

  it("returns fallback for unknown views", () => {
    expect(pageTitle("unknown")).toBe("Dashboard");
  });
});

describe("pageSubtitle", () => {
  it("returns subtitle for known views", () => {
    expect(pageSubtitle("dashboard")).toMatch(/glance/);
    expect(pageSubtitle("discover")).toMatch(/near you/);
    expect(pageSubtitle("orders")).toMatch(/Track/);
  });

  it("returns undefined for unknown views", () => {
    expect(pageSubtitle("unknown")).toBeUndefined();
  });

  it("overrides discover subtitle when area is provided", () => {
    expect(pageSubtitle("discover", "Indiranagar")).toMatch(/Indiranagar/);
  });
});

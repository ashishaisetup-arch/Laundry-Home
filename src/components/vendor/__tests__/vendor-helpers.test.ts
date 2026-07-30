import { describe, it, expect } from "vitest";
import { pageTitle, pageSubtitle } from "../vendor-helpers";

describe("pageTitle", () => {
  it("returns title for known views", () => {
    expect(pageTitle("dashboard")).toBe("Vendor Dashboard");
    expect(pageTitle("orders")).toBe("Order Management");
    expect(pageTitle("processing")).toBe("Laundry Processing");
    expect(pageTitle("inventory")).toBe("Garment Inventory");
    expect(pageTitle("staff")).toBe("Staff Management");
    expect(pageTitle("services")).toBe("Service Management");
    expect(pageTitle("analytics")).toBe("Analytics & Reports");
    expect(pageTitle("profile")).toBe("My Profile");
    expect(pageTitle("settings")).toBe("Settings");
  });

  it("returns fallback for unknown views", () => {
    expect(pageTitle("unknown")).toBe("Dashboard");
  });
});

describe("pageSubtitle", () => {
  it("returns subtitle for known views", () => {
    expect(pageSubtitle("dashboard")).toMatch(/FreshFold/);
    expect(pageSubtitle("orders")).toMatch(/incoming/);
    expect(pageSubtitle("processing")).toMatch(/garment/);
    expect(pageSubtitle("inventory")).toMatch(/garment/);
    expect(pageSubtitle("analytics")).toMatch(/Revenue/);
  });

  it("returns undefined for unknown views", () => {
    expect(pageSubtitle("unknown")).toBeUndefined();
  });
});

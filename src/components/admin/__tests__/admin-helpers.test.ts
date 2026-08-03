import { describe, it, expect } from "vitest";
import { pageTitle, pageSubtitle, NAV_GROUPS, ICONS } from "../admin-helpers";

describe("pageTitle", () => {
  it("returns title for known views", () => {
    expect(pageTitle("dashboard")).toBe("Operations Dashboard");
    expect(pageTitle("vendors")).toBe("Vendor Management");
    expect(pageTitle("orders")).toBe("Order Monitoring");
    expect(pageTitle("commission")).toBe("Commission Management");
    expect(pageTitle("support")).toBe("Customer Support");
    expect(pageTitle("marketing")).toBe("Marketing & Campaigns");
    expect(pageTitle("reports")).toBe("Reports & Analytics");
    expect(pageTitle("livemap")).toBe("Live Map");
    expect(pageTitle("ai")).toBe("AI Features");
    expect(pageTitle("profile")).toBe("My Profile");
    expect(pageTitle("settings")).toBe("Settings");
  });

  it("returns fallback for unknown views", () => {
    expect(pageTitle("unknown")).toBe("Dashboard");
  });
});

describe("pageSubtitle", () => {
  it("returns subtitle for known views", () => {
    expect(pageSubtitle("dashboard")).toMatch(/Centralised/);
    expect(pageSubtitle("vendors")).toMatch(/Onboard/);
    expect(pageSubtitle("orders")).toMatch(/Monitor/);
  });

  it("returns undefined for unknown views", () => {
    expect(pageSubtitle("unknown")).toBeUndefined();
  });
});

describe("NAV_GROUPS", () => {
  it("has the control center group with all items", () => {
    expect(NAV_GROUPS).toHaveLength(1);
    expect(NAV_GROUPS[0].label).toBe("Control Center");
    expect(NAV_GROUPS[0].items).toHaveLength(9);
  });

  it("includes all required nav items", () => {
    const ids = NAV_GROUPS[0].items.map((i) => i.id);
    expect(ids).toContain("dashboard");
    expect(ids).toContain("vendors");
    expect(ids).toContain("orders");
    expect(ids).toContain("commission");
    expect(ids).toContain("support");
    expect(ids).toContain("marketing");
    expect(ids).toContain("reports");
    expect(ids).toContain("livemap");
    expect(ids).toContain("ai");
  });
});

describe("ICONS", () => {
  it("contains all expected icon keys", () => {
    const keys = ["Users", "Store", "Activity", "IndianRupee", "Percent", "Smile", "Clock", "XCircle"];
    keys.forEach((k) => expect(ICONS).toHaveProperty(k));
  });

  it("returns a renderable component for each key", () => {
    Object.values(ICONS).forEach((Icon) => {
      expect(Icon).toBeDefined();
      expect(Icon.displayName || Icon.name || typeof Icon).toBeTruthy();
    });
  });
});

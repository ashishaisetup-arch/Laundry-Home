import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { pageTitle, pageSubtitle, NAV_GROUPS, Crown } from "../superadmin-helpers";

describe("pageTitle", () => {
  it("returns title for known views", () => {
    expect(pageTitle("dashboard")).toBe("Control Center");
    expect(pageTitle("vendors")).toBe("Vendors");
    expect(pageTitle("rbac")).toBe("Roles & Permissions");
    expect(pageTitle("users")).toBe("User Management");
    expect(pageTitle("audit")).toBe("Audit Logs");
    expect(pageTitle("features")).toBe("Feature Flags");
    expect(pageTitle("catalog")).toBe("Service Catalog");
    expect(pageTitle("integrations")).toBe("API & Webhooks");
    expect(pageTitle("system")).toBe("System Configuration");
    expect(pageTitle("profile")).toBe("My Profile");
    expect(pageTitle("settings")).toBe("Settings");
  });

  it("returns fallback for unknown views", () => {
    expect(pageTitle("unknown")).toBe("Super Admin");
  });
});

describe("pageSubtitle", () => {
  it("returns subtitle for known views", () => {
    expect(pageSubtitle("dashboard")).toMatch(/Super Admin/);
    expect(pageSubtitle("vendors")).toMatch(/KYC/);
    expect(pageSubtitle("users")).toMatch(/staff/);
  });

  it("returns undefined for unknown views", () => {
    expect(pageSubtitle("unknown")).toBeUndefined();
  });
});

describe("NAV_GROUPS", () => {
  it("has the super admin group with all items", () => {
    expect(NAV_GROUPS).toHaveLength(1);
    expect(NAV_GROUPS[0].label).toBe("Super Admin");
    expect(NAV_GROUPS[0].items).toHaveLength(10);
  });

  it("includes all required nav items", () => {
    const ids = NAV_GROUPS[0].items.map((i) => i.id);
    expect(ids).toContain("dashboard");
    expect(ids).toContain("onboard");
    expect(ids).toContain("vendors");
    expect(ids).toContain("rbac");
    expect(ids).toContain("users");
    expect(ids).toContain("audit");
    expect(ids).toContain("features");
    expect(ids).toContain("catalog");
    expect(ids).toContain("integrations");
    expect(ids).toContain("system");
  });
});

describe("Crown", () => {
  it("renders an svg element", () => {
    const { container } = render(<Crown />);
    const svg = container.querySelector("svg");
    expect(svg).toBeInTheDocument();
  });

  it("applies className prop", () => {
    const { container } = render(<Crown className="custom-class" />);
    const svg = container.querySelector("svg");
    expect(svg).toHaveClass("custom-class");
  });
});

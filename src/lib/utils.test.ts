import { describe, it, expect } from "vitest";
import { cn, formatINR, formatINRDecimal } from "./utils";

describe("cn", () => {
  it("merges class names", () => {
    expect(cn("px-4", "py-2")).toBe("px-4 py-2");
  });

  it("handles conditional classes", () => {
    expect(cn("base", false && "hidden", "visible")).toBe("base visible");
  });

  it("resolves tailwind conflicts", () => {
    expect(cn("px-4", "px-6")).toBe("px-6");
  });
});

describe("formatINR", () => {
  it("formats whole numbers", () => {
    expect(formatINR(100)).toBe("₹100");
  });

  it("formats thousands", () => {
    expect(formatINR(1500)).toBe("₹1,500");
  });

  it("formats lakhs", () => {
    expect(formatINR(150000)).toBe("₹1,50,000");
  });

  it("formats crores", () => {
    expect(formatINR(15000000)).toBe("₹1,50,00,000");
  });

  it("handles zero", () => {
    expect(formatINR(0)).toBe("₹0");
  });
});

describe("formatINRDecimal", () => {
  it("formats with 2 decimal places", () => {
    expect(formatINRDecimal(100.5)).toBe("₹100.50");
  });

  it("rounds to 2 decimals", () => {
    expect(formatINRDecimal(99.999)).toBe("₹100.00");
  });

  it("handles zero", () => {
    expect(formatINRDecimal(0)).toBe("₹0.00");
  });
});

import { describe, it, expect } from "vitest";
import { formatAddress } from "./address";

describe("formatAddress", () => {
  it("formats the structured components in canonical order", () => {
    expect(
      formatAddress({
        flatNo: "Apartment 204",
        buildingName: "Prestige Shantiniketan",
        line: "Whitefield Main Road",
        area: "Mahadevapura",
        city: "Bangalore",
        pincode: "560048",
      })
    ).toBe("Apartment 204, Prestige Shantiniketan, Whitefield Main Road, Mahadevapura, Bangalore - 560048");
  });

  it("omits empty parts and stays usable for structured legacy rows", () => {
    expect(
      formatAddress({ line: "Flat 2B, Building name", area: "Horamavu", city: "Bengaluru", pincode: "560113" })
    ).toBe("Flat 2B, Building name, Horamavu, Bengaluru - 560113");
  });

  it("appends a landmark when present", () => {
    expect(
      formatAddress({
        buildingName: "ITPL",
        line: "Whitefield Main Rd",
        city: "Bengaluru",
        pincode: "560066",
        landmark: "ITPL Gate 2",
      })
    ).toBe("ITPL, Whitefield Main Rd, Bengaluru - 560066, Near ITPL Gate 2");
  });

  it("returns empty string when nothing is provided", () => {
    expect(formatAddress({})).toBe("");
  });
});
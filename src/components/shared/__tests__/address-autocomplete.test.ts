import { describe, expect, it } from "vitest";
import { extractPlace } from "../address-autocomplete";

function comp(type: string, longName: string) {
  return { types: [type], long_name: longName, short_name: longName };
}

const location = { lat: () => 12.97, lng: () => 77.59 };

describe("extractPlace street/area locality split", () => {
  it("keeps the closest locality in street and the broad area in area", () => {
    const place: any = {
      place_id: "p1",
      formatted_address: "ECC Road, Pattandur Agrahara, Whitefield, Bengaluru, Karnataka 560066, India",
      address_components: [
        comp("route", "ECC Road"),
        comp("sublocality_level_2", "Pattandur Agrahara"),
        comp("neighborhood", "Whitefield"),
        comp("sublocality_level_1", "Whitefield"),
        comp("locality", "Bengaluru"),
        comp("administrative_area_level_1", "Karnataka"),
        comp("postal_code", "560066"),
      ],
      geometry: { location },
    };

    const r = extractPlace(place)!;
    expect(r.streetAddress).toBe("ECC Road, Pattandur Agrahara");
    expect(r.area).toBe("Whitefield");
  });

  it("dedupes a locality already contained in the road name", () => {
    const place: any = {
      place_id: "p2",
      formatted_address: "Pattandur Agrahara ECC Road, Whitefield, Bengaluru, Karnataka 560066, India",
      address_components: [
        comp("route", "Pattandur Agrahara ECC Road"),
        comp("sublocality_level_2", "Pattandur Agrahara"),
        comp("sublocality_level_1", "Whitefield"),
        comp("locality", "Bengaluru"),
        comp("administrative_area_level_1", "Karnataka"),
        comp("postal_code", "560066"),
      ],
      geometry: { location },
    };

    const r = extractPlace(place)!;
    expect(r.streetAddress).toBe("Pattandur Agrahara ECC Road");
    expect(r.area).toBe("Whitefield");
  });

  it("keeps neighborhood in area, never in street", () => {
    const place: any = {
      place_id: "p3",
      formatted_address: "Whitefield Main Road, Whitefield, Bengaluru, Karnataka 560048, India",
      address_components: [
        comp("route", "Whitefield Main Road"),
        comp("neighborhood", "Whitefield"),
        comp("locality", "Bengaluru"),
        comp("administrative_area_level_1", "Karnataka"),
        comp("postal_code", "560048"),
      ],
      geometry: { location },
    };

    const r = extractPlace(place)!;
    expect(r.streetAddress).toBe("Whitefield Main Road");
    expect(r.area).toBe("Whitefield");
  });
});
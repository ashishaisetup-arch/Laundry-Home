import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { AddAddressDialog } from "../add-address-dialog";
import type { PlaceResult } from "../address-autocomplete";

const { googleAvailableMock, providerErrorCallback, autocompleteOnChange } = vi.hoisted(() => ({
  googleAvailableMock: { value: false },
  providerErrorCallback: { fn: (null as unknown) as ((error: unknown) => void) | null },
  autocompleteOnChange: { fn: (null as unknown) as ((place: PlaceResult) => void) | null },
}));

vi.mock("@/lib/hooks/useGoogleMaps", () => ({
  useGoogleMapsAvailable: () => googleAvailableMock.value,
}));

vi.mock("@vis.gl/react-google-maps", () => ({
  APIProvider: ({ children, onError }: any) => {
    providerErrorCallback.fn = onError;
    return <div>{children}</div>;
  },
}));

vi.mock("@/components/shared/address-autocomplete", () => ({
  AddressAutocomplete: ({ onChange }: any) => {
    autocompleteOnChange.fn = onChange;
    return <input aria-label="search-address" />;
  },
}));

const { postMock, toastMock } = vi.hoisted(() => ({
  postMock: vi.fn().mockResolvedValue({ id: "a1" }),
  toastMock: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("@/lib/api/client", () => ({
  api: { post: (...args: any[]) => postMock(...args) },
}));

vi.mock("sonner", () => ({
  toast: toastMock,
}));

const placeA: PlaceResult = {
  placeId: "p1",
  description: "Whitefield Main Road, Horamavu Agara, Horamavu, Bengaluru, Karnataka 560113, India",
  latitude: 12.97,
  longitude: 77.59,
  city: "Bengaluru",
  state: "Karnataka",
  pincode: "560113",
  area: "Horamavu Agara, Horamavu",
  building: "Prestige Shantiniketan",
  streetAddress: "Whitefield Main Road",
  formattedAddress: "Whitefield Main Road, Horamavu Agara, Horamavu, Bengaluru, Karnataka 560113, India",
};

const placeB: PlaceResult = {
  ...placeA,
  placeId: "p2",
  pincode: "560038",
  building: "Prestige Lakeside",
  streetAddress: "Second Main Road",
};

describe("AddAddressDialog", () => {
  beforeEach(() => {
    googleAvailableMock.value = false;
    providerErrorCallback.fn = null;
    autocompleteOnChange.fn = null;
    postMock.mockClear();
    toastMock.success.mockClear();
  });

  it("renders the editable fields and disables save until the form is valid", () => {
    render(<AddAddressDialog open onOpenChange={vi.fn()} />);
    expect(screen.getAllByText("Add New Address").length).toBeGreaterThan(0);
    expect(screen.getByPlaceholderText("Prestige Shantiniketan")).toBeTruthy();
    expect(screen.getByPlaceholderText("Street / Road name")).toBeTruthy();
    expect(screen.getByPlaceholderText("Horamavu")).toBeTruthy();
    expect(screen.getByPlaceholderText("560113")).toBeTruthy();
    expect((screen.getByRole("button", { name: "Save Address" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("saves the structured fields and notifies onSaved", async () => {
    const onOpenChange = vi.fn();
    const onSaved = vi.fn();
    render(<AddAddressDialog open onOpenChange={onOpenChange} onSaved={onSaved} />);

    fireEvent.change(screen.getByPlaceholderText("Home, Work, etc."), { target: { value: "Home" } });
    fireEvent.change(screen.getByPlaceholderText("Prestige Shantiniketan"), { target: { value: "Prestige Shantiniketan" } });
    fireEvent.change(screen.getByPlaceholderText("Flat No 202"), { target: { value: "204" } });
    fireEvent.change(screen.getByPlaceholderText("Street / Road name"), { target: { value: "Whitefield Main Road" } });
    fireEvent.change(screen.getByPlaceholderText("Horamavu"), { target: { value: "Mahadevapura" } });
    fireEvent.change(screen.getByPlaceholderText("Bengaluru"), { target: { value: "Bengaluru" } });
    fireEvent.change(screen.getByPlaceholderText("560113"), { target: { value: "560048" } });

    const save = screen.getByRole("button", { name: "Save Address" }) as HTMLButtonElement;
    expect(save.disabled).toBe(false);
    fireEvent.click(save);

    await waitFor(() => expect(postMock).toHaveBeenCalledTimes(1));
    const payload = postMock.mock.calls[0][1];
    expect(payload.label).toBe("Home");
    expect(payload.building_name).toBe("Prestige Shantiniketan");
    expect(payload.flat_no).toBe("204");
    expect(payload.line).toBe("Whitefield Main Road");
    expect(payload.area).toBe("Mahadevapura");
    expect(payload.city).toBe("Bengaluru");
    expect(payload.pincode).toBe("560048");
    expect(payload.full_address).toBe("204, Prestige Shantiniketan, Whitefield Main Road, Mahadevapura, Bengaluru - 560048");
    expect(onSaved).toHaveBeenCalledWith({ id: "a1" });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("does not submit with an invalid pincode", () => {
    render(<AddAddressDialog open onOpenChange={vi.fn()} />);
    fireEvent.change(screen.getByPlaceholderText("Home, Work, etc."), { target: { value: "Home" } });
    fireEvent.change(screen.getByPlaceholderText("Street / Road name"), { target: { value: "Street" } });
    fireEvent.change(screen.getByPlaceholderText("Horamavu"), { target: { value: "Horamavu" } });
    fireEvent.change(screen.getByPlaceholderText("Bengaluru"), { target: { value: "Bengaluru" } });
    fireEvent.change(screen.getByPlaceholderText("560113"), { target: { value: "560" } });
    expect((screen.getByRole("button", { name: "Save Address" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("cancelling closes the dialog", () => {
    const onOpenChange = vi.fn();
    render(<AddAddressDialog open onOpenChange={onOpenChange} />);
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("falls back to manual fields (no search) when Google Maps fails to load", () => {
    googleAvailableMock.value = true;
    render(<AddAddressDialog open onOpenChange={vi.fn()} />);

    expect(providerErrorCallback.fn).toBeTruthy();
    expect(screen.getByLabelText("search-address")).toBeTruthy();

    act(() => providerErrorCallback.fn!(new Error("Invalid API key")));

    expect(screen.queryByLabelText("search-address")).toBeNull();
    expect(screen.getByPlaceholderText("Street / Road name")).toBeTruthy();
  });

  it("autofills structured fields from Google without overwriting user edits", () => {
    googleAvailableMock.value = true;
    render(<AddAddressDialog open onOpenChange={vi.fn()} />);

    act(() => autocompleteOnChange.fn!(placeA));

    expect((screen.getByPlaceholderText("Prestige Shantiniketan") as HTMLInputElement).value).toBe("Prestige Shantiniketan");
    expect((screen.getByPlaceholderText("Street / Road name") as HTMLInputElement).value).toBe("Whitefield Main Road");
    expect((screen.getByPlaceholderText("Horamavu") as HTMLInputElement).value).toBe("Horamavu");
    expect((screen.getByPlaceholderText("Bengaluru") as HTMLInputElement).value).toBe("Bengaluru");
    expect((screen.getByPlaceholderText("Karnataka") as HTMLInputElement).value).toBe("Karnataka");
    expect((screen.getByPlaceholderText("560113") as HTMLInputElement).value).toBe("560113");

    const building = screen.getByPlaceholderText("Prestige Shantiniketan") as HTMLInputElement;
    fireEvent.change(building, { target: { value: "Prestige" } });

    act(() => autocompleteOnChange.fn!(placeB));

    expect((screen.getByPlaceholderText("Prestige Shantiniketan") as HTMLInputElement).value).toBe("Prestige");
    expect((screen.getByPlaceholderText("Street / Road name") as HTMLInputElement).value).toBe("Second Main Road");
    expect((screen.getByPlaceholderText("560113") as HTMLInputElement).value).toBe("560038");
  });
});
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { AddAddressDialog } from "../add-address-dialog";

vi.mock("@/lib/hooks/useGoogleMaps", () => ({
  useGoogleMapsAvailable: () => false,
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

describe("AddAddressDialog", () => {
  beforeEach(() => {
    postMock.mockClear();
    toastMock.success.mockClear();
  });

  it("renders the manual fields and disables save until the form is valid", () => {
    render(<AddAddressDialog open onOpenChange={vi.fn()} />);
    expect(screen.getAllByText("Add New Address").length).toBeGreaterThan(0);
    expect(screen.getByPlaceholderText("Flat / House no, Street")).toBeTruthy();
    expect((screen.getByRole("button", { name: "Save Address" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("saves the address in the full-address format and notifies onSaved", async () => {
    const onOpenChange = vi.fn();
    const onSaved = vi.fn();
    render(<AddAddressDialog open onOpenChange={onOpenChange} onSaved={onSaved} />);

    fireEvent.change(screen.getByPlaceholderText("Home, Work, etc."), { target: { value: "Home" } });
    fireEvent.change(screen.getByPlaceholderText("Flat / House no, Street"), { target: { value: "Flat 2B, Building name" } });
    fireEvent.change(screen.getByPlaceholderText("Horamavu"), { target: { value: "Horamavu" } });
    fireEvent.change(screen.getByPlaceholderText("Bengaluru"), { target: { value: "Bengaluru" } });
    fireEvent.change(screen.getByPlaceholderText("560113"), { target: { value: "560113" } });

    const save = screen.getByRole("button", { name: "Save Address" }) as HTMLButtonElement;
    expect(save.disabled).toBe(false);
    fireEvent.click(save);

    await waitFor(() => expect(postMock).toHaveBeenCalledTimes(1));
    const payload = postMock.mock.calls[0][1];
    expect(payload.full_address).toBe("Flat 2B, Building name, Horamavu, Bengaluru - 560113");
    expect(payload.label).toBe("Home");
    expect(onSaved).toHaveBeenCalledWith({ id: "a1" });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("does not submit with an invalid pincode", () => {
    render(<AddAddressDialog open onOpenChange={vi.fn()} />);
    fireEvent.change(screen.getByPlaceholderText("Home, Work, etc."), { target: { value: "Home" } });
    fireEvent.change(screen.getByPlaceholderText("Flat / House no, Street"), { target: { value: "Street" } });
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
});

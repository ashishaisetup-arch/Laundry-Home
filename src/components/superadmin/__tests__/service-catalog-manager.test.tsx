import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { ServiceCatalogManager } from "../service-catalog-manager";

const CATALOG = [
  {
    id: "cat-1",
    name: "Wash",
    slug: "wash",
    description: "Everyday laundry washing services",
    icon: "Layers",
    grouping: "main",
    displayOrder: 1,
    isActive: true,
    services: [
      {
        id: "svc-1",
        categoryId: "cat-1",
        name: "Wash & Fold",
        description: "Machine wash with gentle folding",
        unit: "item",
        slug: "wash_fold",
        pricingType: "ITEM",
        bagPrice: null,
        imageUrl: "",
        taxable: true,
        displayOrder: 1,
        isActive: true,
        items: [
          {
            id: "item-1",
            serviceId: "svc-1",
            itemName: "Shirt",
            itemCategory: "Men",
            unit: "item",
            defaultPrice: 25,
            estimatedTime: 30,
            estimatedWeightKg: 0.2,
            itemMasterId: "im-1",
            isActive: true,
          },
        ],
      },
    ],
  },
];

const { apiMock, refetchMock } = vi.hoisted(() => ({
  apiMock: {
    put: vi.fn().mockResolvedValue({}),
    post: vi.fn().mockResolvedValue({}),
    delete: vi.fn().mockResolvedValue({}),
  },
  refetchMock: vi.fn(),
}));

vi.mock("@/lib/api/client", () => ({
  api: apiMock,
}));

vi.mock("@/lib/hooks", () => ({
  useServiceCatalog: () => ({ data: CATALOG, refetch: refetchMock }),
}));

vi.mock("framer-motion", () => ({
  motion: { div: ({ children }: any) => <div>{children}</div> },
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

function expandCategoryAndService() {
  fireEvent.click(screen.getByText("Wash"));
  fireEvent.click(screen.getByText("Wash & Fold"));
}

describe("ServiceCatalogManager edit dialogs", () => {
  beforeEach(() => {
    apiMock.put.mockClear();
    apiMock.post.mockClear();
    apiMock.delete.mockClear();
    refetchMock.mockClear();
  });

  it("pre-fills the Edit Item dialog with the item's details", () => {
    render(<ServiceCatalogManager />);
    expandCategoryAndService();

    const itemRow = screen.getByText("Shirt").closest("div.rounded-lg") as HTMLElement;
    fireEvent.click(within(itemRow).getAllByRole("button")[0]); // pencil

    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByPlaceholderText("e.g. Cotton Shirt")).toHaveValue("Shirt");
    expect(within(dialog).getByPlaceholderText("0")).toHaveValue(25);
    expect(within(dialog).getByPlaceholderText("e.g. 0.20")).toHaveValue(0.2);
    expect(within(dialog).getAllByRole("combobox")[0]).toHaveValue("Men");
    expect(within(dialog).getAllByRole("combobox")[1]).toHaveValue("item");
    expect(within(dialog).getAllByRole("switch")[0]).toHaveAttribute("aria-checked", "true");
  });

  it("pre-fills the Edit Service dialog with the service's details", () => {
    render(<ServiceCatalogManager />);
    expandCategoryAndService();

    const serviceCard = screen.getByText("Wash & Fold").closest("div.rounded-lg.border") as HTMLElement;
    fireEvent.click(within(serviceCard).getAllByRole("button")[1]); // pencil

    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByPlaceholderText("e.g. Wash & Fold")).toHaveValue("Wash & Fold");
    expect(within(dialog).getByDisplayValue("Machine wash with gentle folding")).toBeInTheDocument();
    expect(within(dialog).getAllByRole("combobox")[0]).toHaveValue("cat-1");
    expect(within(dialog).getAllByRole("switch")[0]).toHaveAttribute("aria-checked", "true");
  });

  it("pre-fills the Edit Category dialog with the category's details", () => {
    render(<ServiceCatalogManager />);

    const catHeader = screen.getByText("Wash").closest("div.flex") as HTMLElement;
    const headerButtons = within(catHeader).getAllByRole("button");
    fireEvent.click(headerButtons[headerButtons.length - 2]); // pencil (after chevron + switch)

    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByPlaceholderText("e.g. Wash & Laundry")).toHaveValue("Wash");
    expect(within(dialog).getByRole("switch")).toHaveAttribute("aria-checked", "true");
  });

  it("opens blank forms for add (not edit) targets", () => {
    render(<ServiceCatalogManager />);
    fireEvent.click(screen.getByText("Add Category"));

    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByPlaceholderText("e.g. Wash & Laundry")).toHaveValue("");
  });
});
// Spec: odd/tasks/project-metrics-tab.md — S4: sale price in the project's main area, red while empty.
import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ProjectSalePrice } from "@/components/projects/ProjectSalePrice";

const mockPatch = jest.fn();
const mockToastSuccess = jest.fn();
const mockToastError = jest.fn();

jest.mock("lucide-react", () => new Proxy({}, { get: () => () => null }));
jest.mock("@/lib/services/apiService", () => ({
  patch: (...a: unknown[]) => mockPatch(...a),
}));
jest.mock("sonner", () => ({
  toast: {
    success: (...a: unknown[]) => mockToastSuccess(...a),
    error: (...a: unknown[]) => mockToastError(...a),
  },
}));

const norm = (s: string | null) => (s ?? "").replace(/\s/g, " ");

function renderPrice(salePrice: number | null | undefined, canEdit = true) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  client.setQueryData(["project", 10], { id: 10, sale_price: salePrice });
  const invalidate = jest.spyOn(client, "invalidateQueries");
  const view = render(
    <QueryClientProvider client={client}>
      <ProjectSalePrice projectId={10} salePrice={salePrice} canEdit={canEdit} />
    </QueryClientProvider>
  );
  return { client, invalidate, ...view };
}

beforeEach(() => jest.clearAllMocks());

describe("ProjectSalePrice", () => {
  it("renders nothing when the role cannot see the sale price", () => {
    const { container } = renderPrice(undefined);
    expect(container).toBeEmptyDOMElement();
  });

  it("shows the empty price in red and asks the commercial to fill it", () => {
    renderPrice(null);
    const box = screen.getByTestId("project-sale-price");
    expect(box).toHaveAttribute("data-missing", "true");
    expect(box).toHaveClass("border-destructive");
    expect(screen.getByText("Precio de venta sin registrar")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Registrar precio de venta" })).toBeInTheDocument();
  });

  it("shows the registered price without the red warning", () => {
    renderPrice(2500000);
    const box = screen.getByTestId("project-sale-price");
    expect(box).toHaveAttribute("data-missing", "false");
    expect(box).not.toHaveClass("border-destructive");
    expect(norm(screen.getByTestId("sale-price-value").textContent)).toBe("$ 2.500.000");
  });

  it("saves the price, updates the project and refreshes the metrics", async () => {
    mockPatch.mockResolvedValue({ ok: true, data: { sale_price: 2500000 } });
    const { client, invalidate } = renderPrice(null);
    await userEvent.click(screen.getByRole("button", { name: "Registrar precio de venta" }));
    await userEvent.type(screen.getByLabelText("Precio de venta del proyecto"), "2.500.000");
    await userEvent.click(screen.getByRole("button", { name: "Guardar" }));
    await waitFor(() => expect(mockPatch).toHaveBeenCalledWith("projects/10/financials", { sale_price: 2500000 }));
    expect(mockToastSuccess).toHaveBeenCalledWith("Precio de venta actualizado");
    expect(client.getQueryData(["project", 10])).toEqual({ id: 10, sale_price: 2500000 });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["project-financials", 10] });
  });

  it("rejects text that is not a price without calling the API", async () => {
    renderPrice(null);
    await userEvent.click(screen.getByRole("button", { name: "Registrar precio de venta" }));
    await userEvent.type(screen.getByLabelText("Precio de venta del proyecto"), "abc");
    await userEvent.click(screen.getByRole("button", { name: "Guardar" }));
    expect(mockToastError).toHaveBeenCalledWith("Ingresa un precio válido en pesos (solo números)");
    expect(mockPatch).not.toHaveBeenCalled();
  });

  it("shows the API error and keeps the stored value", async () => {
    mockPatch.mockResolvedValue({ ok: false, error: "No tienes acceso a este proyecto" });
    const { client } = renderPrice(null);
    await userEvent.click(screen.getByRole("button", { name: "Registrar precio de venta" }));
    await userEvent.type(screen.getByLabelText("Precio de venta del proyecto"), "100");
    await userEvent.click(screen.getByRole("button", { name: "Guardar" }));
    await waitFor(() => expect(mockToastError).toHaveBeenCalledWith("No tienes acceso a este proyecto"));
    expect(client.getQueryData(["project", 10])).toEqual({ id: 10, sale_price: null });
  });

  it("is read-only for roles that only view it (financiero)", () => {
    renderPrice(null, false);
    expect(screen.getByText("Precio de venta sin registrar")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Registrar precio de venta" })).not.toBeInTheDocument();
  });
});

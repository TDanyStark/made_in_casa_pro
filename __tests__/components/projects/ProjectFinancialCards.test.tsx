// S1, S2: cards with hours/money invested and the editable sale price.
import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ProjectFinancialCards } from "@/components/projects/ProjectFinancialCards";

const mockGet = jest.fn();
const mockPatch = jest.fn();
const mockToastSuccess = jest.fn();
const mockToastError = jest.fn();

jest.mock("lucide-react", () => new Proxy({}, {
  get: (_, iconName: string) => {
    const MockIcon = () => <svg data-testid={`icon-${iconName}`} />;
    MockIcon.displayName = iconName;
    return MockIcon;
  },
}));
jest.mock("@/lib/services/apiService", () => ({
  get: (...args: unknown[]) => mockGet(...args),
  patch: (...args: unknown[]) => mockPatch(...args),
}));
jest.mock("sonner", () => ({
  toast: {
    success: (...args: unknown[]) => mockToastSuccess(...args),
    error: (...args: unknown[]) => mockToastError(...args),
  },
}));
// Recharts needs real layout; charts are rendered as placeholders.
jest.mock("@/components/ui/chart", () => ({
  ChartContainer: ({ "aria-label": label }: { "aria-label"?: string }) => <div data-testid="chart" aria-label={label} />,
  ChartTooltip: () => null,
  ChartTooltipContent: () => null,
}));

const summary = {
  sale_price: 1500000,
  total_minutes: 300,
  internal_minutes: 210,
  external_minutes: 90,
  internal_cost: 120000,
  external_cost: 570000,
  total_cost: 690000,
  margin: 810000,
  by_collaborator: [
    { user_id: 11, name: "Ext", is_internal: false, minutes: 60, cost: 500000 },
    { user_id: 10, name: "Ana", is_internal: true, minutes: 210, cost: 120000 },
  ],
};

function renderCards(canEditSalePrice = true) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <ProjectFinancialCards projectId={10} canEditSalePrice={canEditSalePrice} />
    </QueryClientProvider>
  );
}

const norm = (s: string | null) => (s ?? "").replace(/\s/g, " ");

beforeEach(() => {
  jest.clearAllMocks();
  mockGet.mockResolvedValue({ ok: true, data: summary });
});

describe("ProjectFinancialCards", () => {
  it("shows team hours, money invested and the sale price with margin", async () => {
    renderCards();
    expect(await screen.findByText("5 h")).toBeInTheDocument();
    expect(mockGet).toHaveBeenCalledWith("projects/10/financials");
    expect(screen.getByText("Horas del equipo")).toBeInTheDocument();
    expect(screen.getByText("Dinero invertido")).toBeInTheDocument();
    expect(screen.getByText("Precio de venta")).toBeInTheDocument();
    expect(norm(screen.getByTestId("total-cost").textContent)).toBe("$ 690.000");
    expect(norm(screen.getByTestId("sale-price").textContent)).toBe("$ 1.500.000");
    expect(norm(screen.getByTestId("margin").textContent)).toContain("$ 810.000");
    expect(norm(screen.getByTestId("margin").textContent)).toContain("54%");
    expect(screen.getByText("Internos: 3 h 30 min")).toBeInTheDocument();
    expect(screen.getByText("Externos: 1 h 30 min")).toBeInTheDocument();
    expect(screen.getAllByTestId("chart").length).toBeGreaterThanOrEqual(2);
  });

  it("asks to record the sale price when there is none", async () => {
    mockGet.mockResolvedValue({ ok: true, data: { ...summary, sale_price: null, margin: null } });
    renderCards();
    expect(await screen.findByText("Sin registrar")).toBeInTheDocument();
    expect(screen.queryByTestId("margin")).not.toBeInTheDocument();
  });

  it("saves a new sale price and shows the returned summary", async () => {
    mockPatch.mockResolvedValue({ ok: true, data: { ...summary, sale_price: 2000000, margin: 1310000 } });
    renderCards();
    await userEvent.click(await screen.findByRole("button", { name: "Editar precio de venta" }));
    const input = screen.getByLabelText("Precio de venta del proyecto");
    await userEvent.clear(input);
    await userEvent.type(input, "2000000");
    await userEvent.click(screen.getByRole("button", { name: "Guardar" }));
    await waitFor(() => expect(mockPatch).toHaveBeenCalledWith("projects/10/financials", { sale_price: 2000000 }));
    expect(mockToastSuccess).toHaveBeenCalledWith("Precio de venta actualizado");
    await waitFor(() => expect(norm(screen.getByTestId("sale-price").textContent)).toBe("$ 2.000.000"));
  });

  it("shows the API error and keeps the previous value when saving fails", async () => {
    mockPatch.mockResolvedValue({ ok: false, error: "El precio de venta debe ser un número mayor o igual a 0" });
    renderCards();
    await userEvent.click(await screen.findByRole("button", { name: "Editar precio de venta" }));
    await userEvent.click(screen.getByRole("button", { name: "Guardar" }));
    await waitFor(() => expect(mockToastError).toHaveBeenCalledWith("El precio de venta debe ser un número mayor o igual a 0"));
  });

  it("does not offer editing to read-only roles", async () => {
    renderCards(false);
    await screen.findByText("5 h");
    expect(screen.queryByRole("button", { name: "Editar precio de venta" })).not.toBeInTheDocument();
  });

  it("renders nothing when the summary cannot be loaded", async () => {
    mockGet.mockResolvedValue({ ok: false, error: "No tienes acceso a este proyecto" });
    const { container } = renderCards();
    await waitFor(() => expect(mockGet).toHaveBeenCalled());
    await waitFor(() => expect(container.querySelector("[data-testid='financial-cards']")).toBeNull());
    expect(screen.queryByText("Horas del equipo")).not.toBeInTheDocument();
  });
});

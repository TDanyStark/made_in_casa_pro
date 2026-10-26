// S1, S2, S9, S10: slim financial panel with version filter and the editable sale price.
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
// Radix Select needs pointer APIs jsdom lacks; a native select keeps the same contract.
jest.mock("@/components/ui/select", () => ({
  Select: ({ value, onValueChange, children }: { value: string; onValueChange: (v: string) => void; children: React.ReactNode }) => (
    <select aria-label="Filtrar por versión" value={value} onChange={(e) => onValueChange(e.target.value)}>
      {children}
    </select>
  ),
  SelectTrigger: () => null,
  SelectValue: () => null,
  SelectContent: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SelectItem: ({ value, children }: { value: string; children: React.ReactNode }) => <option value={value}>{children}</option>,
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
  versions: [
    { id: 4, version_number: 1 },
    { id: 7, version_number: 2 },
  ],
  adjustment_id: null,
};
const versionTwo = {
  ...summary,
  total_minutes: 60,
  internal_minutes: 60,
  external_minutes: 0,
  internal_cost: 30000,
  external_cost: 0,
  total_cost: 30000,
  margin: null,
  adjustment_id: 7,
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
  mockGet.mockImplementation(async (url: string) => ({
    ok: true,
    data: url.includes("adjustment_id=7") ? versionTwo : summary,
  }));
});

describe("ProjectFinancialCards", () => {
  it("shows hours, money invested, sale price and margin in one slim panel", async () => {
    renderCards();
    expect(await screen.findByText("5 h")).toBeInTheDocument();
    expect(mockGet).toHaveBeenCalledWith("projects/10/financials");
    const panel = screen.getByTestId("financial-cards");
    expect(panel.querySelector(".text-3xl")).toBeNull();
    expect(screen.getByText("Horas")).toBeInTheDocument();
    expect(screen.getByText("Invertido")).toBeInTheDocument();
    expect(screen.getByText("Venta")).toBeInTheDocument();
    expect(screen.getByText("Margen")).toBeInTheDocument();
    expect(norm(screen.getByTestId("total-cost").textContent)).toBe("$ 690.000");
    expect(norm(screen.getByTestId("sale-price").textContent)).toBe("$ 1.500.000");
    expect(norm(screen.getByTestId("margin").textContent)).toContain("$ 810.000");
    expect(norm(screen.getByTestId("margin").textContent)).toContain("54%");
    expect(screen.getByText("Int. 3 h 30 min · Ext. 1 h 30 min")).toBeInTheDocument();
    expect(norm(screen.getByText(/^Int\. \$/).textContent)).toBe("Int. $ 120.000 · Ext. $ 570.000");
    expect(screen.getAllByTestId("chart").length).toBeGreaterThanOrEqual(2);
  });

  it("offers every project version and defaults to all of them", async () => {
    renderCards();
    const select = await screen.findByLabelText("Filtrar por versión");
    expect(select).toHaveValue("all");
    expect(screen.getByRole("option", { name: "Todas las versiones" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Versión 1" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Versión 2" })).toBeInTheDocument();
  });

  it("refetches with ?adjustment_id when a version is chosen and hides the margin", async () => {
    renderCards();
    await screen.findByText("5 h");
    await userEvent.selectOptions(screen.getByLabelText("Filtrar por versión"), "7");
    await waitFor(() => expect(mockGet).toHaveBeenCalledWith("projects/10/financials?adjustment_id=7"));
    expect(await screen.findByText("1 h")).toBeInTheDocument();
    expect(norm(screen.getByTestId("total-cost").textContent)).toBe("$ 30.000");
    expect(screen.queryByTestId("margin")).not.toBeInTheDocument();
    expect(norm(screen.getByTestId("sale-price").textContent)).toBe("$ 1.500.000");
    expect(screen.getByText("Precio de todo el proyecto")).toBeInTheDocument();

    await userEvent.selectOptions(screen.getByLabelText("Filtrar por versión"), "all");
    expect(await screen.findByText("5 h")).toBeInTheDocument();
    expect(screen.getByTestId("margin")).toBeInTheDocument();
  });

  it("shows the cost of each collaborator in the detail popover", async () => {
    renderCards();
    await userEvent.click(await screen.findByRole("button", { name: "Detalle por colaborador" }));
    expect(await screen.findByText("Ext")).toBeInTheDocument();
    expect(screen.getByText("Ana")).toBeInTheDocument();
  });

  it("asks to record the sale price when there is none", async () => {
    mockGet.mockResolvedValue({ ok: true, data: { ...summary, sale_price: null, margin: null } });
    renderCards();
    expect(await screen.findByText("Sin registrar")).toBeInTheDocument();
    expect(screen.queryByTestId("margin")).not.toBeInTheDocument();
  });

  it("saves a new sale price, refreshes the financials and shows the new value", async () => {
    const updated = { ...summary, sale_price: 2000000, margin: 1310000 };
    mockPatch.mockImplementation(async () => {
      mockGet.mockResolvedValue({ ok: true, data: updated });
      return { ok: true, data: updated };
    });
    renderCards();
    await userEvent.click(await screen.findByRole("button", { name: "Editar precio de venta" }));
    const input = screen.getByLabelText("Precio de venta del proyecto");
    await userEvent.clear(input);
    await userEvent.type(input, "2000000");
    await userEvent.click(screen.getByRole("button", { name: "Guardar" }));
    await waitFor(() => expect(mockPatch).toHaveBeenCalledWith("projects/10/financials", { sale_price: 2000000 }));
    expect(mockToastSuccess).toHaveBeenCalledWith("Precio de venta actualizado");
    await waitFor(() => expect(norm(screen.getByTestId("sale-price").textContent)).toBe("$ 2.000.000"));
    await waitFor(() => expect(mockGet).toHaveBeenCalledTimes(2));
  });

  it("shows the API error and keeps the previous value when saving fails", async () => {
    mockPatch.mockResolvedValue({ ok: false, error: "El precio de venta debe ser un número mayor o igual a 0" });
    renderCards();
    await userEvent.click(await screen.findByRole("button", { name: "Editar precio de venta" }));
    await userEvent.click(screen.getByRole("button", { name: "Guardar" }));
    await waitFor(() => expect(mockToastError).toHaveBeenCalledWith("El precio de venta debe ser un número mayor o igual a 0"));
    await userEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(norm(screen.getByTestId("sale-price").textContent)).toBe("$ 1.500.000");
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
    expect(screen.queryByText("Horas")).not.toBeInTheDocument();
  });
});

// S27: COP amounts are integers; dots/commas are thousands separators, never decimals.
describe("ProjectFinancialCards — sale price parsing (S27)", () => {
  async function typeAndSave(value: string) {
    mockPatch.mockResolvedValue({ ok: true, data: summary });
    renderCards();
    await userEvent.click(await screen.findByRole("button", { name: "Editar precio de venta" }));
    const input = screen.getByLabelText("Precio de venta del proyecto");
    await userEvent.clear(input);
    if (value) await userEvent.type(input, value);
    await userEvent.click(screen.getByRole("button", { name: "Guardar" }));
  }

  it.each([
    ["1.500.000", 1500000],
    ["1.500", 1500],
    ["$ 2.000.000", 2000000],
    ["2,500,000", 2500000],
    ["750000", 750000],
  ])("sends %s as %i", async (typed, expected) => {
    await typeAndSave(typed);
    await waitFor(() => expect(mockPatch).toHaveBeenCalledWith("projects/10/financials", { sale_price: expected }));
  });

  it("sends null when the field is cleared", async () => {
    await typeAndSave("");
    await waitFor(() => expect(mockPatch).toHaveBeenCalledWith("projects/10/financials", { sale_price: null }));
  });

  it.each(["abc", "12abc", "."])("rejects %s with an error toast and no request", async (typed) => {
    await typeAndSave(typed);
    await waitFor(() =>
      expect(mockToastError).toHaveBeenCalledWith("Ingresa un precio válido en pesos (solo números)")
    );
    expect(mockPatch).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Precio de venta del proyecto")).toBeInTheDocument();
  });

  it("pre-fills the editor with the current integer price", async () => {
    renderCards();
    await userEvent.click(await screen.findByRole("button", { name: "Editar precio de venta" }));
    expect(screen.getByLabelText("Precio de venta del proyecto")).toHaveValue("1500000");
  });
});


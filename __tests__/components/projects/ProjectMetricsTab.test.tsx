// Spec: odd/tasks/project-metrics-tab.md — S2: detailed metrics (hours by type, cost vs sale, per collaborator).
import React from "react";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ProjectMetricsTab } from "@/components/projects/ProjectMetricsTab";

const mockGet = jest.fn();

jest.mock("lucide-react", () => new Proxy({}, {
  get: (_, iconName: string) => {
    const MockIcon = () => <svg data-testid={`icon-${iconName}`} />;
    MockIcon.displayName = iconName;
    return MockIcon;
  },
}));
jest.mock("@/lib/services/apiService", () => ({
  get: (...args: unknown[]) => mockGet(...args),
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
    { user_id: 10, name: "Ana", is_internal: true, minutes: 210, cost: 120000 },
    { user_id: 11, name: "Ext", is_internal: false, minutes: 90, cost: 570000 },
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
  by_collaborator: [{ user_id: 10, name: "Ana", is_internal: true, minutes: 60, cost: 30000 }],
  adjustment_id: 7,
};

function renderTab() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <ProjectMetricsTab projectId={10} />
    </QueryClientProvider>
  );
}

const norm = (s: string | null) => (s ?? "").replace(/\s/g, " ");
const cells = (row: HTMLElement) => within(row).getAllByRole("cell").map((c) => norm(c.textContent));

beforeEach(() => {
  jest.clearAllMocks();
  mockGet.mockImplementation(async (url: string) => ({
    ok: true,
    data: url.includes("adjustment_id=7") ? versionTwo : summary,
  }));
});

describe("ProjectMetricsTab", () => {
  it("lists the investment per collaborator sorted by cost, with type, hours, cost, share and a total", async () => {
    renderTab();
    expect(await screen.findByText("Inversión por colaborador")).toBeInTheDocument();
    expect(mockGet).toHaveBeenCalledWith("projects/10/financials");
    const headers = screen.getAllByRole("columnheader").map((h) => h.textContent);
    expect(headers).toEqual(["Colaborador", "Tipo", "Horas", "Costo", "% del costo"]);
    const rows = screen.getAllByRole("row").slice(1);
    expect(rows).toHaveLength(3);
    expect(cells(rows[0])).toEqual(["Ext", "Externo", "1 h 30 min", "$ 570.000", "83%"]);
    expect(cells(rows[1])).toEqual(["Ana", "Interno", "3 h 30 min", "$ 120.000", "17%"]);
    expect(cells(rows[2])).toEqual(["Total", "", "5 h", "$ 690.000", "100%"]);
  });

  it("shows hours by type with their percentage", async () => {
    renderTab();
    const card = (await screen.findByText("Horas por tipo")).closest("[data-slot='card']") as HTMLElement;
    expect(within(card).getByLabelText("Horas internas y externas")).toBeInTheDocument();
    expect(norm(within(card).getByTestId("hours-internal").textContent)).toBe("Internas3 h 30 min · 70%");
    expect(norm(within(card).getByTestId("hours-external").textContent)).toBe("Externas1 h 30 min · 30%");
  });

  it("compares the cost with the sale price and shows the margin", async () => {
    renderTab();
    const card = (await screen.findByText("Costo frente a venta")).closest("[data-slot='card']") as HTMLElement;
    expect(norm(within(card).getByTestId("metrics-total-cost").textContent)).toBe("$ 690.000");
    expect(norm(within(card).getByTestId("metrics-sale-price").textContent)).toBe("$ 1.500.000");
    expect(norm(within(card).getByTestId("metrics-margin").textContent)).toBe("$ 810.000 · 54%");
    expect(within(card).getByLabelText("Costo frente al precio de venta")).toBeInTheDocument();
  });

  it("shows the sale price in red as Sin registrar when it is missing", async () => {
    mockGet.mockResolvedValue({ ok: true, data: { ...summary, sale_price: null, margin: null } });
    renderTab();
    const sale = await screen.findByTestId("metrics-sale-price");
    expect(sale).toHaveTextContent("Sin registrar");
    expect(sale).toHaveClass("text-destructive");
  });

  it("shows an empty state when nobody has logged hours", async () => {
    mockGet.mockResolvedValue({
      ok: true,
      data: { ...summary, total_minutes: 0, internal_minutes: 0, external_minutes: 0, internal_cost: 0, external_cost: 0, total_cost: 0, margin: 1500000, by_collaborator: [] },
    });
    renderTab();
    expect(await screen.findByText("Aún no hay horas registradas en este proyecto.")).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("refetches with ?adjustment_id when a version is chosen and explains the margin", async () => {
    renderTab();
    await screen.findByText("Inversión por colaborador");
    expect(screen.getByLabelText("Filtrar por versión")).toHaveValue("all");
    await userEvent.selectOptions(screen.getByLabelText("Filtrar por versión"), "7");
    await waitFor(() => expect(mockGet).toHaveBeenCalledWith("projects/10/financials?adjustment_id=7"));
    await waitFor(() => expect(norm(screen.getByTestId("metrics-total-cost").textContent)).toBe("$ 30.000"));
    expect(screen.getByTestId("metrics-margin")).toHaveTextContent("Margen solo para todo el proyecto");
    expect(screen.getAllByRole("row").slice(1)).toHaveLength(2);
  });
});

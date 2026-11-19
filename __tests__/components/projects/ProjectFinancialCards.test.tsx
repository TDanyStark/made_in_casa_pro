// Spec: odd/tasks/project-metrics-tab.md — S3: the summary above the tabs, restyled as KPI tiles.
import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ProjectFinancialCards } from "@/components/projects/ProjectFinancialCards";

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
  associated_cost: 0,
  associated_by_category: [],
  by_collaborator: [
    { user_id: 11, name: "Ext", is_internal: false, minutes: 90, cost: 570000 },
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

function renderCards() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <ProjectFinancialCards projectId={10} />
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
  it("shows the hours, invested and margin tiles under a Resumen header", async () => {
    renderCards();
    expect(await screen.findByText("5 h")).toBeInTheDocument();
    expect(mockGet).toHaveBeenCalledWith("projects/10/financials");
    expect(screen.getByText("Resumen")).toBeInTheDocument();
    expect(screen.getByText("Horas")).toBeInTheDocument();
    expect(screen.getByText("Invertido")).toBeInTheDocument();
    expect(screen.getByText("Margen")).toBeInTheDocument();
    expect(screen.getByText("Int. 3 h 30 min · Ext. 1 h 30 min")).toBeInTheDocument();
    expect(norm(screen.getByTestId("total-cost").textContent)).toBe("$ 690.000");
    expect(norm(screen.getByText(/^Int\. \$/).textContent)).toBe("Int. $ 120.000 · Ext. $ 570.000");
    const margin = screen.getByTestId("margin");
    expect(norm(margin.textContent)).toContain("$ 810.000");
    expect(norm(margin.textContent)).toContain("54%");
    expect(margin.querySelector(".text-emerald-600")).not.toBeNull();
    expect(screen.getByLabelText("Horas internas y externas")).toBeInTheDocument();
    expect(screen.getByLabelText("Costo frente al precio de venta")).toBeInTheDocument();
  });

  it("offers every project version and defaults to all of them", async () => {
    renderCards();
    const select = await screen.findByLabelText("Filtrar por versión");
    expect(select).toHaveValue("all");
    expect(screen.getByRole("option", { name: "Todas las versiones" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Versión 1" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Versión 2" })).toBeInTheDocument();
  });

  it("refetches with ?adjustment_id when a version is chosen and explains the margin", async () => {
    renderCards();
    await screen.findByText("5 h");
    await userEvent.selectOptions(screen.getByLabelText("Filtrar por versión"), "7");
    await waitFor(() => expect(mockGet).toHaveBeenCalledWith("projects/10/financials?adjustment_id=7"));
    expect(await screen.findByText("1 h")).toBeInTheDocument();
    expect(norm(screen.getByTestId("total-cost").textContent)).toBe("$ 30.000");
    expect(screen.getByTestId("margin")).toHaveTextContent("Margen solo para todo el proyecto");
    expect(norm(screen.getByTestId("margin").textContent)).not.toContain("$");

    await userEvent.selectOptions(screen.getByLabelText("Filtrar por versión"), "all");
    expect(await screen.findByText("5 h")).toBeInTheDocument();
    expect(norm(screen.getByTestId("margin").textContent)).toContain("$ 810.000");
  });

  // project-costs S4: associated costs as their own line of the money tile.
  it("shows the associated costs as their own line inside the invested total", async () => {
    mockGet.mockImplementation(async (url: string) => ({
      ok: true,
      data: url.includes("adjustment_id=7")
        ? { ...versionTwo, associated_cost: 50000, total_cost: 80000, associated_by_category: [{ category_id: 2, name: "Pago comercial", cost: 50000 }] }
        : {
            ...summary,
            associated_cost: 200000,
            total_cost: 890000,
            margin: 610000,
            associated_by_category: [{ category_id: 1, name: "Herramientas", cost: 200000 }],
          },
    }));
    renderCards();
    await screen.findByText("5 h");
    expect(norm(screen.getByTestId("total-cost").textContent)).toBe("$ 890.000");
    expect(norm(screen.getByText(/^Int\. \$/).textContent)).toBe("Int. $ 120.000 · Ext. $ 570.000");
    expect(norm(screen.getByTestId("associated-cost").textContent)).toBe("Costos asociados $ 200.000");
    expect(norm(screen.getByTestId("margin").textContent)).toContain("$ 610.000");

    // project-costs S5: the version filter also filters associated costs.
    await userEvent.selectOptions(screen.getByLabelText("Filtrar por versión"), "7");
    await waitFor(() => expect(norm(screen.getByTestId("associated-cost").textContent)).toBe("Costos asociados $ 50.000"));
    expect(norm(screen.getByTestId("total-cost").textContent)).toBe("$ 80.000");
  });

  it("does not show the associated costs line when there are none", async () => {
    renderCards();
    await screen.findByText("5 h");
    expect(screen.queryByTestId("associated-cost")).not.toBeInTheDocument();
    expect(screen.queryByText(/Costos asociados/)).not.toBeInTheDocument();
  });

  it("shows the margin tile in red when there is no sale price", async () => {
    mockGet.mockResolvedValue({ ok: true, data: { ...summary, sale_price: null, margin: null } });
    renderCards();
    const missing = await screen.findByText("Sin precio de venta");
    expect(missing).toHaveClass("text-destructive");
    expect(screen.getByTestId("margin")).toHaveClass("border-destructive");
    expect(norm(screen.getByTestId("margin").textContent)).not.toContain("%");
  });

  it("shows a negative margin in red", async () => {
    mockGet.mockResolvedValue({ ok: true, data: { ...summary, sale_price: 500000, margin: -190000 } });
    renderCards();
    await screen.findByText("5 h");
    const margin = screen.getByTestId("margin");
    expect(norm(margin.textContent)).toContain("-38%");
    expect(margin.querySelector(".text-destructive")).not.toBeNull();
  });

  it("does not offer sale price editing nor the collaborator popover", async () => {
    renderCards();
    await screen.findByText("5 h");
    expect(screen.queryByRole("button", { name: "Editar precio de venta" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Detalle por colaborador" })).not.toBeInTheDocument();
  });

  it("renders nothing when the summary cannot be loaded", async () => {
    mockGet.mockResolvedValue({ ok: false, error: "No tienes acceso a este proyecto" });
    const { container } = renderCards();
    await waitFor(() => expect(mockGet).toHaveBeenCalled());
    await waitFor(() => expect(container.querySelector("[data-testid='financial-cards']")).toBeNull());
    expect(screen.queryByText("Horas")).not.toBeInTheDocument();
  });
});

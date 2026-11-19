// Spec: odd/tasks/project-costs.md — S1, S3, S5, S6: the Costos tab, its form and delete confirm.
import React from "react";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ProjectCostsTab } from "@/components/projects/ProjectCostsTab";

const mockGet = jest.fn();
const mockPost = jest.fn();
const mockPatch = jest.fn();
const mockDel = jest.fn();
const mockToastSuccess = jest.fn();
const mockToastError = jest.fn();

jest.mock("lucide-react", () => new Proxy({}, { get: () => () => null }));
jest.mock("@/lib/services/apiService", () => ({
  get: (...a: unknown[]) => mockGet(...a),
  post: (...a: unknown[]) => mockPost(...a),
  patch: (...a: unknown[]) => mockPatch(...a),
  del: (...a: unknown[]) => mockDel(...a),
}));
jest.mock("sonner", () => ({
  toast: {
    success: (...a: unknown[]) => mockToastSuccess(...a),
    error: (...a: unknown[]) => mockToastError(...a),
  },
}));
// Radix Select needs pointer APIs jsdom lacks; a native select labelled like its trigger keeps the contract.
jest.mock("@/components/ui/select", () => {
  const ReactLib = jest.requireActual("react");
  return {
    Select: ({
      value,
      onValueChange,
      disabled,
      children,
    }: {
      value?: string;
      onValueChange: (v: string) => void;
      disabled?: boolean;
      children: React.ReactNode;
    }) => {
      let label: string | undefined;
      ReactLib.Children.forEach(children, (child: React.ReactElement<{ "aria-label"?: string }>) => {
        if (ReactLib.isValidElement(child) && child.props["aria-label"]) label = child.props["aria-label"];
      });
      return (
        <select aria-label={label} value={value ?? ""} disabled={disabled} onChange={(e) => onValueChange(e.target.value)}>
          <option value="" />
          {children}
        </select>
      );
    },
    SelectTrigger: () => null,
    SelectValue: () => null,
    SelectContent: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    SelectItem: ({ value, children }: { value: string; children: React.ReactNode }) => (
      <option value={value}>{children}</option>
    ),
  };
});

beforeAll(() => {
  Element.prototype.scrollIntoView = jest.fn();
});

const V1 = { id: 4, version_number: 1 };
const V2 = { id: 7, version_number: 2 };

const baseCost = {
  project_id: 10,
  description: null,
  task_id: null,
  task_title: null,
  updated_by: null,
  created_at: "2025-03-10T10:00:00Z",
  updated_at: "2025-03-10T10:00:00Z",
};
const tokens = {
  ...baseCost,
  id: 1,
  adjustment_id: 4,
  version_number: 1,
  category_id: 2,
  category_name: "Herramientas",
  description: "Tokens ChatGPT",
  amount: 150000,
  incurred_at: "2025-03-10",
  created_by: 1,
  created_by_name: "Ana Admin",
};
const commercialPay = {
  ...baseCost,
  id: 2,
  adjustment_id: 7,
  version_number: 2,
  category_id: 3,
  category_name: "Pago comercial",
  amount: 350000,
  incurred_at: "2025-04-02",
  task_id: 55,
  task_title: "Reunión con cliente",
  created_by: 2,
  created_by_name: "Carlos Comercial",
};

const categories = [
  { id: 2, name: "Herramientas", created_by: 1, created_at: "2025-01-01" },
  { id: 3, name: "Pago comercial", created_by: 1, created_at: "2025-01-01" },
];

function costsPayload(versions = [V1, V2], adjustmentId: number | null = null) {
  const costs = adjustmentId === 7 ? [commercialPay] : [tokens, commercialPay];
  return {
    costs,
    total: costs.reduce((sum, c) => sum + c.amount, 0),
    by_category: [],
    versions,
    adjustment_id: adjustmentId,
  };
}

function mockApi({ versions = [V1, V2], empty = false }: { versions?: typeof V1[]; empty?: boolean } = {}) {
  mockGet.mockImplementation(async (url: string) => {
    if (url === "project-cost-categories") return { ok: true, status: 200, data: { data: categories } };
    if (url.startsWith("projects/10/tasks")) {
      return {
        ok: true,
        status: 200,
        data: url.endsWith("adjustment_id=7")
          ? [{ id: 55, title: "Reunión con cliente" }]
          : [{ id: 40, title: "Diseño logo" }],
      };
    }
    if (url.startsWith("projects/10/costs")) {
      const match = url.match(/adjustment_id=(\d+)/);
      const payload = costsPayload(versions, match ? Number(match[1]) : null);
      return { ok: true, status: 200, data: empty ? { ...payload, costs: [], total: 0 } : payload };
    }
    return { ok: false, status: 404, error: "not found" };
  });
}

function renderTab() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const invalidate = jest.spyOn(client, "invalidateQueries");
  const view = render(
    <QueryClientProvider client={client}>
      <ProjectCostsTab projectId={10} />
    </QueryClientProvider>
  );
  return { client, invalidate, ...view };
}

const norm = (s: string | null) => (s ?? "").replace(/\s/g, " ");

function today() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

async function openNewCost() {
  await userEvent.click(await screen.findByRole("button", { name: "Agregar costo" }));
  return screen.findByRole("dialog");
}

async function pickCategory(dialog: HTMLElement, name: string) {
  await userEvent.click(within(dialog).getByRole("combobox", { name: "Categoría" }));
  await userEvent.click(await screen.findByRole("option", { name: name }));
}

beforeEach(() => jest.clearAllMocks());

describe("ProjectCostsTab list (S1, S5)", () => {
  it("lists the costs with their data and the total", async () => {
    mockApi();
    renderTab();
    const rows = await screen.findAllByTestId("project-cost-row");
    expect(rows).toHaveLength(2);
    const first = within(rows[0]);
    expect(first.getByText("10/03/2025")).toBeInTheDocument();
    expect(first.getByText("Herramientas")).toBeInTheDocument();
    expect(first.getByText("Tokens ChatGPT")).toBeInTheDocument();
    expect(first.getByText("V1")).toBeInTheDocument();
    expect(first.getByText("Ana Admin")).toBeInTheDocument();
    expect(norm(first.getByTestId("project-cost-amount").textContent)).toBe("$ 150.000");
    const second = within(rows[1]);
    expect(second.getByText("Reunión con cliente")).toBeInTheDocument();
    expect(second.getByText("V2")).toBeInTheDocument();
    expect(norm(screen.getByTestId("project-costs-total").textContent)).toBe("$ 500.000");
    expect(mockGet).toHaveBeenCalledWith("projects/10/costs");
  });

  it("filters by version and shows the total of the visible costs", async () => {
    mockApi();
    renderTab();
    await screen.findAllByTestId("project-cost-row");
    await userEvent.selectOptions(screen.getByLabelText("Filtrar por versión"), "7");
    await waitFor(() => expect(mockGet).toHaveBeenCalledWith("projects/10/costs?adjustment_id=7"));
    await waitFor(() => expect(screen.getAllByTestId("project-cost-row")).toHaveLength(1));
    expect(norm(screen.getByTestId("project-costs-total").textContent)).toBe("$ 350.000");
  });

  it("shows an empty state when there are no costs", async () => {
    mockApi({ empty: true });
    renderTab();
    expect(await screen.findByText("Aún no hay costos registrados para este proyecto.")).toBeInTheDocument();
    expect(screen.queryByTestId("project-cost-row")).not.toBeInTheDocument();
  });
});

describe("ProjectCostsTab form", () => {
  it("defaults the date to today and omits the version with a single version (S5)", async () => {
    mockApi({ versions: [V1] });
    mockPost.mockResolvedValue({ ok: true, status: 201, data: { id: 3 } });
    const { invalidate } = renderTab();
    const dialog = await openNewCost();
    expect(within(dialog).getByLabelText("Fecha")).toHaveValue(today());
    expect(within(dialog).queryByLabelText("Versión")).not.toBeInTheDocument();

    await pickCategory(dialog, "Herramientas");
    await userEvent.type(within(dialog).getByLabelText("Descripción"), "Créditos Higgsfield");
    await userEvent.type(within(dialog).getByLabelText("Monto"), "1.500.000");
    await userEvent.click(within(dialog).getByRole("button", { name: "Guardar" }));

    await waitFor(() =>
      expect(mockPost).toHaveBeenCalledWith("projects/10/costs", {
        category_id: 2,
        description: "Créditos Higgsfield",
        amount: 1500000,
        incurred_at: today(),
        task_id: null,
      })
    );
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["project-costs", 10] });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["project-financials", 10] });
    expect(mockToastSuccess).toHaveBeenCalledWith("Costo agregado");
  });

  it("asks for the version with 2+ versions and links a task of that version (S3, S5)", async () => {
    mockApi();
    mockPost.mockResolvedValue({ ok: true, status: 201, data: { id: 3 } });
    renderTab();
    const dialog = await openNewCost();
    const version = within(dialog).getByLabelText("Versión");
    expect(within(version).getByRole("option", { name: "Versión 1" })).toBeInTheDocument();
    expect(within(version).getByRole("option", { name: "Versión 2" })).toBeInTheDocument();

    await pickCategory(dialog, "Pago comercial");
    await userEvent.type(within(dialog).getByLabelText("Monto"), "350000");
    await userEvent.selectOptions(version, "7");
    await waitFor(() => expect(mockGet).toHaveBeenCalledWith("projects/10/tasks?adjustment_id=7"));
    const task = within(dialog).getByLabelText("Tarea vinculada");
    await waitFor(() => expect(within(task).getByRole("option", { name: "Reunión con cliente" })).toBeInTheDocument());
    await userEvent.selectOptions(task, "55");
    await userEvent.click(within(dialog).getByRole("button", { name: "Guardar" }));

    await waitFor(() =>
      expect(mockPost).toHaveBeenCalledWith("projects/10/costs", {
        category_id: 3,
        description: null,
        amount: 350000,
        incurred_at: today(),
        task_id: 55,
        adjustment_id: 7,
      })
    );
  });

  it("requires the version when there are 2+ versions (S5)", async () => {
    mockApi();
    renderTab();
    const dialog = await openNewCost();
    await pickCategory(dialog, "Herramientas");
    await userEvent.type(within(dialog).getByLabelText("Monto"), "1000");
    await userEvent.click(within(dialog).getByRole("button", { name: "Guardar" }));
    expect(
      await within(dialog).findByText("Selecciona la versión del proyecto a la que pertenece el costo.")
    ).toBeInTheDocument();
    expect(mockPost).not.toHaveBeenCalled();
  });

  it("creates a missing category from the search and selects it (S6)", async () => {
    mockApi({ versions: [V1] });
    mockPost.mockImplementation(async (url: string) =>
      url === "project-cost-categories"
        ? { ok: true, status: 201, data: { id: 9, name: "Licencias", created_by: 1, created_at: "2025-05-01" } }
        : { ok: true, status: 201, data: { id: 3 } }
    );
    renderTab();
    const dialog = await openNewCost();
    const trigger = within(dialog).getByRole("combobox", { name: "Categoría" });
    await userEvent.click(trigger);
    await userEvent.type(await screen.findByPlaceholderText("Buscar o crear categoría..."), "Licencias");
    await userEvent.click(await screen.findByRole("option", { name: "Crear «Licencias»" }));

    await waitFor(() => expect(mockPost).toHaveBeenCalledWith("project-cost-categories", { name: "Licencias" }));
    await waitFor(() => expect(trigger).toHaveTextContent("Licencias"));

    await userEvent.type(within(dialog).getByLabelText("Monto"), "80000");
    await userEvent.click(within(dialog).getByRole("button", { name: "Guardar" }));
    await waitFor(() =>
      expect(mockPost).toHaveBeenCalledWith("projects/10/costs", expect.objectContaining({ category_id: 9 }))
    );
  });

  it("does not offer to create a category that already exists, ignoring case (S6)", async () => {
    mockApi({ versions: [V1] });
    renderTab();
    const dialog = await openNewCost();
    await userEvent.click(within(dialog).getByRole("combobox", { name: "Categoría" }));
    await userEvent.type(await screen.findByPlaceholderText("Buscar o crear categoría..."), "herramientas");
    expect(await screen.findByRole("option", { name: "Herramientas" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: /Crear/ })).not.toBeInTheDocument();
  });

  it("rejects an invalid amount without calling the API", async () => {
    mockApi({ versions: [V1] });
    renderTab();
    const dialog = await openNewCost();
    await pickCategory(dialog, "Herramientas");
    await userEvent.type(within(dialog).getByLabelText("Monto"), "abc");
    await userEvent.click(within(dialog).getByRole("button", { name: "Guardar" }));
    expect(
      await within(dialog).findByText("Ingresa un precio válido en pesos (solo números)")
    ).toBeInTheDocument();
    expect(mockPost).not.toHaveBeenCalled();
  });

  it("rejects a zero amount without calling the API", async () => {
    mockApi({ versions: [V1] });
    renderTab();
    const dialog = await openNewCost();
    await pickCategory(dialog, "Herramientas");
    await userEvent.type(within(dialog).getByLabelText("Monto"), "0");
    await userEvent.click(within(dialog).getByRole("button", { name: "Guardar" }));
    expect(await within(dialog).findByText("El monto debe ser mayor que 0")).toBeInTheDocument();
    expect(mockPost).not.toHaveBeenCalled();
  });

  it("edits a cost with PATCH and refreshes the costs and financials", async () => {
    mockApi();
    mockPatch.mockResolvedValue({ ok: true, status: 200, data: { id: 1 } });
    const { invalidate } = renderTab();
    const rows = await screen.findAllByTestId("project-cost-row");
    await userEvent.click(within(rows[0]).getByRole("button", { name: "Editar costo" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByRole("combobox", { name: "Categoría" })).toHaveTextContent("Herramientas");
    expect(within(dialog).getByLabelText("Descripción")).toHaveValue("Tokens ChatGPT");
    expect(within(dialog).getByLabelText("Fecha")).toHaveValue("2025-03-10");
    const amount = within(dialog).getByLabelText("Monto");
    await userEvent.clear(amount);
    await userEvent.type(amount, "200.000");
    await userEvent.click(within(dialog).getByRole("button", { name: "Guardar" }));

    await waitFor(() =>
      expect(mockPatch).toHaveBeenCalledWith("projects/10/costs/1", {
        category_id: 2,
        description: "Tokens ChatGPT",
        amount: 200000,
        incurred_at: "2025-03-10",
        task_id: null,
        adjustment_id: 4,
      })
    );
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["project-costs", 10] });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["project-financials", 10] });
  });

  it("shows the API error and keeps the dialog open", async () => {
    mockApi({ versions: [V1] });
    mockPost.mockResolvedValue({ ok: false, status: 403, error: "No tienes acceso a este proyecto" });
    renderTab();
    const dialog = await openNewCost();
    await pickCategory(dialog, "Herramientas");
    await userEvent.type(within(dialog).getByLabelText("Monto"), "1000");
    await userEvent.click(within(dialog).getByRole("button", { name: "Guardar" }));
    await waitFor(() => expect(mockToastError).toHaveBeenCalledWith("No tienes acceso a este proyecto"));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
});

describe("ProjectCostsTab delete", () => {
  it("asks for confirmation and deletes the cost", async () => {
    mockApi();
    mockDel.mockResolvedValue({ ok: true, status: 200, data: { success: true } });
    const { invalidate } = renderTab();
    const rows = await screen.findAllByTestId("project-cost-row");
    await userEvent.click(within(rows[0]).getByRole("button", { name: "Eliminar costo" }));
    const confirm = await screen.findByRole("alertdialog");
    expect(mockDel).not.toHaveBeenCalled();
    await userEvent.click(within(confirm).getByRole("button", { name: "Eliminar" }));
    await waitFor(() => expect(mockDel).toHaveBeenCalledWith("projects/10/costs/1"));
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["project-costs", 10] });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["project-financials", 10] });
    expect(mockToastSuccess).toHaveBeenCalledWith("Costo eliminado");
  });

  it("does not delete when the confirmation is cancelled", async () => {
    mockApi();
    renderTab();
    const rows = await screen.findAllByTestId("project-cost-row");
    await userEvent.click(within(rows[0]).getByRole("button", { name: "Eliminar costo" }));
    await userEvent.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Cancelar" }));
    expect(mockDel).not.toHaveBeenCalled();
  });
});

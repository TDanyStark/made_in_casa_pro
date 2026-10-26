import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const mockGet = jest.fn();
const mockPatch = jest.fn();
jest.mock("@/lib/services/apiService", () => ({
  get: (...args: unknown[]) => mockGet(...args),
  patch: (...args: unknown[]) => mockPatch(...args),
}));

jest.mock("sonner", () => ({ toast: { success: jest.fn(), error: jest.fn() } }));

jest.mock("@/components/ui/dialog", () => ({
  Dialog: ({ children, open }: { children: React.ReactNode; open: boolean }) =>
    open ? <div data-testid="dialog">{children}</div> : null,
  DialogContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
  DialogDescription: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

jest.mock("@/components/ui/button", () => ({
  Button: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button {...props}>{children}</button>
  ),
}));

jest.mock("@/components/ui/badge", () => ({
  Badge: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
}));

jest.mock("lucide-react", () => new Proxy({}, {
  get: (_, iconName: string) => {
    const MockIcon = () => <svg data-testid={`icon-${iconName}`} />;
    MockIcon.displayName = iconName;
    return MockIcon;
  },
}));

import { toast } from "sonner";
import { TaskDeliverableDialog } from "@/components/tasks/TaskDeliverableDialog";

function makeTask(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    project_id: 10,
    template_id: null,
    title: "Entrega final",
    description: null,
    area_id: null,
    area_name: null,
    assigned_user_id: 5,
    assigned_user_name: "Ana",
    assigned_user_rol_id: 4,
    status: "completed",
    task_type: "execution",
    task_flag: "new",
    adjustment_id: null,
    requires_quote: 0,
    assign_to_commercial: 0,
    order_index: 0,
    created_at: "2026-04-07T00:00:00.000Z",
    updated_at: "2026-04-07T00:00:00.000Z",
    delivery_url: null,
    delivery_notes: null,
    completion_cost: null,
    progress_percent: 100,
    progress_minutes: 60,
    ...overrides,
  } as never;
}

function mockLayout(scrollHeight: number, clientHeight: number) {
  const scroll = jest
    .spyOn(HTMLElement.prototype, "scrollHeight", "get")
    .mockReturnValue(scrollHeight);
  const client = jest
    .spyOn(HTMLElement.prototype, "clientHeight", "get")
    .mockReturnValue(clientHeight);
  return () => {
    scroll.mockRestore();
    client.mockRestore();
  };
}

function renderDialog(overrides: Record<string, unknown> = {}) {
  return render(
    <TaskDeliverableDialog open={true} onOpenChange={jest.fn()} task={makeTask(overrides)} />
  );
}

describe("TaskDeliverableDialog", () => {
  it("renders the task title as heading without the old delivery subtitle", () => {
    renderDialog();

    expect(screen.getByRole("heading", { name: "Entrega final" })).toBeInTheDocument();
    expect(screen.queryByText(/información de entrega registrada/i)).not.toBeInTheDocument();
    expect(screen.queryByText("Ver entregable")).not.toBeInTheDocument();
  });

  it("shows 'Sin descripción' when the task has no description", () => {
    renderDialog({ description: "   " });

    expect(screen.getByText("Sin descripción")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /ver más/i })).not.toBeInTheDocument();
  });

  it("does not offer 'Ver más' when the description fits in two lines", () => {
    const restore = mockLayout(40, 40);
    try {
      renderDialog({ description: "Descripción corta" });

      expect(screen.getByTestId("task-description")).toHaveTextContent("Descripción corta");
      expect(screen.getByTestId("task-description")).toHaveClass("line-clamp-2");
      expect(screen.queryByRole("button", { name: /ver más/i })).not.toBeInTheDocument();
    } finally {
      restore();
    }
  });

  it("clamps a long description and toggles 'Ver más' / 'Ver menos'", () => {
    const restore = mockLayout(120, 40);
    try {
      renderDialog({ description: "Línea 1\nLínea 2\nLínea 3\nLínea 4" });

      const paragraph = screen.getByTestId("task-description");
      expect(paragraph).toHaveClass("line-clamp-2", "whitespace-pre-line");

      fireEvent.click(screen.getByRole("button", { name: "Ver más" }));
      expect(paragraph).not.toHaveClass("line-clamp-2");

      fireEvent.click(screen.getByRole("button", { name: "Ver menos" }));
      expect(paragraph).toHaveClass("line-clamp-2");
      expect(screen.getByRole("button", { name: "Ver más" })).toBeInTheDocument();
    } finally {
      restore();
    }
  });

  it("falls back to a length heuristic when the paragraph has no layout", () => {
    renderDialog({ description: "a".repeat(200) });

    expect(screen.getByRole("button", { name: "Ver más" })).toBeInTheDocument();
  });

  it("shows only title and description for a non-completed task", () => {
    renderDialog({
      status: "in_progress",
      description: "Hacer el arte",
      delivery_url: "https://example.com/x",
    });

    expect(screen.getByRole("heading", { name: "Entrega final" })).toBeInTheDocument();
    expect(screen.getByText("Hacer el arte")).toBeInTheDocument();
    expect(screen.queryByText(/tiempo invertido/i)).not.toBeInTheDocument();
    expect(screen.queryByText("Sin link reportado")).not.toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(screen.queryByText("Notas de entrega")).not.toBeInTheDocument();
  });

  it("shows time row, 'Sin link reportado' and empty notes for a completed task without deliverable", () => {
    renderDialog();

    expect(screen.getByText("Tiempo invertido:")).toBeInTheDocument();
    expect(screen.getByText("1 h")).toBeInTheDocument();
    expect(screen.getByText("Sin link reportado")).toBeInTheDocument();
    expect(screen.getByText("Notas de entrega")).toBeInTheDocument();
    expect(screen.getByText("No se registraron notas de entrega.")).toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("shows 'Sin tiempo registrado' when no time was logged", () => {
    renderDialog({ progress_minutes: 0 });

    expect(screen.getByText("Sin tiempo registrado")).toBeInTheDocument();
  });

  it("renders a clickable delivery link and the notes section", () => {
    renderDialog({
      delivery_url: "https://example.com/deliverable",
      delivery_notes: "<p>Versión final aprobada</p>",
    });

    const link = screen.getByRole("link", { name: /https:\/\/example.com\/deliverable/ });
    expect(link).toHaveAttribute("href", "https://example.com/deliverable");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noreferrer");
    expect(screen.getByText(/versión final aprobada/i)).toBeInTheDocument();
    expect(screen.queryByText("Sin link reportado")).not.toBeInTheDocument();
  });

  it("strips script and event-handler payloads from delivery notes", () => {
    const { container } = renderDialog({
      delivery_notes: '<p>entrega</p><img src=x onerror="alert(1)"><script>alert(2)</script>',
    });

    expect(screen.getByText("entrega")).toBeInTheDocument();
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector("script")).toBeNull();
  });

  it("renders a non-http delivery value as plain text", () => {
    renderDialog({ delivery_url: "javascript:alert(1)" });

    expect(screen.getByText("javascript:alert(1)")).toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });
});

// S7: cost block, only when the caller passes showCost (leadership roles).
describe("TaskDeliverableDialog — task cost (S7)", () => {
  const money = (value: number) =>
    new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 })
      .format(value)
      .replace(/\s+/g, " ");

  function renderWithCost(cost: Record<string, unknown> | null, showCost = true) {
    mockGet.mockResolvedValue({ ok: true, data: cost });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return render(
      <QueryClientProvider client={client}>
        <TaskDeliverableDialog open={true} onOpenChange={jest.fn()} task={makeTask()} showCost={showCost} />
      </QueryClientProvider>
    );
  }

  beforeEach(() => mockGet.mockReset());

  it("does not fetch nor show the cost by default", () => {
    renderDialog();

    expect(screen.queryByText("Costo de la tarea")).not.toBeInTheDocument();
    expect(mockGet).not.toHaveBeenCalled();
  });

  it("shows an internal cost with time and frozen rate", async () => {
    renderWithCost({ cost: 45000, internal: true, minutes: 90, hourly_rate: 30000, source: "frozen_rate" });

    expect(await screen.findByText(money(45000))).toBeInTheDocument();
    expect(screen.getByText("Costo de la tarea")).toBeInTheDocument();
    expect(screen.getByText(`Interno · 1 h 30 min × ${money(30000)}/h`)).toBeInTheDocument();
    expect(mockGet).toHaveBeenCalledWith("projects/10/tasks/1/cost");
  });

  it("shows an internal cost at the current rate for unfinished work", async () => {
    renderWithCost({ cost: 20000, internal: true, minutes: 30, hourly_rate: 40000, source: "current_rate" });

    expect(await screen.findByText(money(20000))).toBeInTheDocument();
    expect(screen.getByText(`Interno · 30 min × ${money(40000)}/h`)).toBeInTheDocument();
  });

  it("shows an external declared cost", async () => {
    renderWithCost({ cost: 500000, internal: false, minutes: 60, hourly_rate: null, source: "declared" });

    expect(await screen.findByText(money(500000))).toBeInTheDocument();
    expect(screen.getByText("Externo · costo declarado")).toBeInTheDocument();
  });

  it("shows an external accepted quote", async () => {
    renderWithCost({ cost: 70000, internal: false, minutes: 60, hourly_rate: null, source: "quote" });

    expect(await screen.findByText(money(70000))).toBeInTheDocument();
    expect(screen.getByText("Externo · cotización aceptada")).toBeInTheDocument();
  });

  it("shows 'Sin costo registrado' when there is no cost source", async () => {
    renderWithCost({ cost: 0, internal: false, minutes: 1080, hourly_rate: null, source: "none" });

    expect(await screen.findByText("Sin costo registrado")).toBeInTheDocument();
    expect(screen.queryByText(money(0))).not.toBeInTheDocument();
  });

  it("does not render the block when showCost is false even inside a query provider", async () => {
    renderWithCost({ cost: 1, internal: true, minutes: 1, hourly_rate: 1, source: "frozen_rate" }, false);

    await waitFor(() => expect(mockGet).not.toHaveBeenCalled());
    expect(screen.queryByText("Costo de la tarea")).not.toBeInTheDocument();
  });
});

// S15, S16: directivo/admin correct the cost of a completed external task from the eye dialog.
describe("TaskDeliverableDialog — cost correction (S15, S16)", () => {
  const money = (value: number) =>
    new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 })
      .format(value)
      .replace(/\s+/g, " ");
  const external = {
    cost: 500000, internal: false, minutes: 60, hourly_rate: null, source: "declared",
    editable: true, original_cost: null, updated_by_name: null, updated_at: null,
  };
  const corrected = {
    ...external, cost: 650000, original_cost: 500000, updated_by_name: "Diana",
    updated_at: "2026-05-03T15:00:00.000Z",
  };
  const auditDate = new Date("2026-05-03T15:00:00.000Z").toLocaleDateString("es-CO", {
    timeZone: "America/Bogota", day: "numeric", month: "long", year: "numeric",
  });

  function renderEditable(cost: Record<string, unknown>, canEditCost?: boolean) {
    mockGet.mockResolvedValue({ ok: true, data: cost });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const invalidate = jest.spyOn(client, "invalidateQueries");
    render(
      <QueryClientProvider client={client}>
        <TaskDeliverableDialog
          open={true}
          onOpenChange={jest.fn()}
          task={makeTask()}
          showCost={true}
          {...(canEditCost === undefined ? {} : { canEditCost })}
        />
      </QueryClientProvider>
    );
    return { client, invalidate };
  }

  beforeEach(() => {
    mockGet.mockReset();
    mockPatch.mockReset();
    (toast.success as jest.Mock).mockReset();
    (toast.error as jest.Mock).mockReset();
  });

  it("does not offer the pencil without canEditCost (default)", async () => {
    renderEditable(external);
    expect(await screen.findByText(money(500000))).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Corregir costo de la tarea" })).not.toBeInTheDocument();
  });

  it("does not offer the pencil when the cost is not editable (internal)", async () => {
    renderEditable({ cost: 45000, internal: true, minutes: 90, hourly_rate: 30000, source: "frozen_rate",
      editable: false, original_cost: null, updated_by_name: null, updated_at: null }, true);
    expect(await screen.findByText(money(45000))).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Corregir costo de la tarea" })).not.toBeInTheDocument();
  });

  it("saves a corrected cost with PATCH, toasts and refreshes the cost and the project financials", async () => {
    const { client, invalidate } = renderEditable(external, true);
    fireEvent.click(await screen.findByRole("button", { name: "Corregir costo de la tarea" }));
    const input = screen.getByLabelText("Nuevo costo de la tarea");
    expect(input).toHaveValue("500000");
    fireEvent.change(input, { target: { value: "650000" } });
    mockPatch.mockResolvedValue({ ok: true, data: corrected });
    fireEvent.click(screen.getByRole("button", { name: "Guardar" }));

    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Costo de la tarea actualizado"));
    expect(mockPatch).toHaveBeenCalledWith("projects/10/tasks/1/cost", { completion_cost: 650000 });
    expect(await screen.findByText(money(650000))).toBeInTheDocument();
    expect(client.getQueryData(["task-cost", 10, 1])).toEqual(corrected);
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["project-financials", 10] });
    expect(screen.queryByLabelText("Nuevo costo de la tarea")).not.toBeInTheDocument();
  });

  it("parses Colombian thousands separators in the corrected cost", async () => {
    renderEditable(external, true);
    fireEvent.click(await screen.findByRole("button", { name: "Corregir costo de la tarea" }));
    fireEvent.change(screen.getByLabelText("Nuevo costo de la tarea"), { target: { value: "1.500.000" } });
    mockPatch.mockResolvedValue({ ok: true, data: { ...external, cost: 1500000 } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar" }));

    await waitFor(() => expect(mockPatch).toHaveBeenCalledWith("projects/10/tasks/1/cost", { completion_cost: 1500000 }));
  });

  it("does not send a non-numeric cost and shows an error", async () => {
    renderEditable(external, true);
    fireEvent.click(await screen.findByRole("button", { name: "Corregir costo de la tarea" }));
    fireEvent.change(screen.getByLabelText("Nuevo costo de la tarea"), { target: { value: "abc" } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar" }));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Ingresa un precio válido en pesos (solo números)"));
    expect(mockPatch).not.toHaveBeenCalled();
  });

  it("sends 0 as a valid cost", async () => {
    renderEditable(external, true);
    fireEvent.click(await screen.findByRole("button", { name: "Corregir costo de la tarea" }));
    fireEvent.change(screen.getByLabelText("Nuevo costo de la tarea"), { target: { value: "0" } });
    mockPatch.mockResolvedValue({ ok: true, data: { ...external, cost: 0 } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar" }));

    await waitFor(() => expect(mockPatch).toHaveBeenCalledWith("projects/10/tasks/1/cost", { completion_cost: 0 }));
  });

  it("does not send an empty value", async () => {
    renderEditable(external, true);
    fireEvent.click(await screen.findByRole("button", { name: "Corregir costo de la tarea" }));
    fireEvent.change(screen.getByLabelText("Nuevo costo de la tarea"), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar" }));

    expect(screen.getByRole("button", { name: "Guardar" })).toBeDisabled();
    expect(mockPatch).not.toHaveBeenCalled();
  });

  it("toasts the API error and keeps the old value", async () => {
    renderEditable(external, true);
    fireEvent.click(await screen.findByRole("button", { name: "Corregir costo de la tarea" }));
    fireEvent.change(screen.getByLabelText("Nuevo costo de la tarea"), { target: { value: "650000" } });
    mockPatch.mockResolvedValue({ ok: false, error: "Solo se puede corregir el costo de una tarea completada" });
    fireEvent.click(screen.getByRole("button", { name: "Guardar" }));

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("Solo se puede corregir el costo de una tarea completada")
    );
    expect(toast.success).not.toHaveBeenCalled();
    // The editor stays open to retry; cancelling shows the unchanged stored cost.
    expect(screen.getByLabelText("Nuevo costo de la tarea")).toHaveValue("650000");
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(screen.getByText(money(500000))).toBeInTheDocument();
  });

  it("cancel closes the editor without saving", async () => {
    renderEditable(external, true);
    fireEvent.click(await screen.findByRole("button", { name: "Corregir costo de la tarea" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));

    expect(screen.queryByLabelText("Nuevo costo de la tarea")).not.toBeInTheDocument();
    expect(mockPatch).not.toHaveBeenCalled();
  });

  it("shows the audit line of a corrected cost to every role that sees the cost", async () => {
    renderEditable(corrected);
    expect(await screen.findByText(money(650000))).toBeInTheDocument();
    expect(
      screen.getByText(`Corregido por Diana el ${auditDate} · valor declarado ${money(500000)}`)
    ).toBeInTheDocument();
  });

  it("shows no audit line for a never corrected cost", async () => {
    renderEditable(external, true);
    expect(await screen.findByText(money(500000))).toBeInTheDocument();
    expect(screen.queryByText(/Corregido por/)).not.toBeInTheDocument();
  });
});

// S8: an external assignee (colaborador whose is_internal is 0 or NULL) must declare the cost.
import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

const mockPost = jest.fn();
const mockToastError = jest.fn();

jest.mock("@/lib/services/apiService", () => ({
  post: (...args: unknown[]) => mockPost(...args),
}));

jest.mock("sonner", () => ({
  toast: {
    error: (...args: unknown[]) => mockToastError(...args),
    success: jest.fn(),
    warning: jest.fn(),
  },
}));

jest.mock("next/dynamic", () => () => {
  const Editor = ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
    <textarea aria-label="Nota de entrega" value={value} onChange={(e) => onChange(e.target.value)} />
  );
  return Editor;
});

jest.mock("@/components/ui/dialog", () => ({
  Dialog: ({ children, open }: { children: React.ReactNode; open: boolean }) =>
    open ? <div>{children}</div> : null,
  DialogContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
  DialogFooter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

jest.mock("lucide-react", () => new Proxy({}, {
  get: (_, iconName: string) => {
    const MockIcon = () => <svg data-testid={`icon-${iconName}`} />;
    MockIcon.displayName = iconName;
    return MockIcon;
  },
}));

import { TaskCompleteDialog } from "@/components/tasks/TaskCompleteDialog";

const COST_ERROR = "Debes ingresar el costo del trabajo antes de completar.";

function makeTask(overrides: Record<string, unknown> = {}) {
  return {
    id: 141,
    project_id: 65,
    title: "Diseño de piezas",
    assigned_user_id: 9,
    assigned_user_name: "Diego",
    assigned_user_rol_id: 4,
    assigned_user_is_internal: null,
    status: "in_progress",
    task_type: "execution",
    requires_quote: 0,
    completion_cost: null,
    progress_minutes: 30,
    ...overrides,
  } as never;
}

function renderDialog(overrides: Record<string, unknown> = {}) {
  render(
    <TaskCompleteDialog open={true} onOpenChange={jest.fn()} task={makeTask(overrides)} onSuccess={jest.fn()} />
  );
  fireEvent.change(screen.getByLabelText("Nota de entrega"), { target: { value: "<p>Listo</p>" } });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockPost.mockResolvedValue({ ok: true, data: {} });
});

describe("TaskCompleteDialog — external cost (S8)", () => {
  it("asks for the cost and blocks completion for a colaborador with is_internal NULL", async () => {
    renderDialog({ assigned_user_is_internal: null });

    expect(screen.getByText("Costo del trabajo")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /completar y entregar/i }));

    await waitFor(() => expect(mockToastError).toHaveBeenCalledWith(COST_ERROR));
    expect(mockPost).not.toHaveBeenCalled();
  });

  it("still blocks a colaborador with is_internal 0 without cost", async () => {
    renderDialog({ assigned_user_is_internal: 0 });

    fireEvent.click(screen.getByRole("button", { name: /completar y entregar/i }));

    await waitFor(() => expect(mockToastError).toHaveBeenCalledWith(COST_ERROR));
    expect(mockPost).not.toHaveBeenCalled();
  });

  it("keeps asking the cost for a non-colaborador assignee with is_internal 0", async () => {
    renderDialog({ assigned_user_rol_id: 3, assigned_user_is_internal: 0 });

    expect(screen.getByText("Costo del trabajo")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /completar y entregar/i }));

    await waitFor(() => expect(mockToastError).toHaveBeenCalledWith(COST_ERROR));
    expect(mockPost).not.toHaveBeenCalled();
  });

  it("accepts 0 as the declared cost of free work", async () => {
    renderDialog({ assigned_user_is_internal: 0 });

    expect(screen.getByText("Si el trabajo fue gratis (revisión o ajuste), escribe 0.")).toBeInTheDocument();
    fireEvent.change(document.getElementById("task-completion-cost")!, { target: { value: "0" } });
    fireEvent.click(screen.getByRole("button", { name: /completar y entregar/i }));

    await waitFor(() => expect(mockPost).toHaveBeenCalledTimes(1));
    expect(mockToastError).not.toHaveBeenCalled();
    expect(mockPost).toHaveBeenCalledWith("projects/65/tasks/141/complete", {
      notes: "<p>Listo</p>",
      progress_minutes: 30,
      delivery_url: null,
      completion_cost: 0,
    });
  });

  it("rejects a negative cost and sends nothing", async () => {
    renderDialog({ assigned_user_is_internal: 0 });

    fireEvent.change(document.getElementById("task-completion-cost")!, { target: { value: "-5" } });
    fireEvent.click(screen.getByRole("button", { name: /completar y entregar/i }));

    await waitFor(() => expect(mockToastError).toHaveBeenCalledWith(COST_ERROR));
    expect(mockPost).not.toHaveBeenCalled();
  });

  it("sends the declared cost for an external colaborador", async () => {
    renderDialog({ assigned_user_is_internal: null });

    fireEvent.change(document.getElementById("task-completion-cost")!, { target: { value: "500000" } });
    fireEvent.click(screen.getByRole("button", { name: /completar y entregar/i }));

    await waitFor(() => expect(mockPost).toHaveBeenCalledTimes(1));
    expect(mockPost).toHaveBeenCalledWith("projects/65/tasks/141/complete", {
      notes: "<p>Listo</p>",
      progress_minutes: 30,
      delivery_url: null,
      completion_cost: 500000,
    });
  });

  it.each([
    ["internal colaborador", { assigned_user_rol_id: 4, assigned_user_is_internal: 1 }],
    ["comercial with is_internal NULL", { assigned_user_rol_id: 3, assigned_user_is_internal: null }],
  ])("does not ask the cost for a %s", async (_label, overrides) => {
    renderDialog(overrides);

    expect(screen.queryByText("Costo del trabajo")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /completar y entregar/i }));

    await waitFor(() => expect(mockPost).toHaveBeenCalledTimes(1));
    expect(mockToastError).not.toHaveBeenCalled();
    expect(mockPost.mock.calls[0][1]).toMatchObject({ completion_cost: null });
  });
});

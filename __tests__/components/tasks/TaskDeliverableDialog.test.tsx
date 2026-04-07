import React from "react";
import { render, screen } from "@testing-library/react";

jest.mock("@/components/ui/dialog", () => ({
  Dialog: ({ children, open }: { children: React.ReactNode; open: boolean }) =>
    open ? <div data-testid="dialog">{children}</div> : null,
  DialogContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogDescription: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

jest.mock("@/components/ui/card", () => ({
  Card: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardTitle: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardDescription: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

jest.mock("@/components/ui/button", () => ({
  Button: ({ children, asChild }: { children: React.ReactNode; asChild?: boolean }) =>
    asChild ? <>{children}</> : <button>{children}</button>,
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

describe("TaskDeliverableDialog", () => {
  it("shows a clear empty state when the task has no deliverable data", () => {
    render(
      <TaskDeliverableDialog
        open={true}
        onOpenChange={jest.fn()}
        task={makeTask()}
      />
    );

    expect(screen.getByText(/sin entregable registrado/i)).toBeInTheDocument();
    expect(screen.getByText(/todavía no tiene enlace ni notas de entrega/i)).toBeInTheDocument();
  });

  it("shows delivery link and notes in read-only mode", () => {
    render(
      <TaskDeliverableDialog
        open={true}
        onOpenChange={jest.fn()}
        task={makeTask({
          delivery_url: "https://example.com/deliverable",
          delivery_notes: "<p>Versión final aprobada</p>",
        })}
      />
    );

    expect(screen.getByText("https://example.com/deliverable")).toBeInTheDocument();
    expect(screen.getByText(/versión final aprobada/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /abrir enlace/i })).toHaveAttribute(
      "href",
      "https://example.com/deliverable"
    );
  });
});

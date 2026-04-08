import React from "react";
import { render, screen } from "@testing-library/react";

jest.mock("@/components/ui/button", () => ({
  Button: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button {...props}>{children}</button>
  ),
}));

jest.mock("@/components/ui/card", () => ({
  Card: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardTitle: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

jest.mock("@/components/ui/badge", () => ({
  Badge: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
}));

jest.mock("@/components/tasks/TaskDeliverableDialog", () => ({
  TaskDeliverableDialog: () => null,
}));

jest.mock("lucide-react", () => new Proxy({}, {
  get: (_, iconName: string) => {
    const MockIcon = () => <svg data-testid={`icon-${iconName}`} />;
    MockIcon.displayName = iconName;
    return MockIcon;
  },
}));

import { CollaboratorTasksList } from "@/components/projects/CollaboratorTasksList";

function makeTask(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    project_id: 15,
    template_id: null,
    title: "Tarea",
    description: "Detalle breve",
    area_id: null,
    area_name: null,
    assigned_user_id: null,
    assigned_user_name: null,
    assigned_user_rol_id: null,
    status: "not_started",
    task_type: "execution",
    task_flag: "new",
    adjustment_id: null,
    requires_quote: 1,
    assign_to_commercial: 0,
    order_index: 0,
    created_at: "2026-04-08T00:00:00.000Z",
    updated_at: "2026-04-08T00:00:00.000Z",
    progress_percent: 0,
    progress_minutes: 0,
    ...overrides,
  } as never;
}

describe("CollaboratorTasksList", () => {
  it("only shows quote action for invited tasks that are still open", () => {
    render(
      <CollaboratorTasksList
        tasks={[
          makeTask({ id: 11, title: "Abierta", status: "blocked" }),
          makeTask({ id: 12, title: "Asignada", status: "not_started", assigned_user_id: 44 }),
          makeTask({ id: 13, title: "Completada", status: "completed" }),
        ]}
        invitedTaskIds={[11]}
        submittedQuotes={[]}
        onQuoteTask={jest.fn()}
      />
    );

    expect(screen.getByText("Abierta")).toBeInTheDocument();
    expect(screen.getByText("Asignada")).toBeInTheDocument();
    expect(screen.getByText("Completada")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /enviar cotización/i })).toBeInTheDocument();
    expect(screen.getByTitle(/ver entregable/i)).toBeInTheDocument();
    expect(screen.queryByText(/tarea completada - no puedes enviar cotización/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/visible solo como contexto del proyecto/i)).not.toBeInTheDocument();
  });
});

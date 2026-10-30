import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const mockQueryFns: Record<string, () => Promise<unknown>> = {};
let mockTasksError = false;
let mockTasksOverride: unknown[] | null = null;

jest.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({
    invalidateQueries: jest.fn(),
  }),
  useQuery: ({ queryKey, queryFn }: { queryKey: unknown[]; queryFn: () => Promise<unknown> }) => {
    mockQueryFns[String(queryKey[0])] = queryFn;
    if (String(queryKey[0]) === "project-tasks" && mockTasksError) {
      return {
        data: undefined,
        isLoading: false,
        isError: true,
        isFetching: false,
        refetch: jest.fn(),
        dataUpdatedAt: 0,
      };
    }
    if (String(queryKey[0]) === "task-cost") {
      return {
        data: { cost: 15000, internal: true, minutes: 30, hourly_rate: 30000, source: "frozen_rate" },
        isLoading: false,
        isError: false,
      };
    }
    if (String(queryKey[0]) === "project-tasks" && mockTasksOverride) {
      return {
        data: mockTasksOverride,
        isLoading: false,
        isFetching: false,
        refetch: jest.fn(),
        dataUpdatedAt: Date.now(),
      };
    }
    if (String(queryKey[0]) === "project-tasks") {
      return {
        data: [
          {
            id: 11,
            project_id: 7,
            template_id: null,
            title: "Subir artes finales",
            description: null,
            area_id: null,
            area_name: null,
            assigned_user_id: 4,
            assigned_user_name: "Vale",
            assigned_user_rol_id: 4,
            assigned_user_is_internal: 1,
            status: "completed",
            task_type: "execution",
            task_flag: "new",
            adjustment_id: null,
            requires_quote: 0,
            assign_to_commercial: 0,
            order_index: 0,
            created_at: "2026-04-07T00:00:00.000Z",
            updated_at: "2026-04-07T00:00:00.000Z",
            delivery_url: "https://example.com/final",
            delivery_notes: "<p>Entrega publicada</p>",
            completion_cost: null,
            progress_percent: 100,
            progress_minutes: 30,
            quoter_ids: [],
            quote_count: 0,
            pending_quote_count: 0,
          },
        ],
        isLoading: false,
        isFetching: false,
        refetch: jest.fn(),
        dataUpdatedAt: Date.now(),
      };
    }

    return {
      data: [],
      isLoading: false,
      isFetching: false,
      refetch: jest.fn(),
      dataUpdatedAt: Date.now(),
    };
  },
}));

jest.mock("@/lib/services/apiService", () => ({
  get: jest.fn(),
  post: jest.fn(),
  patch: jest.fn(),
  del: jest.fn(),
}));

jest.mock("sonner", () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));

jest.mock("@/components/tasks/TaskValidationDialog", () => ({
  TaskValidationDialog: () => null,
}));

jest.mock("@/components/tasks/TaskCompleteDialog", () => ({
  TaskCompleteDialog: () => null,
}));

jest.mock("@/components/tasks/TaskHistoryDialog", () => ({
  TaskHistoryDialog: () => null,
}));

jest.mock("@/components/tasks/TaskAssignmentSelector", () => ({
  TaskAssignmentSelector: () => null,
}));

jest.mock("@/components/ui/tooltip", () => ({
  TooltipProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Tooltip: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  TooltipTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  TooltipContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

jest.mock("@/components/ui/dialog", () => ({
  Dialog: ({ children, open }: { children: React.ReactNode; open: boolean }) =>
    open ? <div>{children}</div> : null,
  DialogContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogDescription: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogFooter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

jest.mock("@/components/ui/alert-dialog", () => ({
  AlertDialog: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AlertDialogTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AlertDialogContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AlertDialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AlertDialogTitle: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AlertDialogDescription: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AlertDialogFooter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AlertDialogCancel: ({ children }: { children: React.ReactNode }) => <button>{children}</button>,
  AlertDialogAction: ({ children }: { children: React.ReactNode }) => <button>{children}</button>,
}));

jest.mock("@/components/ui/form", () => ({
  Form: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  FormControl: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  FormField: () => null,
  FormItem: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  FormLabel: ({ children }: { children: React.ReactNode }) => <label>{children}</label>,
  FormMessage: () => null,
}));

jest.mock("@/components/ui/select", () => ({
  Select: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectValue: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  SelectContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectItem: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

jest.mock("@/components/ui/checkbox", () => ({ Checkbox: () => null }));
jest.mock("@/components/ui/input", () => ({ Input: () => <input /> }));
jest.mock("@/components/ui/textarea", () => ({ Textarea: () => <textarea /> }));
jest.mock("@/components/ui/skeleton", () => ({ Skeleton: () => <div>loading</div> }));
jest.mock("@/components/ui/card", () => ({
  Card: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardTitle: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardDescription: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
jest.mock("@/components/ui/badge", () => ({ Badge: ({ children }: { children: React.ReactNode }) => <span>{children}</span> }));

jest.mock("@/components/ui/sortable-list", () => ({
  SortableList: ({ items, renderItem }: { items: { id: number }[]; renderItem: (item: { id: number }, dragHandle: React.ReactNode) => React.ReactNode }) => (
    <div>
      {items.map((item) => (
        <div key={item.id}>{renderItem(item, <button type="button" aria-label="Arrastrar para reordenar" />)}</div>
      ))}
    </div>
  ),
}));

jest.mock("lucide-react", () => new Proxy({}, {
  get: (_, iconName: string) => {
    const MockIcon = () => <svg data-testid={`icon-${iconName}`} />;
    MockIcon.displayName = iconName;
    return MockIcon;
  },
}));

import { ProjectTasksTab, buildTaskPayload, TaskFormValues } from "@/components/projects/ProjectTasksTab";

describe("ProjectTasksTab", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("opens the read-only deliverable dialog from the new eye button", async () => {
    const user = userEvent.setup();

    render(
      <ProjectTasksTab
        projectId={7}
        productName="Producto"
        canEdit={false}
        currentUserId={4}
        currentUserRole={4}
      />
    );

    await user.click(screen.getByRole("button", { name: /ver detalles de subir artes finales/i }));

    expect(screen.getByText("Sin descripción")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /https:\/\/example.com\/final/ })).toHaveAttribute(
      "href",
      "https://example.com/final"
    );
    expect(screen.getByText(/entrega publicada/i)).toBeInTheDocument();
  });
});

const buildTask = (id: number, status: string) => ({
    id,
    project_id: 7,
    template_id: null,
    title: `Tarea ${id}`,
    description: null,
    area_id: null,
    area_name: null,
    assigned_user_id: 4,
    assigned_user_name: "Vale",
    assigned_user_rol_id: 4,
    assigned_user_is_internal: 1,
    status,
    task_type: "execution",
    task_flag: "new",
    adjustment_id: null,
    requires_quote: 0,
    assign_to_commercial: 0,
    order_index: id,
    created_at: "2026-04-07T00:00:00.000Z",
    updated_at: "2026-04-07T00:00:00.000Z",
    delivery_url: null,
    delivery_notes: null,
    completion_cost: null,
    progress_percent: 0,
    progress_minutes: 0,
    quoter_ids: [],
    quote_count: 0,
    pending_quote_count: 0,
  });

describe("ProjectTasksTab long lists", () => {

  afterEach(() => {
    mockTasksOverride = null;
  });

  it("stacks completed tasks with a count and loads pending tasks 4 at a time", async () => {
    const user = userEvent.setup();
    mockTasksOverride = [
      ...Array.from({ length: 12 }, (_, i) => buildTask(i + 1, "completed")),
      buildTask(13, "in_progress"),
      ...Array.from({ length: 7 }, (_, i) => buildTask(i + 14, "not_started")),
    ];

    render(
      <ProjectTasksTab projectId={7} productName="Producto" canEdit={false} currentUserId={4} currentUserRole={4} />
    );

    expect(screen.getByText("12 tareas completadas")).toBeInTheDocument();
    expect(screen.queryByText("Tarea 1")).not.toBeInTheDocument();
    for (const id of [13, 14, 15, 16, 17]) expect(screen.getByText(`Tarea ${id}`)).toBeInTheDocument();
    expect(screen.queryByText("Tarea 18")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /mostrar 3 m\u00e1s \(quedan 3\)/i }));
    for (const id of [18, 19, 20]) expect(screen.getByText(`Tarea ${id}`)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /ver menos/i })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /12 tareas completadas/i }));
    expect(screen.getByText("Tarea 1")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /apilar completadas/i })).toBeInTheDocument();
  });

  it("keeps showing every task when there are 8 or fewer", () => {
    mockTasksOverride = Array.from({ length: 8 }, (_, i) => buildTask(i + 1, i < 5 ? "completed" : "not_started"));

    render(
      <ProjectTasksTab projectId={7} productName="Producto" canEdit={false} currentUserId={4} currentUserRole={4} />
    );

    for (let id = 1; id <= 8; id++) expect(screen.getByText(`Tarea ${id}`)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /tareas completadas/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /mostrar .* m\u00e1s/i })).not.toBeInTheDocument();
  });
});

// S5: quick "Activar" button on waiting tasks for comercial, admin and directivo.
describe("ProjectTasksTab — activate a waiting task (S5)", () => {
  afterEach(() => {
    mockTasksOverride = null;
  });

  it.each([1, 2, 3])("role %i activates a waiting task with one click", async (role) => {
    const user = userEvent.setup();
    const { post } = jest.requireMock("@/lib/services/apiService") as { post: jest.Mock };
    post.mockResolvedValue({ ok: true, data: { task: {} } });
    mockTasksOverride = [buildTask(1, "in_progress"), buildTask(2, "waiting")];

    render(<ProjectTasksTab projectId={7} productName="Producto" canEdit currentUserId={1} currentUserRole={role} />);

    await user.click(screen.getByRole("button", { name: /activar tarea 2/i }));
    expect(post).toHaveBeenCalledWith("projects/7/tasks/2/activate", {});
  });

  it.each([4, 5])("role %i does not see the activate button", (role) => {
    mockTasksOverride = [buildTask(1, "in_progress"), buildTask(2, "waiting")];

    render(<ProjectTasksTab projectId={7} productName="Producto" canEdit={false} currentUserId={1} currentUserRole={role} />);

    expect(screen.getByText("Tarea 2")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /activar tarea/i })).not.toBeInTheDocument();
  });
});

describe("ProjectTasksTab — reorder completed tasks", () => {
  it("shows the drag handle on completed tasks when the user can edit", () => {
    render(
      <ProjectTasksTab projectId={7} productName="Producto" canEdit currentUserId={1} currentUserRole={1} />
    );

    expect(screen.getByText("Subir artes finales")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /arrastrar para reordenar/i })).toBeInTheDocument();
  });
});

// S7: the task cost is shown in the eye dialog only to admin, directivo and financiero.
describe("ProjectTasksTab — task cost in the eye dialog (S7)", () => {
  async function openEye(role: number) {
    const user = userEvent.setup();
    render(
      <ProjectTasksTab projectId={7} productName="Producto" canEdit={false} currentUserId={1} currentUserRole={role} />
    );
    await user.click(screen.getByRole("button", { name: /ver detalles de subir artes finales/i }));
  }

  it.each([1, 2, 5])("shows the cost to role %i", async (role) => {
    await openEye(role);
    expect(screen.getByText("Costo de la tarea")).toBeInTheDocument();
  });

  it.each([3, 4])("hides the cost from role %i", async (role) => {
    await openEye(role);
    expect(screen.getByText("Sin descripción")).toBeInTheDocument();
    expect(screen.queryByText("Costo de la tarea")).not.toBeInTheDocument();
  });
});

describe("ProjectTasksTab — load errors (S28)", () => {
  afterEach(() => {
    mockTasksError = false;
  });

  it("the tasks query throws when the API fails instead of returning []", async () => {
    const { get } = jest.requireMock("@/lib/services/apiService") as { get: jest.Mock };
    get.mockResolvedValue({ ok: false, status: 403, error: "Sin acceso" });
    render(<ProjectTasksTab projectId={7} productName="Producto" canEdit={false} currentUserRole={1} />);
    await expect(mockQueryFns["project-tasks"]()).rejects.toThrow("Sin acceso");
  });

  it("shows an error state instead of 'No hay tareas aún.'", () => {
    mockTasksError = true;
    render(<ProjectTasksTab projectId={7} productName="Producto" canEdit={false} currentUserRole={1} />);
    expect(screen.getByText("Error al cargar las tareas")).toBeInTheDocument();
    expect(screen.queryByText("No hay tareas aún.")).not.toBeInTheDocument();
  });
});

describe("buildTaskPayload", () => {
  const baseValues: TaskFormValues = {
    title: "Nueva tarea",
    description: "",
    status: "waiting", // simulates a stale/leftover form value
    task_type: "execution",
    requires_quote: false,
    quoter_ids: [],
    assign_mode: "auto",
    area_id: 3,
    assigned_user_id: null,
  };

  it("omits `status` when creating a task, so the backend computes the canonical initial status", () => {
    const payload = buildTaskPayload(baseValues, { isEditing: false, adjustmentId: 42 });

    expect(payload).not.toHaveProperty("status");
    expect(payload).toMatchObject({
      title: "Nueva tarea",
      task_type: "execution",
      requires_quote: 0,
      area_id: 3,
      assigned_user_id: null,
      assign_to_commercial: 0,
      adjustment_id: 42,
    });
  });

  it("keeps sending the user-selected `status` when editing a task", () => {
    const payload = buildTaskPayload(
      { ...baseValues, status: "in_progress" },
      { isEditing: true, adjustmentId: 42 }
    );

    expect(payload).toHaveProperty("status", "in_progress");
  });

  it("maps requires_quote/assign_mode correctly regardless of create/edit", () => {
    const commercialValues: TaskFormValues = {
      ...baseValues,
      requires_quote: true,
      assign_mode: "commercial",
      area_id: null,
      assigned_user_id: null,
    };

    const payload = buildTaskPayload(commercialValues, { isEditing: false, adjustmentId: null });

    expect(payload).toMatchObject({
      requires_quote: 1,
      assign_to_commercial: 1,
      area_id: null,
      assigned_user_id: null,
      adjustment_id: null,
    });
    expect(payload).not.toHaveProperty("status");
  });
});

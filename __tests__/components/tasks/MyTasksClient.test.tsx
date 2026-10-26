import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";

let currentSearch = "page=1";
const mockQueryFns: Record<string, () => Promise<unknown>> = {};
const mockReplace = jest.fn();

jest.mock("next/navigation", () => ({
  usePathname: () => "/my-tasks",
  useRouter: () => ({
    replace: (url: string) => {
      mockReplace(url);
      const query = url.split("?")[1] ?? "";
      currentSearch = query;
    },
  }),
  useSearchParams: () => new URLSearchParams(currentSearch),
}));

jest.mock("@tanstack/react-query", () => ({
  useQuery: ({ queryKey, queryFn }: { queryKey: unknown[]; queryFn: () => Promise<unknown> }) => {
    const key = String(queryKey[0]);
    mockQueryFns[key] = queryFn;

    if (key === "my-tasks") {
      return {
        data: {
          data: [
            {
              id: 1,
              title: "Tarea demo",
              description: "Desc",
              project_id: 10,
              project_title: "Proyecto demo",
              product_name: "Producto demo",
              brand_id: 3,
              brand_name: "Marca demo",
              creator_user_id: 1,
              creator_user_name: "Admin",
              area_id: null,
              area_name: null,
              assigned_user_id: 2,
              assigned_user_name: "Colaborador",
              assigned_user_rol_id: 4,
              status: "in_progress",
              task_flag: "new",
              task_type: "execution",
              requires_quote: 0,
              assign_to_commercial: 0,
              order_index: 1,
              adjustment_id: null,
              version_number: 1,
              assigned_at: null,
              completed_at: null,
              created_at: "2026-01-01",
              updated_at: "2026-01-01",
              delivery_url: null,
              completion_cost: null,
              progress_percent: 25,
              progress_minutes: 45,
              quoter_ids: [],
              quote_count: 0,
              pending_quote_count: 0,
            },
          ],
          pageCount: 1,
          currentPage: 1,
          total: 1,
          dailyReportTime: "18:00",
        },
        isLoading: false,
        isError: false,
      };
    }

    if (key === "brands-for-filter") {
      return {
        data: [
          { id: 3, name: "Marca demo", manager_id: 1 },
          { id: 4, name: "Marca B", manager_id: 2 },
        ],
      };
    }

    if (key === "assignable-users") {
      return {
        data: [
          { id: 1, name: "Admin", email: "a@test.com", rol_id: 1 },
          { id: 2, name: "Directivo", email: "d@test.com", rol_id: 2 },
          { id: 4, name: "Financiero", email: "f@test.com", rol_id: 5 },
          { id: 3, name: "Colab", email: "c@test.com", rol_id: 4 },
        ],
      };
    }

    return { data: undefined, isLoading: false, isError: false };
  },
  useQueryClient: () => ({
    invalidateQueries: jest.fn(),
  }),
}));

jest.mock("@/lib/services/apiService", () => ({
  get: jest.fn(),
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

jest.mock("@/components/tasks/TaskProgressReportModal", () => ({
  TaskProgressReportModal: () => null,
}));

jest.mock("@/components/ui/select", () => {
  const Select = ({ children }: { children: React.ReactNode }) => <div>{children}</div>;
  const SelectTrigger = ({ children }: { children: React.ReactNode }) => <div>{children}</div>;
  const SelectValue = ({ placeholder }: { placeholder?: string }) => <span>{placeholder}</span>;
  const SelectContent = ({ children }: { children: React.ReactNode }) => <div>{children}</div>;
  const SelectItem = ({ children }: { children: React.ReactNode }) => <div>{children}</div>;
  return { Select, SelectTrigger, SelectValue, SelectContent, SelectItem };
});

jest.mock("@/components/ui/dropdown-menu", () => {
  const DropdownMenu = ({ children }: { children: React.ReactNode }) => <div>{children}</div>;
  const DropdownMenuTrigger = ({ children }: { children: React.ReactNode }) => <div>{children}</div>;
  const DropdownMenuContent = ({ children }: { children: React.ReactNode }) => <div>{children}</div>;
  return { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent };
});

jest.mock("@/components/ui/label", () => ({
  Label: ({ children, htmlFor }: { children: React.ReactNode; htmlFor?: string }) => (
    <label htmlFor={htmlFor}>{children}</label>
  ),
}));

jest.mock("@/components/ui/button", () => ({
  Button: ({
    children,
    onClick,
    title,
    "aria-label": ariaLabel,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    title?: string;
    "aria-label"?: string;
  }) => (
    <button onClick={onClick} title={title} aria-label={ariaLabel}>
      {children}
    </button>
  ),
}));

jest.mock("@/components/ui/dialog", () => ({
  Dialog: ({ children, open }: { children: React.ReactNode; open: boolean }) =>
    open ? <div data-testid="task-details-dialog">{children}</div> : null,
  DialogContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
  DialogDescription: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

jest.mock("@/components/ui/badge", () => ({
  Badge: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
}));

jest.mock("@/components/ui/input", () => ({
  Input: ({
    value,
    onChange,
    type,
    id,
    placeholder,
  }: {
    value?: string;
    onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
    type?: string;
    id?: string;
    placeholder?: string;
  }) => <input id={id} type={type} value={value} onChange={onChange} placeholder={placeholder} />,
}));

jest.mock("@/components/ui/skeleton", () => ({
  Skeleton: () => <div>loading...</div>,
}));

jest.mock("@/components/pagination/Pagination", () => ({
  __esModule: true,
  default: () => <div>Paginación</div>,
}));

jest.mock("lucide-react", () => ({
  AlertTriangle: () => null,
  CalendarIcon: () => null,
  CalendarDays: () => null,
  CheckCircle: () => null,
  Clock: () => null,
  ExternalLink: () => null,
  Eye: () => null,
  FileText: () => null,
  History: () => null,
  Link: () => null,
  User: () => null,
  BellRing: () => null,
  ShieldCheck: () => null,
  PauseCircle: () => null,
  PlayCircle: () => null,
  Loader2: () => null,
}));

jest.mock("next/link", () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

import { MyTasksClient } from "@/components/tasks/MyTasksClient";

describe("MyTasksClient", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-04-07T19:00:00"));
    window.sessionStorage.clear();
    currentSearch = "page=1";
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  it("renders filter UI in default state", () => {
    render(<MyTasksClient />);

    expect(screen.getByText("Estado")).toBeInTheDocument();
    expect(screen.getByText("Limpiar filtros")).toBeInTheDocument();
    expect(screen.getByLabelText("Buscar")).toBeInTheDocument();
    expect(screen.getByText("Rango de asignación")).toBeInTheDocument();
    expect(screen.getByText("Reporta tu avance de hoy")).toBeInTheDocument();
    expect(screen.getByText("Financiero")).toBeInTheDocument();
  });

  it("updates URL when status filter changes", () => {
    render(<MyTasksClient />);

    const pill = screen.getByRole("button", { name: "Sin iniciar" });
    // Selected by default (not_started is part of the default statuses)
    expect(pill).not.toHaveClass("opacity-50");

    fireEvent.click(pill);
    expect(mockReplace).toHaveBeenCalledTimes(1);

    const lastCall = mockReplace.mock.calls[mockReplace.mock.calls.length - 1][0] as string;
    const params = new URLSearchParams(lastCall.split("?")[1]);
    expect(lastCall.startsWith("/my-tasks?")).toBe(true);
    expect(params.get("page")).toBe("1");
    expect(params.getAll("status").sort()).toEqual(["blocked", "in_progress", "paused", "waiting"]);
  });

  it("allows enabling completed status explicitly", () => {
    render(<MyTasksClient />);

    const pill = screen.getByRole("button", { name: "Completada" });
    // Not selected by default (completed is excluded from the default statuses)
    expect(pill).toHaveClass("opacity-50");

    fireEvent.click(pill);
    expect(mockReplace).toHaveBeenCalledTimes(1);

    const lastCall = mockReplace.mock.calls[mockReplace.mock.calls.length - 1][0] as string;
    const params = new URLSearchParams(lastCall.split("?")[1]);
    expect(params.get("page")).toBe("1");
    expect(params.getAll("status").sort()).toEqual([
      "blocked",
      "completed",
      "in_progress",
      "not_started",
      "paused",
      "waiting",
    ]);
  });

  it("double click on a status pill selects only that status", () => {
    render(<MyTasksClient />);

    fireEvent.doubleClick(screen.getByRole("button", { name: "Completada" }));

    const lastCall = mockReplace.mock.calls[mockReplace.mock.calls.length - 1][0] as string;
    const params = new URLSearchParams(lastCall.split("?")[1]);
    expect(params.get("page")).toBe("1");
    expect(params.getAll("status")).toEqual(["completed"]);
  });

  it("opens report flow with URL flag when notification CTA is clicked", () => {
    render(<MyTasksClient />);

    fireEvent.click(screen.getByText("Abrir reporte diario"));

    const lastCall = mockReplace.mock.calls[mockReplace.mock.calls.length - 1][0] as string;
    expect(lastCall).toContain("report=1");
    expect(lastCall).toContain("status=in_progress");
  });

  it("clear filters resets URL params to defaults", () => {
    currentSearch =
      "page=3&brandId=3&creatorUserId=2&assignedFrom=2026-03-01&assignedTo=2026-03-31&q=cocina&status=completed";

    render(<MyTasksClient />);

    fireEvent.click(screen.getByText("Limpiar filtros"));

    const lastCall = mockReplace.mock.calls[mockReplace.mock.calls.length - 1][0] as string;
    expect(lastCall.startsWith("/my-tasks?")).toBe(true);
    expect(lastCall).not.toContain("brandId=");
    expect(lastCall).not.toContain("creatorUserId=");
    expect(lastCall).not.toContain("assignedFrom=");
    expect(lastCall).not.toContain("assignedTo=");
    expect(lastCall).not.toContain("q=");
    expect(lastCall).not.toContain("status=");
    expect(lastCall).not.toContain("page=");
  });

  it("opens the task details dialog from the eye button of a non-completed task", () => {
    render(<MyTasksClient />);

    expect(screen.queryByTestId("task-details-dialog")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Ver detalles de Tarea demo" }));

    const dialog = screen.getByTestId("task-details-dialog");
    expect(within(dialog).getByRole("heading", { name: "Tarea demo" })).toBeInTheDocument();
    expect(within(dialog).getByText("Desc")).toBeInTheDocument();
    expect(within(dialog).queryByText("Notas de entrega")).not.toBeInTheDocument();
  });

  it("offers Pausar on the in-progress task", () => {
    render(<MyTasksClient />);

    expect(screen.getByRole("button", { name: "Pausar" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Reanudar" })).not.toBeInTheDocument();
  });

  it.each(["brands-for-filter", "assignable-users"])(
    "%s query throws when the API fails instead of returning []",
    async (key) => {
      const { get } = jest.requireMock("@/lib/services/apiService") as { get: jest.Mock };
      get.mockResolvedValue({ ok: false, status: 401, error: "No autorizado" });
      render(<MyTasksClient />);
      await expect(mockQueryFns[key]()).rejects.toThrow("No autorizado");
    }
  );
});

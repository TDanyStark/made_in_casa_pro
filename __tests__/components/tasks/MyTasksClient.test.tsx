import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";

let currentSearch = "page=1";
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
  useQuery: ({ queryKey }: { queryKey: unknown[] }) => {
    const key = String(queryKey[0]);

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

jest.mock("@/components/ui/checkbox", () => ({
  Checkbox: ({
    id,
    checked,
    onCheckedChange,
  }: {
    id: string;
    checked?: boolean;
    onCheckedChange?: (v: boolean) => void;
  }) => (
    <input
      id={id}
      data-testid={id}
      type="checkbox"
      checked={checked}
      onChange={(e) => onCheckedChange?.(e.target.checked)}
    />
  ),
}));

jest.mock("@/components/ui/label", () => ({
  Label: ({ children, htmlFor }: { children: React.ReactNode; htmlFor?: string }) => (
    <label htmlFor={htmlFor}>{children}</label>
  ),
}));

jest.mock("@/components/ui/button", () => ({
  Button: ({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) => (
    <button onClick={onClick}>{children}</button>
  ),
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
  History: () => null,
  BellRing: () => null,
  ShieldCheck: () => null,
}));

jest.mock("next/link", () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

const { MyTasksClient } = require("@/components/tasks/MyTasksClient");

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
  });

  it("updates URL when status filter changes", () => {
    render(<MyTasksClient />);

    const checkbox = screen.getByTestId("my-task-status-not_started") as HTMLInputElement;
    expect(checkbox.checked).toBe(true);

    fireEvent.click(checkbox);
    expect(mockReplace).toHaveBeenCalled();

    const lastCall = mockReplace.mock.calls[mockReplace.mock.calls.length - 1][0] as string;
    expect(lastCall).toContain("page=1");
    expect(lastCall).toContain("status=in_progress");
  });

  it("allows enabling completed status explicitly", () => {
    render(<MyTasksClient />);

    const checkbox = screen.getByTestId("my-task-status-completed") as HTMLInputElement;
    expect(checkbox.checked).toBe(false);

    fireEvent.click(checkbox);
    expect(mockReplace).toHaveBeenCalled();

    const lastCall = mockReplace.mock.calls[mockReplace.mock.calls.length - 1][0] as string;
    expect(lastCall).toContain("status=completed");
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
});

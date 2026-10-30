import React from "react";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { TasksCommandCenterClient } from "@/components/tasks/TasksCommandCenterClient";
import { UserRole } from "@/lib/definitions";

const mockReplace = jest.fn();
const mockGet = jest.fn();
const mockPatch = jest.fn();
const mockQueryFns: Record<string, () => Promise<unknown>> = {};
const baseRow = {
  id: 1,
  title: "Tarea demo",
  project_id: 10,
  project_title: "Proyecto demo",
  product_name: "Producto demo",
  assigned_user_id: null,
  assigned_user_name: null,
  assigned_user_is_internal: null,
  task_flag: "new",
  task_type: "execution",
  status: "not_started",
  requires_quote: 0,
  assigned_at: null,
  completed_at: null,
};
let mockRows: Array<Record<string, unknown>> = [baseRow];

jest.mock("lucide-react", () => new Proxy({}, {
  get: (_, iconName: string) => {
    const MockIcon = () => <svg data-testid={`icon-${iconName}`} />;
    MockIcon.displayName = iconName;
    return MockIcon;
  },
}));

jest.mock("next/navigation", () => ({
  usePathname: () => "/tasks",
  useRouter: () => ({ replace: mockReplace }),
  useSearchParams: () => new URLSearchParams("page=1"),
}));

jest.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({ invalidateQueries: jest.fn() }),
  useMutation: ({
    mutationFn,
    onSuccess,
    onError,
  }: {
    mutationFn: (vars: unknown) => Promise<unknown>;
    onSuccess?: () => void;
    onError?: (err: Error) => void;
  }) => ({
    mutate: (vars: unknown) =>
      mutationFn(vars).then(() => onSuccess?.(), (err: Error) => onError?.(err)),
    isPending: false,
  }),
  useQuery: ({ queryKey, queryFn }: { queryKey: unknown[]; queryFn: () => Promise<unknown> }) => {
    const key = String(queryKey[0]);
    mockQueryFns[key] = queryFn;
    if (key === "tasks-command-center") {
      return {
        data: {
          data: mockRows,
          pageCount: 1,
          currentPage: 1,
          total: 1,
        },
        isLoading: false,
        isError: false,
      };
    }

    if (key === "areas-with-internals") {
      return { data: [{ id: 2, name: "Diseño" }] };
    }

    if (key === "assignable-users") {
      return {
        data: [
          { id: 1, name: "Admin Uno", email: "admin@test.com", rol_id: 1 },
          { id: 2, name: "Directivo Dos", email: "directivo@test.com", rol_id: 2 },
          { id: 3, name: "Financiero Tres", email: "financiero@test.com", rol_id: 5 },
          { id: 7, name: "Colaborador", email: "colab@test.com", rol_id: 4 },
        ],
      };
    }

    return { data: undefined, isLoading: false, isError: false };
  },
}));

jest.mock("@/lib/services/apiService", () => ({
  get: (...args: unknown[]) => mockGet(...args),
  patch: (...args: unknown[]) => mockPatch(...args),
}));

jest.mock("@/components/ui/dropdown-menu", () => {
  const Pass = ({ children }: { children?: React.ReactNode }) => <div>{children}</div>;
  return {
    DropdownMenu: Pass,
    DropdownMenuTrigger: Pass,
    DropdownMenuContent: Pass,
    DropdownMenuLabel: Pass,
    DropdownMenuSeparator: () => <hr />,
    DropdownMenuSub: Pass,
    DropdownMenuSubTrigger: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
    DropdownMenuSubContent: Pass,
    DropdownMenuItem: ({
      children,
      onSelect,
      asChild,
    }: {
      children?: React.ReactNode;
      onSelect?: () => void;
      asChild?: boolean;
    }) =>
      asChild ? (
        <div role="menuitem">{children}</div>
      ) : (
        <div role="menuitem" onClick={() => onSelect?.()}>
          {children}
        </div>
      ),
  };
});

jest.mock("@/components/ui/popover", () => ({
  Popover: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  PopoverTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  PopoverContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

jest.mock("@/components/ui/switch", () => ({
  Switch: ({ checked, onCheckedChange, id }: { checked?: boolean; onCheckedChange?: (v: boolean) => void; id?: string }) => (
    <input id={id} type="checkbox" checked={checked} onChange={(e) => onCheckedChange?.(e.target.checked)} />
  ),
}));

jest.mock("@/components/ui/searchable-select", () => ({
  SearchableSelect: ({
    placeholder,
    options,
  }: {
    placeholder?: string;
    options: Array<{ value: string; label: string }>;
  }) => (
    <div data-testid={`searchable-select-${placeholder}`}>
      <span>{placeholder}</span>
      {options.map((option) => (
        <span key={option.value}>{option.label}</span>
      ))}
    </div>
  ),
}));

jest.mock("sonner", () => ({
  toast: { success: jest.fn(), error: jest.fn() },
}));

jest.mock("@/components/ui/select", () => {
  const Select = ({ children }: { children: React.ReactNode }) => <div>{children}</div>;
  const SelectTrigger = ({ children }: { children: React.ReactNode }) => <div>{children}</div>;
  const SelectValue = ({ placeholder }: { placeholder?: string }) => <span>{placeholder}</span>;
  const SelectContent = ({ children }: { children: React.ReactNode }) => <div>{children}</div>;
  const SelectItem = ({ children }: { children: React.ReactNode }) => <div>{children}</div>;
  return { Select, SelectTrigger, SelectValue, SelectContent, SelectItem };
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
    "aria-label": ariaLabel,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    "aria-label"?: string;
  }) => (
    <button onClick={onClick} aria-label={ariaLabel}>
      {children}
    </button>
  ),
}));

jest.mock("@/components/ui/table", () => ({
  Table: ({ children }: { children: React.ReactNode }) => <table>{children}</table>,
  TableHeader: ({ children }: { children: React.ReactNode }) => <thead>{children}</thead>,
  TableBody: ({ children }: { children: React.ReactNode }) => <tbody>{children}</tbody>,
  TableRow: ({ children }: { children: React.ReactNode }) => <tr>{children}</tr>,
  TableHead: ({ children }: { children?: React.ReactNode }) => <th>{children}</th>,
  TableCell: ({ children, colSpan }: { children: React.ReactNode; colSpan?: number }) => (
    <td colSpan={colSpan}>{children}</td>
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
  }: {
    value?: string;
    onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
    type?: string;
    id?: string;
  }) => <input id={id} type={type} value={value} onChange={onChange} />,
}));

jest.mock("@/components/ui/skeleton", () => ({
  Skeleton: () => <div>loading...</div>,
}));

jest.mock("@/components/pagination/Pagination", () => ({
  __esModule: true,
  default: () => <div>Paginación</div>,
}));

jest.mock("@/components/tasks/TaskDeliverableDialog", () => ({
  TaskDeliverableDialog: ({ showCost, canEditCost }: { showCost?: boolean; canEditCost?: boolean }) => (
    <div
      data-testid="deliverable-dialog"
      data-show-cost={String(Boolean(showCost))}
      data-can-edit-cost={String(Boolean(canEditCost))}
    />
  ),
}));

describe("TasksCommandCenterClient", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRows = [baseRow];
  });

  it("renders main columns and one row", () => {
    render(<TasksCommandCenterClient userRole={1 as UserRole} />);

    expect(screen.getByText("Tarea")).toBeInTheDocument();
    expect(screen.getByText("Proyecto demo")).toBeInTheDocument();
    expect(screen.getByText("Producto demo")).toBeInTheDocument();
    // Creator filter only lists CREATOR_FILTER_ROLES (admin, directivo, financiero, comercial)
    const creatorSelect = within(screen.getByTestId("searchable-select-Usuario creador"));
    expect(creatorSelect.getByText("Usuario creador: todos")).toBeInTheDocument();
    expect(creatorSelect.getByText("Admin Uno")).toBeInTheDocument();
    expect(creatorSelect.getByText("Directivo Dos")).toBeInTheDocument();
    expect(creatorSelect.getByText("Financiero Tres")).toBeInTheDocument();
    expect(creatorSelect.queryByText("Colaborador")).not.toBeInTheDocument();
  });

  it("renders explicit date labels", () => {
    render(<TasksCommandCenterClient userRole={1 as UserRole} />);

    expect(screen.getByLabelText("Asignada desde")).toBeInTheDocument();
    expect(screen.getByLabelText("Asignada hasta")).toBeInTheDocument();
    expect(screen.getByLabelText("Completada desde")).toBeInTheDocument();
    expect(screen.getByLabelText("Completada hasta")).toBeInTheDocument();
  });

  it("shows status pills selected by default and updates URL when toggled", () => {
    render(<TasksCommandCenterClient userRole={1 as UserRole} />);

    const statusCompleted = screen.getByRole("button", { name: "Completada" });
    expect(statusCompleted).not.toHaveClass("opacity-50");
    expect(screen.getByRole("button", { name: "Todos" })).not.toHaveClass("opacity-50");

    fireEvent.click(statusCompleted);
    expect(mockReplace).toHaveBeenCalledTimes(1);

    const url = mockReplace.mock.calls[0][0] as string;
    expect(url.startsWith("/tasks?")).toBe(true);
    const params = new URLSearchParams(url.split("?")[1]);
    expect(params.get("page")).toBe("1");
    expect(params.getAll("status").sort()).toEqual(["blocked", "in_progress", "not_started", "paused", "waiting"]);
  });

  it("double click on a status pill selects only that status", () => {
    render(<TasksCommandCenterClient userRole={1 as UserRole} />);

    fireEvent.doubleClick(screen.getByRole("button", { name: "Bloqueada" }));

    const url = mockReplace.mock.calls[mockReplace.mock.calls.length - 1][0] as string;
    const params = new URLSearchParams(url.split("?")[1]);
    expect(params.get("page")).toBe("1");
    expect(params.getAll("status")).toEqual(["blocked"]);
  });

  // S7: the eye dialog shows the task cost only to admin, directivo and financiero.
  it.each([
    [UserRole.ADMIN, "true"],
    [UserRole.DIRECTIVO, "true"],
    [UserRole.FINANCIERO, "true"],
    [UserRole.COMERCIAL, "false"],
  ])("passes showCost to the deliverable dialog for role %i -> %s", (role, expected) => {
    render(<TasksCommandCenterClient userRole={role} />);

    expect(screen.getByTestId("deliverable-dialog")).toHaveAttribute("data-show-cost", expected);
  });

  // S15: only admin and directivo may correct a task cost from the eye dialog.
  it.each([
    [UserRole.ADMIN, "true"],
    [UserRole.DIRECTIVO, "true"],
    [UserRole.FINANCIERO, "false"],
    [UserRole.COMERCIAL, "false"],
  ])("passes canEditCost to the deliverable dialog for role %i -> %s", (role, expected) => {
    render(<TasksCommandCenterClient userRole={role} />);

    expect(screen.getByTestId("deliverable-dialog")).toHaveAttribute("data-can-edit-cost", expected);
  });

  // Inline status change: a waiting task can go back to "Sin iniciar" from the table.
  it("changes the status of a waiting task to 'Sin iniciar' with PATCH", async () => {
    mockRows = [{ ...baseRow, status: "waiting" }];
    mockPatch.mockResolvedValue({ ok: true, data: {} });
    const { toast } = jest.requireMock("sonner");
    render(<TasksCommandCenterClient userRole={UserRole.ADMIN} />);

    const statusMenu = within(screen.getByTestId("status-menu-1"));
    fireEvent.click(statusMenu.getByRole("menuitem", { name: "Sin iniciar" }));

    expect(mockPatch).toHaveBeenCalledWith("projects/10/tasks/1", { status: "not_started" });
    await screen.findByText("Tarea demo");
    expect(toast.success).toHaveBeenCalledWith("Estado actualizado");
  });

  it("toasts the API error when the status change fails", async () => {
    mockRows = [{ ...baseRow, status: "waiting" }];
    mockPatch.mockResolvedValue({ ok: false, error: "Sin permiso" });
    const { toast } = jest.requireMock("sonner");
    render(<TasksCommandCenterClient userRole={UserRole.ADMIN} />);

    fireEvent.click(within(screen.getByTestId("status-menu-1")).getByRole("menuitem", { name: "Sin iniciar" }));

    await new Promise((r) => setTimeout(r, 0));
    expect(toast.error).toHaveBeenCalledWith("Sin permiso");
  });

  it("offers every status except the current one and 'Completada'; 'Pausada' only from 'En progreso'", () => {
    mockRows = [
      { ...baseRow, id: 1, status: "waiting" },
      { ...baseRow, id: 2, status: "in_progress" },
    ];
    render(<TasksCommandCenterClient userRole={UserRole.ADMIN} />);

    const waitingOptions = within(screen.getByTestId("status-menu-1"))
      .getAllByRole("menuitem")
      .map((el) => el.textContent);
    expect(waitingOptions).toEqual(["Sin iniciar", "En progreso", "Bloqueada"]);

    const inProgressOptions = within(screen.getByTestId("status-menu-2"))
      .getAllByRole("menuitem")
      .map((el) => el.textContent);
    expect(inProgressOptions).toEqual(["Sin iniciar", "En espera", "Pausada", "Bloqueada"]);
  });

  it("does not let a completed task change its status inline", () => {
    mockRows = [{ ...baseRow, status: "completed" }];
    render(<TasksCommandCenterClient userRole={UserRole.ADMIN} />);

    expect(screen.queryByTestId("status-menu-1")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Cambiar estado/ })).not.toBeInTheDocument();
  });

  it("shows a row options menu with status, collaborator, deliverable and project actions", () => {
    mockRows = [{ ...baseRow, status: "completed" }];
    render(<TasksCommandCenterClient userRole={UserRole.ADMIN} />);

    expect(screen.getByRole("button", { name: "Opciones de la tarea Tarea demo" })).toBeInTheDocument();
    const menu = within(screen.getByTestId("row-actions-1"));
    expect(menu.getByRole("menuitem", { name: "Cambiar colaborador" })).toBeInTheDocument();
    expect(menu.getByRole("menuitem", { name: "Ver entregable" })).toBeInTheDocument();
    expect(menu.getByRole("menuitem", { name: "Ir al proyecto" })).toBeInTheDocument();
    // Completed: no status submenu
    expect(menu.queryByText("Cambiar estado")).not.toBeInTheDocument();
  });

  it("the options menu changes the status through its submenu", () => {
    mockRows = [{ ...baseRow, status: "waiting" }];
    mockPatch.mockResolvedValue({ ok: true, data: {} });
    render(<TasksCommandCenterClient userRole={UserRole.ADMIN} />);

    const menu = within(screen.getByTestId("row-actions-1"));
    expect(menu.getByText("Cambiar estado")).toBeInTheDocument();
    fireEvent.click(menu.getByRole("menuitem", { name: "Sin iniciar" }));

    expect(mockPatch).toHaveBeenCalledWith("projects/10/tasks/1", { status: "not_started" });
  });

  it("marks the editable columns for roles that can edit", () => {
    render(<TasksCommandCenterClient userRole={UserRole.ADMIN} />);

    expect(screen.getAllByTitle("Campo editable: haz clic en el valor para cambiarlo")).toHaveLength(2);
    expect(screen.getByRole("button", { name: "Cambiar responsable" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cambiar estado (Sin iniciar)" })).toBeInTheDocument();
  });

  it("shows no edit indicators nor edit actions for a comercial", () => {
    render(<TasksCommandCenterClient userRole={UserRole.COMERCIAL} />);

    expect(screen.queryAllByTitle("Campo editable: haz clic en el valor para cambiarlo")).toHaveLength(0);
    expect(screen.queryByRole("button", { name: "Cambiar responsable" })).not.toBeInTheDocument();
    expect(screen.queryByTestId("status-menu-1")).not.toBeInTheDocument();
    const menu = within(screen.getByTestId("row-actions-1"));
    expect(menu.queryByRole("menuitem", { name: "Cambiar colaborador" })).not.toBeInTheDocument();
    expect(menu.getByRole("menuitem", { name: "Ir al proyecto" })).toBeInTheDocument();
  });

  it.each(["areas-with-internals", "assignable-users"])(
    "%s query throws when the API fails instead of returning []",
    async (key) => {
      mockGet.mockResolvedValue({ ok: false, status: 500, error: "Error interno" });
      render(<TasksCommandCenterClient userRole={1 as UserRole} />);
      await expect(mockQueryFns[key]()).rejects.toThrow("Error interno");
    }
  );
});

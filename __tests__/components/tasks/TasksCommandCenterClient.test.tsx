import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { TasksCommandCenterClient } from "@/components/tasks/TasksCommandCenterClient";

const mockReplace = jest.fn();
const mockGet = jest.fn();

jest.mock("next/navigation", () => ({
  usePathname: () => "/tasks",
  useRouter: () => ({ replace: mockReplace }),
  useSearchParams: () => new URLSearchParams("page=1"),
}));

jest.mock("@tanstack/react-query", () => ({
  useQuery: ({ queryKey }: { queryKey: unknown[] }) => {
    const key = String(queryKey[0]);
    if (key === "tasks-command-center") {
      return {
        data: {
          data: [
            {
              id: 1,
              title: "Tarea demo",
              project_id: 10,
              project_title: "Proyecto demo",
              product_name: "Producto demo",
              assigned_user_id: null,
              assigned_user_name: null,
              task_flag: "new",
              task_type: "execution",
              status: "not_started",
              assigned_at: null,
              completed_at: null,
            },
          ],
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
}));

jest.mock("@/components/ui/select", () => {
  const Select = ({ children }: { children: React.ReactNode }) => <div>{children}</div>;
  const SelectTrigger = ({ children }: { children: React.ReactNode }) => <div>{children}</div>;
  const SelectValue = ({ placeholder }: { placeholder?: string }) => <span>{placeholder}</span>;
  const SelectContent = ({ children }: { children: React.ReactNode }) => <div>{children}</div>;
  const SelectItem = ({ children }: { children: React.ReactNode }) => <div>{children}</div>;
  return { Select, SelectTrigger, SelectValue, SelectContent, SelectItem };
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

jest.mock("@/components/ui/table", () => ({
  Table: ({ children }: { children: React.ReactNode }) => <table>{children}</table>,
  TableHeader: ({ children }: { children: React.ReactNode }) => <thead>{children}</thead>,
  TableBody: ({ children }: { children: React.ReactNode }) => <tbody>{children}</tbody>,
  TableRow: ({ children }: { children: React.ReactNode }) => <tr>{children}</tr>,
  TableHead: ({ children }: { children: React.ReactNode }) => <th>{children}</th>,
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

describe("TasksCommandCenterClient", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders main columns and one row", () => {
    render(<TasksCommandCenterClient />);

    expect(screen.getByText("Tarea")).toBeInTheDocument();
    expect(screen.getByText("Proyecto demo")).toBeInTheDocument();
    expect(screen.getByText("Producto demo")).toBeInTheDocument();
    expect(screen.getAllByText("Financiero Tres").length).toBeGreaterThan(0);
  });

  it("renders explicit date labels", () => {
    render(<TasksCommandCenterClient />);

    expect(screen.getByLabelText("Asignada desde")).toBeInTheDocument();
    expect(screen.getByLabelText("Asignada hasta")).toBeInTheDocument();
    expect(screen.getByLabelText("Completada desde")).toBeInTheDocument();
    expect(screen.getByLabelText("Completada hasta")).toBeInTheDocument();
  });

  it("shows status checkboxes selected by default and updates URL when toggled", () => {
    render(<TasksCommandCenterClient />);

    const statusCompleted = screen.getByTestId("status-completed") as HTMLInputElement;
    expect(statusCompleted.checked).toBe(true);

    fireEvent.click(statusCompleted);
    expect(mockReplace).toHaveBeenCalled();
  });
});

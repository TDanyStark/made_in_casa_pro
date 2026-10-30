import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { ListProjectsClient } from "@/components/projects/ListProjectsClient";
import { UserRole } from "@/lib/definitions";

const mockReplace = jest.fn();
const mockGet = jest.fn();
const mockQueryFns: Record<string, () => Promise<unknown>> = {};
let mockSearch = "page=1";
let mockProjects: Array<Record<string, unknown>> = [];

type AsyncSelectProps = {
  endpoint: string;
  params?: Record<string, string | undefined>;
  getLabel: (row: never) => string;
  value: string;
  onValueChange: (value: string) => void;
  allOption: { value: string; label: string };
  selectedLabel?: string;
  fetchSelectedLabel?: (value: string) => Promise<string | undefined>;
  placeholder?: string;
};
const mockAsyncSelects: Record<string, AsyncSelectProps> = {};

jest.mock("lucide-react", () => new Proxy({}, {
  get: (_, iconName: string) => {
    const MockIcon = () => <svg data-testid={`icon-${iconName}`} />;
    MockIcon.displayName = iconName;
    return MockIcon;
  },
}));

jest.mock("next/navigation", () => ({
  usePathname: () => "/projects",
  useRouter: () => ({ replace: mockReplace }),
  useSearchParams: () => new URLSearchParams(mockSearch),
}));

jest.mock("next/link", () => ({
  __esModule: true,
  default: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a>,
}));

jest.mock("@/lib/services/apiService", () => ({
  get: (...args: unknown[]) => mockGet(...args),
}));

jest.mock("@/components/search/search", () => ({
  __esModule: true,
  default: ({ placeholder }: { placeholder?: string }) => <input placeholder={placeholder} />,
}));

jest.mock("@/components/pagination/Pagination", () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock("@/components/projects/ProjectCard", () => ({
  ProjectCard: ({ project }: { project: { title: string } }) => <div>{project.title}</div>,
}));

jest.mock("@/components/ui/select", () => {
  const Pass = ({ children }: { children?: React.ReactNode }) => <div>{children}</div>;
  const SelectValue = ({ placeholder }: { placeholder?: string }) => <span>{placeholder}</span>;
  return { Select: Pass, SelectTrigger: Pass, SelectValue, SelectContent: Pass, SelectItem: Pass };
});

jest.mock("@/components/ui/searchable-select", () => ({
  SearchableSelect: ({
    placeholder,
    value,
    options,
    onValueChange,
  }: {
    placeholder?: string;
    value: string;
    options: Array<{ value: string; label: string; group?: string }>;
    onValueChange: (value: string) => void;
  }) => (
    <select aria-label={placeholder} value={value} onChange={(e) => onValueChange(e.target.value)}>
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.group ? `${option.group}: ${option.label}` : option.label}
        </option>
      ))}
    </select>
  ),
}));

jest.mock("@/components/ui/async-searchable-select", () => ({
  AsyncSearchableSelect: (props: AsyncSelectProps) => {
    mockAsyncSelects[props.placeholder ?? ""] = props;
    const { placeholder, value, allOption, selectedLabel, onValueChange } = props;
    return (
      <select aria-label={placeholder} value={value} onChange={(e) => onValueChange(e.target.value)}>
        <option value={allOption.value}>{allOption.label}</option>
        {value !== allOption.value && <option value={value}>{selectedLabel ?? ""}</option>}
      </select>
    );
  },
}));

const LISTS: Record<string, unknown> = {
  "project-filter-creators": [
    { id: 1, name: "Admin Uno", rol_id: UserRole.ADMIN },
    { id: 5, name: "Fina", rol_id: UserRole.FINANCIERO },
    { id: 9, name: "Comercial Uno", rol_id: UserRole.COMERCIAL },
  ],
};

jest.mock("@tanstack/react-query", () => ({
  useQuery: ({ queryKey, queryFn, enabled }: { queryKey: unknown[]; queryFn: () => Promise<unknown>; enabled?: boolean }) => {
    const key = String(queryKey[0]);
    mockQueryFns[key] = queryFn;
    if (key === "projects") {
      return {
        data: { data: mockProjects, pageCount: 1, currentPage: 1, total: mockProjects.length },
        isLoading: false,
        isError: false,
      };
    }
    if (enabled === false) return { data: undefined, isError: false };
    return { data: LISTS[key], isError: false };
  },
}));

describe("ListProjectsClient filters", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSearch = "page=1";
    mockProjects = [{ id: 1, title: "Proyecto demo", client_name: "Cliente A", manager_name: "Gerente A" }];
    Object.keys(mockAsyncSelects).forEach((key) => delete mockAsyncSelects[key]);
    mockGet.mockResolvedValue({ ok: true, data: { data: [] } });
  });

  it("shows client, brand, manager and creator filters when the role can filter by creator", () => {
    render(<ListProjectsClient canCreate={false} canFilterByCreator />);

    expect(screen.getByLabelText("Cliente")).toBeInTheDocument();
    expect(screen.getByLabelText("Marca")).toBeInTheDocument();
    expect(screen.getByLabelText("Gerente")).toBeInTheDocument();
    const creator = screen.getByLabelText("Creado por");
    const labels = Array.from(creator.querySelectorAll("option")).map((o) => o.textContent);
    expect(labels).toEqual(["Creado por: todos", "Comerciales: Comercial Uno", "Admins: Admin Uno"]);
  });

  it("hides the creator filter and never sends created_by when the role cannot filter by creator", async () => {
    mockSearch = "page=1&created_by=1";
    render(<ListProjectsClient canCreate={false} canFilterByCreator={false} />);

    expect(screen.queryByLabelText("Creado por")).not.toBeInTheDocument();
    expect(mockQueryFns["project-filter-creators"]).toBeDefined();
    await mockQueryFns["projects"]();
    expect(mockGet).toHaveBeenCalledWith("projects?page=1&limit=10");
  });

  it("sends every active filter to the projects API", async () => {
    mockSearch = "page=2&search=abc&status=active&client_id=4&brand_id=3&manager_id=6&created_by=9";
    render(<ListProjectsClient canCreate={false} canFilterByCreator />);

    await mockQueryFns["projects"]();
    expect(mockGet).toHaveBeenCalledWith(
      "projects?page=2&limit=10&search=abc&status=active&client_id=4&brand_id=3&manager_id=6&created_by=9"
    );
  });

  it("searches clients, brands and managers server-side, scoping brand and manager to the client", () => {
    mockSearch = "client_id=4";
    render(<ListProjectsClient canCreate={false} canFilterByCreator />);

    const { Cliente: client, Marca: brand, Gerente: manager } = mockAsyncSelects;
    expect(client.endpoint).toBe("clients");
    expect(client.params).toBeUndefined();
    expect(brand.endpoint).toBe("brands");
    expect(brand.params).toEqual({ client_id: "4" });
    expect(manager.endpoint).toBe("managers");
    expect(manager.params).toEqual({ client_id: "4" });
    expect(mockQueryFns["project-filter-clients"]).toBeUndefined();
    expect(mockQueryFns["project-filter-brands"]).toBeUndefined();
    expect(mockQueryFns["project-filter-managers"]).toBeUndefined();
  });

  it("does not scope brand and manager when no client is selected", () => {
    render(<ListProjectsClient canCreate={false} canFilterByCreator />);

    expect(mockAsyncSelects.Marca.params).toEqual({ client_id: undefined });
    expect(mockAsyncSelects.Gerente.params).toEqual({ client_id: undefined });
  });

  it("labels options with the real API shapes (brand rows use brand_name)", () => {
    render(<ListProjectsClient canCreate={false} canFilterByCreator />);

    const label = (name: string, row: Record<string, unknown>) =>
      (mockAsyncSelects[name].getLabel as (r: Record<string, unknown>) => string)(row);
    expect(label("Marca", { id: 3, brand_name: "Marca A", manager_name: "Gerente A" })).toBe("Marca A");
    expect(label("Cliente", { id: 4, name: "Cliente A" })).toBe("Cliente A");
    expect(label("Gerente", { id: 6, name: "Gerente A" })).toBe("Gerente A");
    expect(mockAsyncSelects.Marca.allOption).toEqual({ value: "all", label: "Marca: todas" });
  });

  it("resolves a brand id from the URL with GET brands?id=", async () => {
    mockSearch = "brand_id=3";
    mockGet.mockResolvedValue({ ok: true, data: { id: 3, name: "Marca A" } });
    render(<ListProjectsClient canCreate={false} canFilterByCreator />);

    expect(mockAsyncSelects.Marca.value).toBe("3");
    await expect(mockAsyncSelects.Marca.fetchSelectedLabel!("3")).resolves.toBe("Marca A");
    expect(mockGet).toHaveBeenCalledWith("brands?id=3");
  });

  it("derives client and manager labels from the filtered project rows", () => {
    mockSearch = "client_id=4&manager_id=6";
    render(<ListProjectsClient canCreate={false} canFilterByCreator />);

    expect(mockAsyncSelects.Cliente.selectedLabel).toBe("Cliente A");
    expect(mockAsyncSelects.Gerente.selectedLabel).toBe("Gerente A");
  });

  it("uses a neutral label for client and manager when there are no rows", () => {
    mockSearch = "client_id=4&manager_id=6";
    mockProjects = [];
    render(<ListProjectsClient canCreate={false} canFilterByCreator />);

    expect(mockAsyncSelects.Cliente.selectedLabel).toBe("Cliente seleccionado");
    expect(mockAsyncSelects.Gerente.selectedLabel).toBe("Gerente seleccionado");
  });

  it("sets the brand filter and goes back to page 1", () => {
    mockSearch = "page=3";
    render(<ListProjectsClient canCreate={false} canFilterByCreator />);

    mockAsyncSelects.Marca.onValueChange("3");
    expect(mockReplace).toHaveBeenCalledWith("/projects?page=1&brand_id=3");
  });

  it("clears brand and manager when the client changes and resets to page 1", () => {
    mockSearch = "page=3&client_id=4&brand_id=3&manager_id=6&status=active";
    render(<ListProjectsClient canCreate={false} canFilterByCreator />);

    fireEvent.change(screen.getByLabelText("Cliente"), { target: { value: "all" } });
    expect(mockReplace).toHaveBeenCalledWith("/projects?page=1&status=active");
  });

  it("sets a single filter and goes back to page 1", () => {
    mockSearch = "page=3";
    render(<ListProjectsClient canCreate={false} canFilterByCreator />);

    fireEvent.change(screen.getByLabelText("Creado por"), { target: { value: "9" } });
    expect(mockReplace).toHaveBeenCalledWith("/projects?page=1&created_by=9");
  });

  it("clears every filter with the clear button", () => {
    mockSearch = "page=3&search=abc&status=active&client_id=4&brand_id=3&manager_id=6&created_by=9";
    render(<ListProjectsClient canCreate={false} canFilterByCreator />);

    fireEvent.click(screen.getByRole("button", { name: "Limpiar filtros" }));
    expect(mockReplace).toHaveBeenCalledWith("/projects?");
  });

  it("hides the clear button when no filter is active", () => {
    render(<ListProjectsClient canCreate={false} canFilterByCreator />);
    expect(screen.queryByRole("button", { name: "Limpiar filtros" })).not.toBeInTheDocument();
  });
});

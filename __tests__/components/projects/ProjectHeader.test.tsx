import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ProjectHeader } from "@/components/projects/ProjectHeader";
import { ProjectDetailType } from "@/lib/definitions";

const mockPatch = jest.fn();
const mockPost = jest.fn();
const mockSetQueryData = jest.fn();
const mockInvalidateQueries = jest.fn();
const mockToastSuccess = jest.fn();
const mockToastError = jest.fn();

jest.mock("lucide-react", () => new Proxy({}, {
  get: (_, iconName: string) => {
    const MockIcon = () => <svg data-testid={`icon-${iconName}`} />;
    MockIcon.displayName = iconName;
    return MockIcon;
  },
}));

jest.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({
    setQueryData: (...args: unknown[]) => mockSetQueryData(...args),
    invalidateQueries: (...args: unknown[]) => mockInvalidateQueries(...args),
  }),
}));

jest.mock("@/lib/services/apiService", () => ({
  patch: (...args: unknown[]) => mockPatch(...args),
  post: (...args: unknown[]) => mockPost(...args),
}));

jest.mock("sonner", () => ({
  toast: {
    success: (...args: unknown[]) => mockToastSuccess(...args),
    error: (...args: unknown[]) => mockToastError(...args),
  },
}));

jest.mock("@/components/input/EditableText", () => ({
  __esModule: true,
  default: ({ value }: { value: string }) => <span>{value}</span>,
}));

jest.mock("@/components/projects/ProjectProgressBar", () => ({
  ProjectProgressBar: ({ progress }: { progress: number }) => <div>Progress {progress}</div>,
}));

jest.mock("@/components/ui/select", () => ({
  Select: ({ children, onValueChange }: { children: React.ReactNode; onValueChange: (value: string) => void }) => (
    <div>
      <button onClick={() => onValueChange("in_adjustments")}>set in adjustments</button>
      <button onClick={() => onValueChange("completed")}>set completed</button>
      {children}
    </div>
  ),
  SelectTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectValue: () => <span />,
  SelectContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectItem: ({ children, value, disabled }: { children: React.ReactNode; value: string; disabled?: boolean }) => (
    <div data-testid={`status-option-${value}`} data-disabled={disabled ? "true" : "false"}>{children}</div>
  ),
}));

const project: ProjectDetailType = {
  id: 6,
  title: "Proyecto Seis",
  brand_id: 1,
  brand_name: "Marca",
  manager_id: 2,
  manager_name: "Ana",
  client_id: 3,
  client_name: "Cliente",
  campaign_id: null,
  campaign_name: null,
  product_id: 4,
  product_name: "Producto",
  product_category_name: null,
  drive_folder_id: null,
  drive_folder_url: null,
  notes: null,
  ideal_delivery_at: null,
  oc: null,
  billing_closed_at: null,
  status: "active",
  progress: 100,
  created_by: 1,
  created_by_name: "Laura",
  created_at: "2026-04-01T00:00:00.000Z",
  updated_at: "2026-04-01T00:00:00.000Z",
  completed_at: undefined,
  co_managers: [],
};

describe("ProjectHeader", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("does not ask for manual completion at 100 percent", () => {
    render(<ProjectHeader project={project} />);
    expect(screen.queryByRole("button", { name: /Completar/ })).not.toBeInTheDocument();
  });

  it("persists in-adjustments status changes from the selector", async () => {
    const user = userEvent.setup();
    mockPatch.mockResolvedValue({ ok: true, data: { id: 6, status: "in_adjustments" } });

    render(<ProjectHeader project={project} />);

    await user.click(screen.getByRole("button", { name: "set in adjustments" }));

    await waitFor(() => {
      expect(mockPatch).toHaveBeenCalledWith("projects/6", { status: "in_adjustments" });
    });

    expect(mockSetQueryData).toHaveBeenCalledWith(["project", 6], expect.any(Function));
    expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ["project-adjustments", 6] });
    expect(mockPost).not.toHaveBeenCalled();
  });

  it("offers the Completado option enabled", () => {
    render(<ProjectHeader project={{ ...project, status: "in_adjustments" }} />);
    expect(screen.getByTestId("status-option-completed")).toHaveAttribute("data-disabled", "false");
    expect(screen.getByTestId("status-option-completed")).toHaveTextContent("Completado");
  });

  it("completes through the dedicated endpoint and refreshes project, versions and list", async () => {
    const user = userEvent.setup();
    mockPost.mockResolvedValue({ ok: true, status: 200, data: { success: true } });

    render(<ProjectHeader project={{ ...project, status: "in_adjustments" }} />);
    await user.click(screen.getByRole("button", { name: "set completed" }));

    await waitFor(() => {
      expect(mockPost).toHaveBeenCalledWith("projects/6/complete", {});
    });
    expect(mockPatch).not.toHaveBeenCalled();
    expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ["project", 6] });
    expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ["projects"] });
    expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ["project-adjustments", 6] });
    const updater = mockSetQueryData.mock.calls[0][1] as (current: ProjectDetailType) => ProjectDetailType;
    expect(updater({ ...project, status: "in_adjustments" }).status).toBe("completed");
    expect(mockToastSuccess).toHaveBeenCalled();
    expect(mockToastError).not.toHaveBeenCalled();
  });

  it("shows the backend rejection without touching the cache", async () => {
    const user = userEvent.setup();
    mockPost.mockResolvedValue({
      ok: false,
      status: 422,
      error: "El proyecto no tiene todas las tareas completadas",
    });

    render(<ProjectHeader project={{ ...project, status: "in_adjustments" }} />);
    await user.click(screen.getByRole("button", { name: "set completed" }));

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith("El proyecto no tiene todas las tareas completadas");
    });
    expect(mockSetQueryData).not.toHaveBeenCalled();
    expect(mockInvalidateQueries).not.toHaveBeenCalled();
    expect(mockToastSuccess).not.toHaveBeenCalled();
    expect(mockPatch).not.toHaveBeenCalled();
  });

  it("keeps the generic error for failed selector PATCH changes", async () => {
    const user = userEvent.setup();
    mockPatch.mockResolvedValue({ ok: false, status: 500, error: "boom" });

    render(<ProjectHeader project={project} />);
    await user.click(screen.getByRole("button", { name: "set in adjustments" }));

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith("Error al actualizar el estado");
    });
    expect(mockSetQueryData).not.toHaveBeenCalled();
  });
});

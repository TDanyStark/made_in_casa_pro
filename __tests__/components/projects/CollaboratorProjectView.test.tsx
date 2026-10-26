import React from "react";
import { render, screen } from "@testing-library/react";

const mockUseQuery = jest.fn();

jest.mock("lucide-react", () => new Proxy({}, {
  get: (_, iconName: string) => {
    const MockIcon = () => <svg data-testid={`icon-${iconName}`} />;
    MockIcon.displayName = iconName;
    return MockIcon;
  },
}));

const mockInvalidateQueries = jest.fn();

jest.mock("@tanstack/react-query", () => ({
  useQuery: (...args: unknown[]) => mockUseQuery(...args),
  useQueryClient: () => ({ invalidateQueries: mockInvalidateQueries }),
}));

jest.mock("@/lib/services/apiService", () => ({
  get: jest.fn(),
}));

jest.mock("@/components/projects/ProjectHeader", () => ({
  ProjectHeader: ({ project }: { project: { title: string } }) => <div>{project.title}</div>,
}));

jest.mock("@/components/projects/ProjectNotesEditor", () => ({
  ProjectNotesEditor: ({ initialContent }: { initialContent: string }) => <div>{initialContent}</div>,
}));

jest.mock("@/components/projects/ProjectInfoTab", () => ({
  ProjectInfoTab: () => <div>Información</div>,
}));

jest.mock("@/components/projects/CollaboratorTasksList", () => ({
  CollaboratorTasksList: ({
    tasks,
    invitedTaskIds,
  }: {
    tasks: Array<{ title: string }>;
    invitedTaskIds: number[];
  }) => (
    <div data-testid="collaborator-tasks-list" data-invited={invitedTaskIds.join(",")}>
      {tasks.map((task) => (
        <div key={task.title}>{task.title}</div>
      ))}
    </div>
  ),
}));

jest.mock("@/components/quotes/SubmitQuoteModal", () => ({
  SubmitQuoteModal: () => <div>SubmitQuoteModal</div>,
}));

jest.mock("@/components/ui/tabs", () => ({
  Tabs: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  TabsList: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  TabsTrigger: ({ children }: { children: React.ReactNode }) => <button>{children}</button>,
  TabsContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

jest.mock("@/components/ui/skeleton", () => ({
  Skeleton: () => <div data-testid="skeleton" />,
}));

import { CollaboratorProjectView } from "@/components/projects/CollaboratorProjectView";
import { get } from "@/lib/services/apiService";
import { UserRole } from "@/lib/definitions";

const v1Adjustment = {
  id: 1,
  project_id: 15,
  version_number: 1,
  status: "active",
  notes: null,
  drive_folder_url: null,
  created_at: "2026-04-01T00:00:00.000Z",
  completed_at: null,
};

describe("CollaboratorProjectView", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseQuery.mockImplementation(({ queryKey }: { queryKey: unknown[] }) => {
      if (queryKey[0] === "project-adjustments") {
        return { data: [v1Adjustment], isLoading: false };
      }
      if (queryKey[0] === "collaborator-project-quotes") {
        return { data: { quotes: [] }, isLoading: false };
      }
      return { data: undefined, isLoading: false };
    });
  });

  it("renders all project tasks while keeping invited task ids for quote actions", () => {
    render(
      <CollaboratorProjectView
        projectId={15}
        project={{ id: 15, title: "Proyecto cotizable", notes: "<p>Notas</p>" } as never}
        tasks={[
          {
            id: 101,
            title: "Tarea visible",
            status: "completed",
            adjustment_id: 1,
          },
          {
            id: 202,
            title: "Tarea solo contexto",
            status: "in_progress",
            adjustment_id: 1,
          },
        ] as never}
        invitedTaskIds={[101]}
        userRole={UserRole.COLABORADOR}
        currentUserId={9}
      />
    );

    expect(screen.getByText("Versión 1 (Original)")).toBeInTheDocument();
    expect(screen.getByText("Tarea visible")).toBeInTheDocument();
    expect(screen.getByText("Tarea solo contexto")).toBeInTheDocument();
    expect(screen.getByTestId("collaborator-tasks-list")).toHaveAttribute("data-invited", "101");
    expect(screen.getByRole("button", { name: /tareas \(2\)/i })).toBeInTheDocument();
    expect(mockUseQuery).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: ["project-adjustments", 15] })
    );
    expect(mockUseQuery).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: ["collaborator-project-quotes", 15, 9] })
    );
  });

  const renderView = () =>
    render(
      <CollaboratorProjectView
        projectId={15}
        project={{ id: 15, title: "Proyecto cotizable", notes: "" } as never}
        tasks={[]}
        invitedTaskIds={[]}
        userRole={UserRole.COLABORADOR}
        currentUserId={9}
      />
    );

  it("query functions throw when the API fails instead of returning empty data", async () => {
    (get as jest.Mock).mockResolvedValue({ ok: false, status: 401, error: "No autorizado" });
    renderView();
    const queryFns = mockUseQuery.mock.calls.map(([options]) => options.queryFn);
    expect(queryFns).toHaveLength(2);
    for (const queryFn of queryFns) {
      await expect(queryFn()).rejects.toThrow("No autorizado");
    }
  });

  it.each(["project-adjustments", "collaborator-project-quotes"])(
    "shows an error state when %s fails",
    (failingKey) => {
      mockUseQuery.mockImplementation(({ queryKey }: { queryKey: unknown[] }) =>
        queryKey[0] === failingKey
          ? { data: undefined, isLoading: false, isError: true }
          : { data: queryKey[0] === "project-adjustments" ? [v1Adjustment] : { quotes: [] }, isLoading: false }
      );
      renderView();
      expect(screen.getByText("Error al cargar las tareas del proyecto")).toBeInTheDocument();
      expect(screen.queryByText("Versión 1 (Original)")).not.toBeInTheDocument();
    }
  );

  it("renders adjustment notes sanitized", () => {
    mockUseQuery.mockImplementation(({ queryKey }: { queryKey: unknown[] }) =>
      queryKey[0] === "project-adjustments"
        ? { data: [{ ...v1Adjustment, notes: '<p><u>ajuste</u></p><img src=x onerror="alert(1)">' }], isLoading: false }
        : { data: { quotes: [] }, isLoading: false }
    );
    const { container } = renderView();
    expect(screen.getByText("ajuste").tagName).toBe("U");
    expect(container.querySelector("img")).toBeNull();
  });
});

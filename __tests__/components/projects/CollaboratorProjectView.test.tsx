import React from "react";
import { render, screen } from "@testing-library/react";

const mockUseQuery = jest.fn();

jest.mock("@tanstack/react-query", () => ({
  useQuery: (...args: unknown[]) => mockUseQuery(...args),
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
  CollaboratorTasksList: ({ tasks }: { tasks: Array<{ title: string }> }) => (
    <div>
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
import { UserRole } from "@/lib/definitions";

describe("CollaboratorProjectView", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseQuery.mockReturnValue({
      data: { quotes: [] },
      isLoading: false,
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
          },
          {
            id: 202,
            title: "Tarea solo contexto",
            status: "in_progress",
          },
        ] as never}
        invitedTaskIds={[101]}
        userRole={UserRole.COLABORADOR}
        currentUserId={9}
      />
    );

    expect(screen.getByText("Tarea visible")).toBeInTheDocument();
    expect(screen.getByText("Tarea solo contexto")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /tareas \(2\)/i })).toBeInTheDocument();
    expect(mockUseQuery).toHaveBeenCalledTimes(1);
  });
});

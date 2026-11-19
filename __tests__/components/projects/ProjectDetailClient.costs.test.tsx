// Spec: odd/tasks/project-costs.md — S1, S2: the Costos tab by role (commercial only on own projects).
import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ProjectDetailClient } from "@/components/projects/ProjectDetailClient";
import { UserRole } from "@/lib/definitions";

let mockProject: Record<string, unknown> = {};

jest.mock("@tanstack/react-query", () => ({
  useQuery: () => ({ data: mockProject, isLoading: false, isError: false }),
}));
jest.mock("@/components/projects/ProjectCostsTab", () => ({
  ProjectCostsTab: ({ projectId }: { projectId: number }) => <div>{`costs-of-${projectId}`}</div>,
}));
jest.mock("@/components/projects/ProjectFinancialCards", () => ({ ProjectFinancialCards: () => null }));
jest.mock("@/components/projects/ProjectMetricsTab", () => ({ ProjectMetricsTab: () => null }));
jest.mock("@/components/projects/ProjectSalePrice", () => ({ ProjectSalePrice: () => null }));
jest.mock("@/components/projects/ProjectHeader", () => ({ ProjectHeader: () => null }));
jest.mock("@/components/projects/ProjectQuotesTab", () => ({ ProjectQuotesTab: () => null }));
jest.mock("@/components/projects/ProjectNotesEditor", () => ({ ProjectNotesEditor: () => null }));
jest.mock("@/components/projects/ProjectCoManagersTab", () => ({ ProjectCoManagersTab: () => null }));
jest.mock("@/components/projects/ProjectInfoTab", () => ({ ProjectInfoTab: () => null }));
jest.mock("@/components/projects/ProjectManagerCard", () => ({ ProjectManagerCard: () => null }));
jest.mock("@/components/projects/ProjectBrandsCard", () => ({ ProjectBrandsCard: () => null }));
jest.mock("@/components/projects/ProjectAdjustmentsTab", () => ({ ProjectAdjustmentsTab: () => null }));
jest.mock("@/components/notifications/EmailHistoryTable", () => ({ EmailHistoryTable: () => null }));

const CURRENT_USER = 1;

function renderAs(role: UserRole, createdBy: number | null) {
  mockProject = { id: 10, title: "P", status: "active", co_managers: [], notes: "", product_id: null, created_by: createdBy };
  return render(<ProjectDetailClient projectId={10} userRole={role} currentUserId={CURRENT_USER} />);
}

const costsTab = () => screen.queryByRole("tab", { name: "Costos" });

describe("ProjectDetailClient Costos tab", () => {
  it.each([UserRole.ADMIN, UserRole.DIRECTIVO, UserRole.FINANCIERO])(
    "role %s sees it on every project",
    (role) => {
      renderAs(role, 99);
      expect(costsTab()).toBeInTheDocument();
    }
  );

  it("the commercial sees it on a project they created", async () => {
    renderAs(UserRole.COMERCIAL, CURRENT_USER);
    await userEvent.click(costsTab()!);
    expect(screen.getByText("costs-of-10")).toBeInTheDocument();
  });

  it("the commercial does not see it on someone else's project", () => {
    renderAs(UserRole.COMERCIAL, 99);
    expect(costsTab()).not.toBeInTheDocument();
  });

  it("the collaborator never sees it", () => {
    renderAs(UserRole.COLABORADOR, CURRENT_USER);
    expect(costsTab()).not.toBeInTheDocument();
    expect(screen.queryByText(/costs-of-/)).not.toBeInTheDocument();
  });
});

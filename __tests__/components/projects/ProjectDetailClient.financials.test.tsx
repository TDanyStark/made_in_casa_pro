// S1, S2: financial cards are shown above the tabs only to roles allowed to see them.
import React from "react";
import { render, screen } from "@testing-library/react";
import { ProjectDetailClient } from "@/components/projects/ProjectDetailClient";
import { UserRole } from "@/lib/definitions";

jest.mock("@tanstack/react-query", () => ({
  useQuery: () => ({
    data: { id: 10, title: "P", status: "active", co_managers: [], notes: "", product_id: null },
    isLoading: false,
    isError: false,
  }),
}));
jest.mock("@/components/projects/ProjectFinancialCards", () => ({
  ProjectFinancialCards: ({ canEditSalePrice }: { canEditSalePrice: boolean }) => (
    <div data-testid="financial-cards">{canEditSalePrice ? "editable" : "read-only"}</div>
  ),
}));
jest.mock("@/components/projects/ProjectHeader", () => ({ ProjectHeader: () => <div>header</div> }));
jest.mock("@/components/projects/ProjectQuotesTab", () => ({ ProjectQuotesTab: () => <div>quotes</div> }));
jest.mock("@/components/projects/ProjectNotesEditor", () => ({ ProjectNotesEditor: () => <div>notes</div> }));
jest.mock("@/components/projects/ProjectCoManagersTab", () => ({ ProjectCoManagersTab: () => <div>co</div> }));
jest.mock("@/components/projects/ProjectInfoTab", () => ({ ProjectInfoTab: () => <div>info</div> }));
jest.mock("@/components/projects/ProjectManagerCard", () => ({ ProjectManagerCard: () => <div>manager</div> }));
jest.mock("@/components/projects/ProjectBrandsCard", () => ({ ProjectBrandsCard: () => <div>brands</div> }));
jest.mock("@/components/projects/ProjectAdjustmentsTab", () => ({ ProjectAdjustmentsTab: () => <div>tasks</div> }));
jest.mock("@/components/notifications/EmailHistoryTable", () => ({ EmailHistoryTable: () => <div>emails</div> }));

describe("ProjectDetailClient financial cards", () => {
  it.each([
    [UserRole.ADMIN, "editable"],
    [UserRole.DIRECTIVO, "editable"],
    [UserRole.COMERCIAL, "editable"],
    [UserRole.FINANCIERO, "read-only"],
  ])("role %s sees the cards (%s)", (role, mode) => {
    render(<ProjectDetailClient projectId={10} userRole={role} currentUserId={1} />);
    expect(screen.getByTestId("financial-cards")).toHaveTextContent(mode);
  });

  it("hides the cards from collaborators", () => {
    render(<ProjectDetailClient projectId={10} userRole={UserRole.COLABORADOR} currentUserId={1} />);
    expect(screen.queryByTestId("financial-cards")).not.toBeInTheDocument();
  });
});

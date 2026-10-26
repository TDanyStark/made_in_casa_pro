// Associated brands stay editable on completed projects; the manager card does not.
import React from "react";
import { render, screen } from "@testing-library/react";
import { ProjectDetailClient } from "@/components/projects/ProjectDetailClient";
import { UserRole } from "@/lib/definitions";

jest.mock("@tanstack/react-query", () => ({
  useQuery: () => ({
    data: { id: 10, title: "P", status: "completed", co_managers: [], notes: "", product_id: null },
    isLoading: false,
    isError: false,
  }),
}));
// Render every tab panel so the info tab content is observable.
jest.mock("@/components/ui/tabs", () => ({
  Tabs: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  TabsList: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  TabsTrigger: ({ children }: { children: React.ReactNode }) => <button>{children}</button>,
  TabsContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
jest.mock("@/components/projects/ProjectFinancialCards", () => ({ ProjectFinancialCards: () => null }));
jest.mock("@/components/projects/ProjectHeader", () => ({ ProjectHeader: () => null }));
jest.mock("@/components/projects/ProjectQuotesTab", () => ({ ProjectQuotesTab: () => null }));
jest.mock("@/components/projects/ProjectNotesEditor", () => ({ ProjectNotesEditor: () => null }));
jest.mock("@/components/projects/ProjectCoManagersTab", () => ({ ProjectCoManagersTab: () => null }));
jest.mock("@/components/projects/ProjectInfoTab", () => ({ ProjectInfoTab: () => null }));
jest.mock("@/components/projects/ProjectAdjustmentsTab", () => ({ ProjectAdjustmentsTab: () => null }));
jest.mock("@/components/notifications/EmailHistoryTable", () => ({ EmailHistoryTable: () => null }));
jest.mock("@/components/projects/ProjectManagerCard", () => ({
  ProjectManagerCard: ({ canEdit }: { canEdit: boolean }) => <div data-testid="manager-card">{String(canEdit)}</div>,
}));
jest.mock("@/components/projects/ProjectBrandsCard", () => ({
  ProjectBrandsCard: ({ canEdit }: { canEdit: boolean }) => <div data-testid="brands-card">{String(canEdit)}</div>,
}));

describe("ProjectDetailClient on a completed project", () => {
  it("keeps associated brands editable for editors while the manager stays read-only", () => {
    render(<ProjectDetailClient projectId={10} userRole={UserRole.ADMIN} currentUserId={1} />);
    expect(screen.getByTestId("brands-card")).toHaveTextContent("true");
    expect(screen.getByTestId("manager-card")).toHaveTextContent("false");
  });

});

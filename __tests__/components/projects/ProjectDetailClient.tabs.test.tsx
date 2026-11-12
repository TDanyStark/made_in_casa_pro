// Spec: odd/tasks/project-metrics-tab.md — S1, S3, S4, S5, S6: tabs, summary and sale price by role.
import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ProjectDetailClient } from "@/components/projects/ProjectDetailClient";
import { UserRole } from "@/lib/definitions";

jest.mock("@tanstack/react-query", () => ({
  useQuery: () => ({
    data: { id: 10, title: "P", status: "active", co_managers: [], notes: "", product_id: null, sale_price: null },
    isLoading: false,
    isError: false,
  }),
}));
jest.mock("@/components/projects/ProjectFinancialCards", () => ({
  ProjectFinancialCards: () => <div data-testid="financial-cards" />,
}));
jest.mock("@/components/projects/ProjectMetricsTab", () => ({
  ProjectMetricsTab: () => <div>metrics</div>,
}));
jest.mock("@/components/projects/ProjectSalePrice", () => ({
  ProjectSalePrice: ({ salePrice, canEdit }: { salePrice: number | null | undefined; canEdit: boolean }) => (
    <div data-testid="sale-price-block">{`${String(salePrice)}|${canEdit ? "editable" : "read-only"}`}</div>
  ),
}));
jest.mock("@/components/projects/ProjectHeader", () => ({ ProjectHeader: () => <div>header</div> }));
jest.mock("@/components/projects/ProjectQuotesTab", () => ({ ProjectQuotesTab: () => <div>quotes</div> }));
jest.mock("@/components/projects/ProjectNotesEditor", () => ({ ProjectNotesEditor: () => <div>notes</div> }));
jest.mock("@/components/projects/ProjectCoManagersTab", () => ({ ProjectCoManagersTab: () => <div>co-managers</div> }));
jest.mock("@/components/projects/ProjectInfoTab", () => ({ ProjectInfoTab: () => <div>info</div> }));
jest.mock("@/components/projects/ProjectManagerCard", () => ({ ProjectManagerCard: () => <div>manager</div> }));
jest.mock("@/components/projects/ProjectBrandsCard", () => ({ ProjectBrandsCard: () => <div>brands</div> }));
jest.mock("@/components/projects/ProjectAdjustmentsTab", () => ({ ProjectAdjustmentsTab: () => <div>tasks</div> }));
jest.mock("@/components/notifications/EmailHistoryTable", () => ({ EmailHistoryTable: () => <div>emails</div> }));

const renderAs = (role: UserRole) =>
  render(<ProjectDetailClient projectId={10} userRole={role} currentUserId={1} />);
const tabNames = () => screen.getAllByRole("tab").map((tab) => tab.textContent);

describe("ProjectDetailClient tabs", () => {
  it.each([UserRole.ADMIN, UserRole.DIRECTIVO, UserRole.FINANCIERO])(
    "role %s gets Tareas, Notas, Métricas, Cotizaciones, Información, Notificaciones",
    (role) => {
      renderAs(role);
      expect(tabNames()).toEqual(["Tareas", "Notas", "Métricas", "Cotizaciones", "Información", "Notificaciones"]);
    }
  );

  it("commercials do not get the Métricas tab", () => {
    renderAs(UserRole.COMERCIAL);
    expect(tabNames()).toEqual(["Tareas", "Notas", "Cotizaciones", "Información", "Notificaciones"]);
  });

  it("collaborators only get Tareas and Notas", () => {
    renderAs(UserRole.COLABORADOR);
    expect(tabNames()).toEqual(["Tareas", "Notas"]);
  });

  it("shows the metrics detail in the Métricas tab", async () => {
    renderAs(UserRole.DIRECTIVO);
    await userEvent.click(screen.getByRole("tab", { name: "Métricas" }));
    expect(screen.getByText("metrics")).toBeInTheDocument();
  });

  it("moves the co-managers inside Información", async () => {
    renderAs(UserRole.ADMIN);
    expect(screen.queryByRole("tab", { name: /Co-responsables/ })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("tab", { name: "Información" }));
    expect(screen.getByText("co-managers")).toBeInTheDocument();
    expect(screen.getByText("info")).toBeInTheDocument();
  });
});

describe("ProjectDetailClient summary and sale price", () => {
  it.each([UserRole.ADMIN, UserRole.DIRECTIVO, UserRole.FINANCIERO])("role %s sees the summary", (role) => {
    renderAs(role);
    expect(screen.getByTestId("financial-cards")).toBeInTheDocument();
  });

  it.each([UserRole.COMERCIAL, UserRole.COLABORADOR])("role %s does not see the summary", (role) => {
    renderAs(role);
    expect(screen.queryByTestId("financial-cards")).not.toBeInTheDocument();
  });

  it.each([
    [UserRole.ADMIN, "editable"],
    [UserRole.DIRECTIVO, "editable"],
    [UserRole.COMERCIAL, "editable"],
    [UserRole.FINANCIERO, "read-only"],
  ])("role %s gets the sale price block (%s)", (role, mode) => {
    renderAs(role);
    expect(screen.getByTestId("sale-price-block")).toHaveTextContent(`null|${mode}`);
  });
});

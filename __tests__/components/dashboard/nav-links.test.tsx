import React from "react";
import { render, screen } from "@testing-library/react";
import NavLinks from "@/components/dashboard/nav-links";

let mockRole = 4;
const mockUseQuery = jest.fn((options: { enabled?: boolean }) => ({
  data: options.enabled ? { count: 3 } : undefined,
}));

jest.mock("next/navigation", () => ({ usePathname: () => "/dashboard" }));
jest.mock("@/components/context/RoleContext", () => ({ useRole: () => mockRole }));
jest.mock("@tanstack/react-query", () => ({
  useQuery: (options: { enabled?: boolean }) => mockUseQuery(options),
}));
jest.mock("@/lib/services/apiService", () => ({ get: jest.fn() }));
jest.mock("lucide-react", () => new Proxy({}, { get: () => () => null }));

describe("NavLinks — Mis Cotizaciones", () => {
  beforeEach(() => {
    mockRole = 4;
    mockUseQuery.mockClear();
  });

  it("shows Mis Cotizaciones and its badge to an external collaborator", () => {
    render(<NavLinks isInternalCollaborator={false} />);

    expect(screen.getByText("Mis Cotizaciones")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(mockUseQuery).toHaveBeenCalledWith(expect.objectContaining({ enabled: true }));
  });

  it("hides Mis Cotizaciones and skips the count request for an internal collaborator", () => {
    render(<NavLinks isInternalCollaborator />);

    expect(screen.queryByText("Mis Cotizaciones")).not.toBeInTheDocument();
    expect(screen.getByText("Mis Tareas")).toBeInTheDocument();
    expect(mockUseQuery).toHaveBeenCalledWith(expect.objectContaining({ enabled: false }));
  });

  it("keeps hiding Mis Cotizaciones from non-collaborator roles", () => {
    mockRole = 1;
    render(<NavLinks isInternalCollaborator={false} />);

    expect(screen.queryByText("Mis Cotizaciones")).not.toBeInTheDocument();
    expect(screen.getByText("Usuarios")).toBeInTheDocument();
  });
});

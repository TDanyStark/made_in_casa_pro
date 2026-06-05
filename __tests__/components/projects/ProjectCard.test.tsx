import React from "react";
import { render, screen } from "@testing-library/react";
import { ProjectCard } from "@/components/projects/ProjectCard";
import { ProjectType } from "@/lib/definitions";

// Mock lucide-react icons to lightweight svgs.
jest.mock("lucide-react", () => new Proxy({}, {
  get: (_, iconName: string) => {
    const MockIcon = () => <svg data-testid={`icon-${String(iconName)}`} />;
    MockIcon.displayName = String(iconName);
    return MockIcon;
  },
}));

// next/link just renders children.
jest.mock("next/link", () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// Status badge / progress bar are not under test — stub them out.
jest.mock("@/components/projects/ProjectStatusBadge", () => ({
  ProjectStatusBadge: () => <span data-testid="status-badge" />,
}));
jest.mock("@/components/projects/ProjectProgressBar", () => ({
  ProjectProgressBar: () => <div data-testid="progress-bar" />,
}));

function makeProject(overrides: Partial<ProjectType> = {}): ProjectType {
  return {
    id: 1,
    title: "Lanzamiento Q1",
    brand_name: "ACME",
    client_name: "Cliente ACME",
    manager_name: "María Gerente",
    status: "active",
    progress: 50,
    created_by: 9,
    created_by_name: "Admin User",
    ...overrides,
  } as ProjectType;
}

describe("ProjectCard — creator visibility", () => {
  it("shows the creator name when showCreator is true", () => {
    render(<ProjectCard project={makeProject()} showCreator />);
    expect(screen.getByText("Admin User")).toBeInTheDocument();
  });

  it("hides the creator name when showCreator is false (default)", () => {
    render(<ProjectCard project={makeProject()} />);
    expect(screen.queryByText("Admin User")).not.toBeInTheDocument();
  });

  it("does not render the creator block when created_by_name is null", () => {
    render(
      <ProjectCard
        project={makeProject({ created_by_name: null })}
        showCreator
      />
    );
    // The manager is still rendered; the creator simply is absent.
    expect(screen.getByText("María Gerente")).toBeInTheDocument();
    expect(screen.queryByText("Admin User")).not.toBeInTheDocument();
  });
});

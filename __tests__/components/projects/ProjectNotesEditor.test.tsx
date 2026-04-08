import { render, screen } from "@testing-library/react";

jest.mock("next/dynamic", () => () => {
  const MockRichTextEditor = ({ value }: { value: string }) => <div data-testid="rich-text-editor">{value}</div>;
  MockRichTextEditor.displayName = "MockRichTextEditor";
  return MockRichTextEditor;
});

jest.mock("@/components/ui/button", () => ({
  Button: ({ children }: { children: React.ReactNode }) => <button>{children}</button>,
}));

jest.mock("@/components/ui/skeleton", () => ({
  Skeleton: () => <div data-testid="skeleton" />,
}));

jest.mock("lucide-react", () => new Proxy({}, {
  get: (_, iconName: string) => {
    const MockIcon = () => <svg data-testid={`icon-${iconName}`} />;
    MockIcon.displayName = iconName;
    return MockIcon;
  },
}));

jest.mock("@/lib/services/apiService", () => ({
  patch: jest.fn(),
}));

jest.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({
    invalidateQueries: jest.fn(),
  }),
}));

jest.mock("sonner", () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));

import { ProjectNotesEditor } from "@/components/projects/ProjectNotesEditor";

describe("ProjectNotesEditor", () => {
  it("renders rich text HTML in read-only mode", () => {
    const { container } = render(
      <ProjectNotesEditor
        projectId={7}
        initialContent="<p><strong>Nota importante</strong> con formato</p>"
        readOnly={true}
      />
    );

    expect(screen.getByText(/nota importante/i)).toBeInTheDocument();
    expect(container.querySelector("strong")).toHaveTextContent("Nota importante");
    expect(screen.queryByText(/<strong>Nota importante<\/strong>/i)).not.toBeInTheDocument();
  });

  it("shows an empty-state message when there are no notes", () => {
    render(
      <ProjectNotesEditor
        projectId={7}
        initialContent=""
        readOnly={true}
      />
    );

    expect(screen.getByText(/sin notas/i)).toBeInTheDocument();
  });
});

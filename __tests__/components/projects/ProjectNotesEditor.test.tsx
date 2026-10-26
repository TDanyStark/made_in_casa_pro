import { fireEvent, render, screen } from "@testing-library/react";

jest.mock("next/dynamic", () => () => {
  const MockRichTextEditor = ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
    <div>
      <div data-testid="rich-text-editor">{value}</div>
      <button type="button" onClick={() => onChange("<p>edición local</p>")}>editar</button>
    </div>
  );
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

  it("strips script and event-handler payloads in read-only mode", () => {
    const { container } = render(
      <ProjectNotesEditor
        projectId={7}
        initialContent={'<p>ok</p><img src=x onerror="alert(1)"><script>alert(2)</script>'}
        readOnly={true}
      />
    );

    expect(screen.getByText("ok")).toBeInTheDocument();
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector("script")).toBeNull();
  });

  it("re-syncs from new initialContent when there are no unsaved edits", () => {
    const { rerender } = render(
      <ProjectNotesEditor projectId={7} initialContent="<p>v1</p>" readOnly={true} />
    );
    rerender(<ProjectNotesEditor projectId={7} initialContent="<p>v2</p>" readOnly={true} />);

    expect(screen.getByText("v2")).toBeInTheDocument();
    expect(screen.queryByText("v1")).not.toBeInTheDocument();
  });

  it("re-syncs the editable editor when there are no unsaved edits", () => {
    const { rerender } = render(<ProjectNotesEditor projectId={7} initialContent="<p>v1</p>" />);
    rerender(<ProjectNotesEditor projectId={7} initialContent="<p>v2</p>" />);

    expect(screen.getByTestId("rich-text-editor")).toHaveTextContent("<p>v2</p>");
    expect(screen.queryByText(/guardar cambios/i)).not.toBeInTheDocument();
  });

  it("keeps unsaved edits when new initialContent arrives", () => {
    const { rerender } = render(<ProjectNotesEditor projectId={7} initialContent="<p>v1</p>" />);
    fireEvent.click(screen.getByText("editar"));
    rerender(<ProjectNotesEditor projectId={7} initialContent="<p>v2</p>" />);

    expect(screen.getByTestId("rich-text-editor")).toHaveTextContent("<p>edición local</p>");
    expect(screen.getByText(/guardar cambios/i)).toBeInTheDocument();
  });
});

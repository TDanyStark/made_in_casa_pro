import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ProjectDriveAccessManager } from "@/components/projects/ProjectDriveAccessManager";

const mockGet = jest.fn();
const mockPost = jest.fn();
const mockDel = jest.fn();

jest.mock("@/lib/services/apiService", () => ({
  get: (...args: unknown[]) => mockGet(...args),
  post: (...args: unknown[]) => mockPost(...args),
  del: (...args: unknown[]) => mockDel(...args),
}));
jest.mock("lucide-react", () => ({ Trash2: () => <svg /> }));
jest.mock("sonner", () => ({ toast: { success: jest.fn(), error: jest.fn() } }));
jest.mock("@/components/ui/select", () => ({
  Select: ({ children, value, onValueChange }: { children: React.ReactNode; value: string; onValueChange: (value: string) => void }) => (
    <select aria-label="Rol de acceso" value={value} onChange={(event) => onValueChange(event.target.value)}>{children}</select>
  ),
  SelectTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SelectValue: () => null,
  SelectContent: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SelectGroup: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SelectItem: ({ children, value }: { children: React.ReactNode; value: string }) => <option value={value}>{children}</option>,
}));
jest.mock("@/components/ui/alert-dialog", () => ({
  AlertDialog: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  AlertDialogTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  AlertDialogContent: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  AlertDialogHeader: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  AlertDialogTitle: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  AlertDialogDescription: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  AlertDialogFooter: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  AlertDialogCancel: ({ children }: { children: React.ReactNode }) => <button>{children}</button>,
  AlertDialogAction: ({ children, onClick }: { children: React.ReactNode; onClick: () => void }) => <button onClick={onClick}>{children}</button>,
}));

function renderManager(canEdit = true) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(<QueryClientProvider client={client}><ProjectDriveAccessManager projectId={42} canEdit={canEdit} /></QueryClientProvider>);
}

describe("ProjectDriveAccessManager", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGet.mockResolvedValue({ ok: true, data: {
      canShare: true,
      permissions: [
        { id: "p1", type: "user", role: "writer", emailAddress: "person@test.com", displayName: null, domain: null, inherited: false, isConnectedAccount: false, canDelete: true },
        { id: "p2", type: "domain", role: "reader", emailAddress: null, displayName: null, domain: "example.com", inherited: true, isConnectedAccount: false, canDelete: false },
      ],
    } });
  });

  it("shows real user and non-individual ACL entries while hiding edit controls for viewers", async () => {
    renderManager(false);
    expect(await screen.findByText("person@test.com")).toBeInTheDocument();
    expect(screen.getByText("example.com")).toBeInTheDocument();
    expect(screen.queryByLabelText(/agregar correo/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /quitar acceso/i })).not.toBeInTheDocument();
  });

  it("adds an email as writer by default", async () => {
    const user = userEvent.setup();
    mockPost.mockResolvedValue({ ok: true, data: { success: true } });
    renderManager(true);
    const input = await screen.findByLabelText(/agregar correo/i);
    await user.type(input, "new@test.com");
    await user.click(screen.getByRole("button", { name: /^agregar$/i }));
    await waitFor(() => expect(mockPost).toHaveBeenCalledWith(
      "projects/42/drive/permissions",
      { email: "new@test.com", role: "writer" }
    ));
  });
});

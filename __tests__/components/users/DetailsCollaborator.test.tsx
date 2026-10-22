// S11: an internal collaborator is configured with a monthly salary in the profile.
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import DetailsCollaborator from "@/components/users/DetailsCollaborator";

jest.mock("@/lib/services/apiService", () => ({ patch: jest.fn() }));
jest.mock("sonner", () => ({
  toast: {
    promise: jest.fn((promise: Promise<{ data: unknown }>, opts: { success: (d: unknown) => string }) => {
      promise.then((d) => opts.success(d)).catch(() => undefined);
    }),
  },
}));
jest.mock("@/components/users/AreaSelect", () => ({ __esModule: true, default: () => null }));
jest.mock("@/components/users/SkillsByColaborator", () => ({ __esModule: true, default: () => null }));

import { patch } from "@/lib/services/apiService";
const mockPatch = patch as jest.MockedFunction<typeof patch>;

beforeEach(() => jest.clearAllMocks());

describe("DetailsCollaborator monthly salary", () => {
  it("shows the monthly salary field with the frozen-history note for an internal collaborator", () => {
    render(<DetailsCollaborator user_id={3} is_internal area_id={1} monthly_salary={5040000} />);
    const input = screen.getByLabelText("Sueldo mensual") as HTMLInputElement;
    expect(input.value).toBe((5040000).toLocaleString("es-CO"));
    expect(screen.getByText(/Las tareas ya completadas conservan/)).toBeInTheDocument();
    expect(screen.queryByText("Valor de la hora")).toBeNull();
  });

  it("saves monthly_salary on Enter", async () => {
    mockPatch.mockResolvedValue({ ok: true, status: 200, data: { monthly_salary: "6000000.00" } } as never);
    render(<DetailsCollaborator user_id={3} is_internal area_id={1} monthly_salary={null} />);
    const input = screen.getByLabelText("Sueldo mensual");
    fireEvent.change(input, { target: { value: "6000000" } });
    fireEvent.keyDown(input, { key: "Enter" });
    await waitFor(() => expect(mockPatch).toHaveBeenCalledWith("users/3", { monthly_salary: 6000000 }));
  });

  it("hides the salary for an external collaborator", () => {
    render(<DetailsCollaborator user_id={3} is_internal={false} area_id={1} monthly_salary={5040000} />);
    expect(screen.queryByLabelText("Sueldo mensual")).toBeNull();
  });
});

// S12: Configuración holds the weekly legal work hours (default 42).
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { SettingsClient } from "@/components/settings/SettingsClient";

jest.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams() }));
jest.mock("@/lib/services/apiService", () => ({ get: jest.fn(), patch: jest.fn() }));
jest.mock("sonner", () => ({ toast: { success: jest.fn(), error: jest.fn() } }));
jest.mock("lucide-react", () => new Proxy({}, {
  get: (_, iconName: string) => {
    const MockIcon = () => <svg data-testid={`icon-${String(iconName)}`} />;
    MockIcon.displayName = String(iconName);
    return MockIcon;
  },
}));
jest.mock("@/components/settings/GmailStatusCard", () => ({ GmailStatusCard: () => null }));
jest.mock("@/components/notifications/FailedDeliveriesPanel", () => ({ FailedDeliveriesPanel: () => null }));

import { get, patch } from "@/lib/services/apiService";
import { toast } from "sonner";
const mockGet = get as jest.MockedFunction<typeof get>;
const mockPatch = patch as jest.MockedFunction<typeof patch>;

const SETTINGS = {
  google_oauth_client_id: null,
  google_oauth_client_secret: null,
  google_oauth_connected_email: null,
  google_oauth_connected: false,
  daily_report_time: "18:00",
  weekly_work_hours: 42,
};

async function renderAsAdmin() {
  mockGet.mockImplementation(async (url: string) =>
    (url === "settings"
      ? { ok: true, status: 200, data: SETTINGS }
      : { ok: true, status: 200, data: { id: 1, rol_id: 1 } }) as never
  );
  render(<SettingsClient />);
  const tab = await screen.findByRole("tab", { name: "General" });
  fireEvent.mouseDown(tab, { button: 0 });
  return (await screen.findByLabelText("Horas semanales de trabajo (ley)")) as HTMLInputElement;
}

beforeEach(() => jest.clearAllMocks());

describe("SettingsClient weekly work hours", () => {
  it("shows the stored weekly hours and saves a decimal value", async () => {
    mockPatch.mockResolvedValue({ ok: true, status: 200, data: { ok: true } } as never);
    const input = await renderAsAdmin();
    expect(input.value).toBe("42");
    expect(input.step).toBe("0.1");

    fireEvent.change(input, { target: { value: "47.5" } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar horas semanales" }));

    await waitFor(() => expect(mockPatch).toHaveBeenCalledWith("settings", { weekly_work_hours: 47.5 }));
    expect(toast.success).toHaveBeenCalledWith("Horas semanales guardadas");
  });

  it("rejects a value above 60 without saving", async () => {
    const input = await renderAsAdmin();
    fireEvent.change(input, { target: { value: "61" } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar horas semanales" }));

    expect(toast.error).toHaveBeenCalledWith("Las horas semanales deben ser un número mayor que 0 y máximo 60");
    expect(mockPatch).not.toHaveBeenCalled();
  });
});

/**
 * @jest-environment node
 */

jest.mock("@/lib/services/api-auth", () => ({
  validateHttpMethod: jest.fn(),
  validateApiRole: jest.fn(),
}));

jest.mock("@/lib/queries/settings", () => ({
  getAppSettings: jest.fn(),
  getWeeklyWorkHours: jest.fn(),
  upsertSettings: jest.fn(),
}));

import { NextRequest } from "next/server";
import { GET, PATCH } from "@/api/settings/route";
import { validateApiRole, validateHttpMethod } from "@/lib/services/api-auth";
import { getAppSettings, getWeeklyWorkHours, upsertSettings } from "@/lib/queries/settings";
import { ADMIN_ONLY_ROLES } from "@/lib/role-groups";

const mockValidateHttpMethod = validateHttpMethod as jest.MockedFunction<typeof validateHttpMethod>;
const mockValidateApiRole = validateApiRole as jest.MockedFunction<typeof validateApiRole>;
const mockGetAppSettings = getAppSettings as jest.MockedFunction<typeof getAppSettings>;
const mockUpsertSettings = upsertSettings as jest.MockedFunction<typeof upsertSettings>;
const mockGetWeeklyWorkHours = getWeeklyWorkHours as jest.MockedFunction<typeof getWeeklyWorkHours>;

const WEEKLY_HOURS_ERROR = "Las horas semanales deben ser un número mayor que 0 y máximo 60";

function patchRequest(body: unknown) {
  return new NextRequest("http://localhost/api/settings", {
    method: "PATCH",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

async function callGet(req: NextRequest) {
  const response = await GET(req);
  if (!response) throw new Error("GET handler returned undefined");
  return response;
}

async function callPatch(req: NextRequest) {
  const response = await PATCH(req);
  if (!response) throw new Error("PATCH handler returned undefined");
  return response;
}

describe("/api/settings", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockValidateHttpMethod.mockReturnValue({ isValidMethod: true, response: undefined });
    mockValidateApiRole.mockResolvedValue({
      isAuthorized: true,
      userRole: 1 as never,
      response: undefined,
    } as never);
  });

  it("GET includes daily_report_time while masking secrets", async () => {
    mockGetAppSettings.mockResolvedValue({
      google_oauth_client_id: "client",
      google_oauth_client_secret: "secret",
      google_oauth_refresh_token: "refresh",
      google_oauth_connected_email: "admin@test.com",
      daily_report_time: "17:45",
    });

    const res = await callGet(new NextRequest("http://localhost/api/settings"));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.daily_report_time).toBe("17:45");
    expect(data.google_oauth_client_secret).toBe("***configured***");
    expect(mockValidateApiRole).toHaveBeenCalledWith(expect.anything(), ADMIN_ONLY_ROLES);
  });

  it("PATCH accepts daily_report_time in HH:MM format", async () => {
    const req = new NextRequest("http://localhost/api/settings", {
      method: "PATCH",
      body: JSON.stringify({ daily_report_time: "19:30" }),
      headers: { "Content-Type": "application/json" },
    });

    const res = await callPatch(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.ok).toBe(true);
    expect(mockUpsertSettings).toHaveBeenCalledWith({ daily_report_time: "19:30" });
    expect(mockValidateApiRole).toHaveBeenCalledWith(req, ADMIN_ONLY_ROLES);
  });

  // S12: weekly legal work hours in Configuración.
  it("GET includes weekly_work_hours", async () => {
    mockGetAppSettings.mockResolvedValue({
      google_oauth_client_id: null,
      google_oauth_client_secret: null,
      google_oauth_refresh_token: null,
      google_oauth_connected_email: null,
      daily_report_time: "18:00",
    });
    mockGetWeeklyWorkHours.mockResolvedValue(42);

    const res = await callGet(new NextRequest("http://localhost/api/settings"));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.weekly_work_hours).toBe(42);
  });

  it.each([44, 47.5, 60])("PATCH stores weekly_work_hours %p", async (hours) => {
    const res = await callPatch(patchRequest({ weekly_work_hours: hours }));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(mockUpsertSettings).toHaveBeenCalledWith({ weekly_work_hours: hours });
  });

  it.each([0, -1, 60.5, "42", null])("PATCH rejects weekly_work_hours %p with 400 and stores nothing", async (hours) => {
    const res = await callPatch(patchRequest({ weekly_work_hours: hours }));
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toBe("Datos inválidos");
    expect(data.details.weekly_work_hours._errors).toEqual([WEEKLY_HOURS_ERROR]);
    expect(mockUpsertSettings).not.toHaveBeenCalled();
  });

  it("PATCH keeps rejecting an invalid daily_report_time as before", async () => {
    const res = await callPatch(patchRequest({ daily_report_time: "25:00" }));
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toBe("Datos inválidos");
    expect(data.details.daily_report_time._errors).toEqual(["Formato inválido. Usa HH:MM"]);
    expect(mockUpsertSettings).not.toHaveBeenCalled();
  });
});

/**
 * @jest-environment node
 */

jest.mock("@/lib/services/api-auth", () => ({
  validateHttpMethod: jest.fn(),
  validateApiRole: jest.fn(),
}));

jest.mock("@/lib/queries/settings", () => ({
  getAppSettings: jest.fn(),
  upsertSettings: jest.fn(),
}));

import { NextRequest } from "next/server";
import { GET, PATCH } from "@/api/settings/route";
import { validateApiRole, validateHttpMethod } from "@/lib/services/api-auth";
import { getAppSettings, upsertSettings } from "@/lib/queries/settings";

const mockValidateHttpMethod = validateHttpMethod as jest.MockedFunction<typeof validateHttpMethod>;
const mockValidateApiRole = validateApiRole as jest.MockedFunction<typeof validateApiRole>;
const mockGetAppSettings = getAppSettings as jest.MockedFunction<typeof getAppSettings>;
const mockUpsertSettings = upsertSettings as jest.MockedFunction<typeof upsertSettings>;

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
  });
});

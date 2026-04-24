/**
 * @jest-environment node
 */

jest.mock("@/lib/services/api-auth", () => ({
  validateHttpMethod: jest.fn(),
  validateApiRole: jest.fn(),
}));

jest.mock("@/lib/queries/notificationDeliveries", () => ({
  getRecentDeliveries: jest.fn(),
}));

import { NextRequest } from "next/server";
import { GET } from "@/api/notification-deliveries/route";
import { validateApiRole, validateHttpMethod } from "@/lib/services/api-auth";
import { getRecentDeliveries } from "@/lib/queries/notificationDeliveries";

const mockValidateHttpMethod = validateHttpMethod as jest.MockedFunction<typeof validateHttpMethod>;
const mockValidateApiRole = validateApiRole as jest.MockedFunction<typeof validateApiRole>;
const mockGetRecentDeliveries = getRecentDeliveries as jest.MockedFunction<typeof getRecentDeliveries>;

const ADMIN_ROLE = { isAuthorized: true, userRole: 1, response: undefined } as never;
const FORBIDDEN_ROLE = {
  isAuthorized: false,
  userRole: 4,
  response: new Response(JSON.stringify({ error: "Forbidden" }), { status: 403 }),
} as never;

function makeRequest(url = "http://localhost/api/notification-deliveries") {
  return new NextRequest(url);
}

describe("GET /api/notification-deliveries", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockValidateHttpMethod.mockReturnValue({ isValidMethod: true, response: undefined });
    mockValidateApiRole.mockResolvedValue(ADMIN_ROLE);
  });

  it("returns recent deliveries as { data }", async () => {
    const deliveries = [
      {
        id: 1,
        event_id: 10,
        recipient_email: "to@example.com",
        status: "sent",
        provider: "gmail",
        created_at: "2026-01-01",
        event_type: "task.assigned",
        project_id: 5,
        project_title: "Project Alpha",
      },
    ];
    mockGetRecentDeliveries.mockResolvedValue(deliveries as never);

    const res = await GET(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ data: deliveries });
    expect(mockGetRecentDeliveries).toHaveBeenCalledWith(50);
  });

  it("respects custom limit query param (max 200)", async () => {
    mockGetRecentDeliveries.mockResolvedValue([]);

    await GET(makeRequest("http://localhost/api/notification-deliveries?limit=300"));
    expect(mockGetRecentDeliveries).toHaveBeenCalledWith(200);
  });

  it("returns 403 when role is not admin", async () => {
    mockValidateApiRole.mockResolvedValue(FORBIDDEN_ROLE);
    const res = await GET(makeRequest());
    expect(res.status).toBe(403);
  });

  it("returns 500 on unexpected error", async () => {
    mockGetRecentDeliveries.mockRejectedValue(new Error("DB error"));
    const res = await GET(makeRequest());
    expect(res.status).toBe(500);
  });
});

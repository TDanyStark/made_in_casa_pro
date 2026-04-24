/**
 * @jest-environment node
 */

jest.mock("@/lib/services/api-auth", () => ({
  validateHttpMethod: jest.fn(),
  validateApiRole: jest.fn(),
}));

jest.mock("@/lib/queries/notificationDeliveries", () => ({
  getDeliveriesByProject: jest.fn(),
}));

import { NextRequest } from "next/server";
import { GET } from "@/api/projects/[id]/notification-deliveries/route";
import { validateApiRole, validateHttpMethod } from "@/lib/services/api-auth";
import { getDeliveriesByProject } from "@/lib/queries/notificationDeliveries";

const mockValidateHttpMethod = validateHttpMethod as jest.MockedFunction<typeof validateHttpMethod>;
const mockValidateApiRole = validateApiRole as jest.MockedFunction<typeof validateApiRole>;
const mockGetDeliveriesByProject = getDeliveriesByProject as jest.MockedFunction<typeof getDeliveriesByProject>;

const AUTHORIZED = { isAuthorized: true, userRole: 1, response: undefined } as never;
const FORBIDDEN = {
  isAuthorized: false,
  userRole: 99,
  response: new Response(JSON.stringify({ error: "Forbidden" }), { status: 403 }),
} as never;

function makeRequest(url: string) {
  return new NextRequest(url);
}

async function callGet(projectId: string, url?: string) {
  const req = makeRequest(url ?? `http://localhost/api/projects/${projectId}/notification-deliveries`);
  return GET(req, { params: Promise.resolve({ id: projectId }) });
}

describe("GET /api/projects/[id]/notification-deliveries", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockValidateHttpMethod.mockReturnValue({ isValidMethod: true, response: undefined });
    mockValidateApiRole.mockResolvedValue(AUTHORIZED);
  });

  it("returns deliveries for the given project as { data }", async () => {
    const deliveries = [
      {
        id: 1,
        event_id: 10,
        recipient_email: "to@example.com",
        status: "sent",
        provider: "gmail",
        created_at: "2026-01-01",
        event_type: "task.completed",
        project_id: 7,
        project_title: "My Project",
      },
    ];
    mockGetDeliveriesByProject.mockResolvedValue(deliveries as never);

    const res = await callGet("7");
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ data: deliveries });
    expect(mockGetDeliveriesByProject).toHaveBeenCalledWith(7, 50);
  });

  it("returns 400 for non-numeric project id", async () => {
    const res = await callGet("abc");
    expect(res.status).toBe(400);
  });

  it("respects custom limit (max 200)", async () => {
    mockGetDeliveriesByProject.mockResolvedValue([]);
    await callGet(
      "7",
      "http://localhost/api/projects/7/notification-deliveries?limit=500"
    );
    expect(mockGetDeliveriesByProject).toHaveBeenCalledWith(7, 200);
  });

  it("returns 403 when not authorized", async () => {
    mockValidateApiRole.mockResolvedValue(FORBIDDEN);
    const res = await callGet("7");
    expect(res.status).toBe(403);
  });

  it("returns 500 on unexpected DB error", async () => {
    mockGetDeliveriesByProject.mockRejectedValue(new Error("DB error"));
    const res = await callGet("7");
    expect(res.status).toBe(500);
  });
});

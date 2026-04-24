/**
 * @jest-environment node
 */

jest.mock("@/lib/services/api-auth", () => ({
  validateHttpMethod: jest.fn(),
  validateApiRole: jest.fn(),
}));

jest.mock("@/lib/queries/projects", () => ({
  completeProject: jest.fn(),
}));

jest.mock("next/headers", () => ({
  cookies: jest.fn(),
}));

jest.mock("@/lib/session", () => ({
  decrypt: jest.fn(),
}));

jest.mock("@/lib/services/notificationEngine", () => ({
  NOTIFICATION_EVENTS: {
    PROJECT_COMPLETED: "project.completed",
  },
  dispatchNotification: jest.fn(),
}));

import { NextRequest } from "next/server";
import { POST } from "@/api/projects/[id]/complete/route";
import { validateApiRole, validateHttpMethod } from "@/lib/services/api-auth";
import { completeProject } from "@/lib/queries/projects";
import { cookies } from "next/headers";
import { decrypt } from "@/lib/session";
import { dispatchNotification } from "@/lib/services/notificationEngine";

const mockValidateHttpMethod = validateHttpMethod as jest.MockedFunction<typeof validateHttpMethod>;
const mockValidateApiRole = validateApiRole as jest.MockedFunction<typeof validateApiRole>;
const mockCompleteProject = completeProject as jest.MockedFunction<typeof completeProject>;
const mockCookies = cookies as jest.MockedFunction<typeof cookies>;
const mockDecrypt = decrypt as jest.MockedFunction<typeof decrypt>;
const mockDispatchNotification = dispatchNotification as jest.MockedFunction<typeof dispatchNotification>;

async function callPost() {
  const response = await POST(new NextRequest("http://localhost/api/projects/15/complete", { method: "POST" }), {
    params: Promise.resolve({ id: "15" }),
  });
  if (!response) throw new Error("POST handler returned undefined");
  return response;
}

describe("POST /api/projects/[id]/complete notifications", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockValidateHttpMethod.mockReturnValue({ isValidMethod: true, response: undefined });
    mockValidateApiRole.mockResolvedValue({ isAuthorized: true, userRole: 1, response: undefined } as never);
    mockCompleteProject.mockResolvedValue(undefined);
    mockCookies.mockResolvedValue({ get: jest.fn().mockReturnValue({ value: "session-token" }) } as never);
    mockDecrypt.mockResolvedValue({ id: 7, email: "user@test.com", rol_id: 1 } as never);
    mockDispatchNotification.mockResolvedValue(undefined);
  });

  it("dispatches project.completed after completing the project", async () => {
    const response = await callPost();

    expect(response.status).toBe(200);
    expect(mockCompleteProject).toHaveBeenCalledWith(15);
    expect(mockDispatchNotification).toHaveBeenCalledWith({
      eventType: "project.completed",
      actorUserId: 7,
      projectId: 15,
    });
  });
});

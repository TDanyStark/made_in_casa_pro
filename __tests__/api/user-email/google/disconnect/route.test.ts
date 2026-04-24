/**
 * @jest-environment node
 */

jest.mock("@/lib/services/api-auth", () => ({
  validateHttpMethod: jest.fn(),
  validateApiRole: jest.fn(),
}));

jest.mock("@/lib/services/api-session", () => ({
  getCurrentSession: jest.fn(),
}));

jest.mock("@/lib/queries/userEmailConnections", () => ({
  disconnectUserEmailConnection: jest.fn(),
}));

import { NextRequest } from "next/server";
import { POST } from "@/api/user-email/google/disconnect/route";
import { validateApiRole, validateHttpMethod } from "@/lib/services/api-auth";
import { getCurrentSession } from "@/lib/services/api-session";
import { disconnectUserEmailConnection } from "@/lib/queries/userEmailConnections";

const mockValidateHttpMethod = validateHttpMethod as jest.MockedFunction<typeof validateHttpMethod>;
const mockValidateApiRole = validateApiRole as jest.MockedFunction<typeof validateApiRole>;
const mockGetCurrentSession = getCurrentSession as jest.MockedFunction<typeof getCurrentSession>;
const mockDisconnectUserEmailConnection = disconnectUserEmailConnection as jest.MockedFunction<typeof disconnectUserEmailConnection>;

async function callPost(req: NextRequest) {
  const response = await POST(req);
  if (!response) throw new Error("POST handler returned undefined");
  return response;
}

describe("POST /api/user-email/google/disconnect", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockValidateHttpMethod.mockReturnValue({ isValidMethod: true, response: undefined });
    mockValidateApiRole.mockResolvedValue({ isAuthorized: true, userRole: 1, response: undefined } as never);
    mockGetCurrentSession.mockResolvedValue({ id: 7, email: "user@test.com", rol_id: 1 } as never);
    mockDisconnectUserEmailConnection.mockResolvedValue(undefined);
  });

  it("disconnects Gmail for the current user", async () => {
    const res = await callPost(new NextRequest("http://localhost/api/user-email/google/disconnect", { method: "POST" }));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.ok).toBe(true);
    expect(mockDisconnectUserEmailConnection).toHaveBeenCalledWith(7);
  });
});

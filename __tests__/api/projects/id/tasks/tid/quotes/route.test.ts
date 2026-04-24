/**
 * @jest-environment node
 */

jest.mock("@/lib/services/api-auth", () => ({
  validateHttpMethod: jest.fn(),
  validateApiRole: jest.fn(),
}));

jest.mock("@/lib/queries/taskQuotes", () => ({
  getTaskQuotes: jest.fn(),
  getTaskQuoteInvitations: jest.fn(),
  inviteExternalToQuote: jest.fn(),
  removeQuoteInvitation: jest.fn(),
}));

jest.mock("next/headers", () => ({
  cookies: jest.fn(),
}));

jest.mock("@/lib/session", () => ({
  decrypt: jest.fn(),
}));

jest.mock("@/lib/services/notificationEngine", () => ({
  NOTIFICATION_EVENTS: {
    QUOTE_REQUESTED: "quote.requested",
  },
  dispatchNotification: jest.fn(),
}));

import { NextRequest } from "next/server";
import { POST } from "@/api/projects/[id]/tasks/[tid]/quotes/route";
import { validateApiRole, validateHttpMethod } from "@/lib/services/api-auth";
import { getTaskQuoteInvitations, inviteExternalToQuote } from "@/lib/queries/taskQuotes";
import { cookies } from "next/headers";
import { decrypt } from "@/lib/session";
import { dispatchNotification } from "@/lib/services/notificationEngine";

const mockValidateHttpMethod = validateHttpMethod as jest.MockedFunction<typeof validateHttpMethod>;
const mockValidateApiRole = validateApiRole as jest.MockedFunction<typeof validateApiRole>;
const mockInviteExternalToQuote = inviteExternalToQuote as jest.MockedFunction<typeof inviteExternalToQuote>;
const mockGetTaskQuoteInvitations = getTaskQuoteInvitations as jest.MockedFunction<typeof getTaskQuoteInvitations>;
const mockCookies = cookies as jest.MockedFunction<typeof cookies>;
const mockDecrypt = decrypt as jest.MockedFunction<typeof decrypt>;
const mockDispatchNotification = dispatchNotification as jest.MockedFunction<typeof dispatchNotification>;

async function callPost(request: NextRequest) {
  const response = await POST(request, { params: Promise.resolve({ id: "15", tid: "10" }) });
  if (!response) throw new Error("POST handler returned undefined");
  return response;
}

describe("POST /api/projects/[id]/tasks/[tid]/quotes notifications", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockValidateHttpMethod.mockReturnValue({ isValidMethod: true, response: undefined });
    mockValidateApiRole.mockResolvedValue({ isAuthorized: true, userRole: 1, response: undefined } as never);
    mockCookies.mockResolvedValue({ get: jest.fn().mockReturnValue({ value: "session-token" }) } as never);
    mockDecrypt.mockResolvedValue({ id: 3, email: "admin@test.com", rol_id: 1 } as never);
    mockInviteExternalToQuote.mockResolvedValue(undefined);
    mockGetTaskQuoteInvitations.mockResolvedValue([]);
    mockDispatchNotification.mockResolvedValue(undefined);
  });

  it("dispatches quote.requested after inviting a collaborator", async () => {
    const request = new NextRequest("http://localhost/api/projects/15/tasks/10/quotes", {
      method: "POST",
      body: JSON.stringify({ user_id: 7 }),
      headers: { "Content-Type": "application/json" },
    });

    const response = await callPost(request);

    expect(response.status).toBe(201);
    expect(mockInviteExternalToQuote).toHaveBeenCalledWith(10, 7, 3);
    expect(mockDispatchNotification).toHaveBeenCalledWith({
      eventType: "quote.requested",
      actorUserId: 3,
      projectId: 15,
      taskId: 10,
      inviteeUserId: 7,
    });
  });
});

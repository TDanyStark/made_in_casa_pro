/**
 * @jest-environment node
 */
// S5: the task quotes list is only visible to non-operations roles with access to the task's project.
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
jest.mock("@/lib/queries/projectTasks", () => ({
  getProjectTaskById: jest.fn(),
}));
jest.mock("@/lib/queries/projects", () => ({
  userCanAccessProject: jest.fn(),
}));
jest.mock("next/headers", () => ({
  cookies: jest.fn(async () => ({ get: () => ({ value: "token" }) })),
}));
jest.mock("@/lib/session", () => ({
  decrypt: jest.fn(async () => ({ id: 21, rol_id: 4 })),
}));
jest.mock("@/lib/services/notificationEngine", () => ({
  NOTIFICATION_EVENTS: { QUOTE_REQUESTED: "quote.requested" },
  dispatchNotification: jest.fn(),
}));

import { NextRequest } from "next/server";
import { GET } from "@/api/projects/[id]/tasks/[tid]/quotes/route";
import { validateApiRole, validateHttpMethod } from "@/lib/services/api-auth";
import { getTaskQuoteInvitations, getTaskQuotes } from "@/lib/queries/taskQuotes";
import { getProjectTaskById } from "@/lib/queries/projectTasks";
import { userCanAccessProject } from "@/lib/queries/projects";

const mockRole = validateApiRole as jest.Mock;
const quotes = [{ id: 1, user_id: 21 }, { id: 2, user_id: 30 }];
const invitations = [{ user_id: 21 }, { user_id: 30 }];

const callGet = () =>
  GET(new NextRequest("http://localhost/api/projects/12/tasks/5/quotes"), {
    params: Promise.resolve({ id: "12", tid: "5" }),
  });

beforeEach(() => {
  jest.clearAllMocks();
  (validateHttpMethod as jest.Mock).mockReturnValue({ isValidMethod: true, response: undefined });
  (getTaskQuotes as jest.Mock).mockResolvedValue(quotes);
  (getTaskQuoteInvitations as jest.Mock).mockResolvedValue(invitations);
  (getProjectTaskById as jest.Mock).mockResolvedValue({ id: 5, project_id: 12 });
});

describe("GET /api/projects/[id]/tasks/[tid]/quotes access", () => {
  it("returns every quote to an operations role (previous behavior)", async () => {
    mockRole.mockResolvedValue({ isAuthorized: true, userRole: 3, response: undefined });

    const res = await callGet();

    expect(res!.status).toBe(200);
    expect(await res!.json()).toEqual({ quotes, invitations });
    expect(userCanAccessProject).not.toHaveBeenCalled();
  });

  it("returns 403 to a collaborator without access and reads no quotes", async () => {
    mockRole.mockResolvedValue({ isAuthorized: true, userRole: 4, response: undefined });
    (userCanAccessProject as jest.Mock).mockResolvedValue(false);

    const res = await callGet();

    expect(res!.status).toBe(403);
    expect(await res!.json()).toEqual({ error: "No tienes acceso a este proyecto" });
    expect(userCanAccessProject).toHaveBeenCalledWith(12, 21, 4);
    expect(getTaskQuotes).not.toHaveBeenCalled();
  });

  it("returns only the collaborator's own quotes when they have access (previous filter)", async () => {
    mockRole.mockResolvedValue({ isAuthorized: true, userRole: 4, response: undefined });
    (userCanAccessProject as jest.Mock).mockResolvedValue(true);

    const res = await callGet();

    expect(res!.status).toBe(200);
    expect(await res!.json()).toEqual({ quotes: [quotes[0]], invitations: [invitations[0]] });
  });

  it("returns 404 to a collaborator when the task does not exist", async () => {
    mockRole.mockResolvedValue({ isAuthorized: true, userRole: 4, response: undefined });
    (getProjectTaskById as jest.Mock).mockResolvedValue(null);

    const res = await callGet();

    expect(res!.status).toBe(404);
    expect(await res!.json()).toEqual({ error: "Tarea no encontrada" });
    expect(getTaskQuotes).not.toHaveBeenCalled();
  });
});

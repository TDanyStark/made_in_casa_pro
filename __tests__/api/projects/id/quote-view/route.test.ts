/**
 * @jest-environment node
 */

jest.mock("@/lib/services/api-auth", () => ({
  validateHttpMethod: jest.fn(),
  validateApiRole: jest.fn(),
}));

jest.mock("@/lib/queries/projects", () => ({
  getProjectDetail: jest.fn(),
}));

jest.mock("@/lib/queries/projectTasks", () => ({
  getTasksForQuoteView: jest.fn(),
  getTasksByProject: jest.fn(),
}));

jest.mock("@/lib/session", () => ({
  decrypt: jest.fn(),
}));

jest.mock("next/headers", () => ({
  cookies: jest.fn(),
}));

import { NextRequest } from "next/server";
import { GET } from "@/api/projects/[id]/quote-view/route";
import { validateApiRole, validateHttpMethod } from "@/lib/services/api-auth";
import { getProjectDetail } from "@/lib/queries/projects";
import { getTasksByProject, getTasksForQuoteView } from "@/lib/queries/projectTasks";
import { decrypt } from "@/lib/session";
import { cookies } from "next/headers";

const mockValidateHttpMethod = validateHttpMethod as jest.MockedFunction<typeof validateHttpMethod>;
const mockValidateApiRole = validateApiRole as jest.MockedFunction<typeof validateApiRole>;
const mockGetProjectDetail = getProjectDetail as jest.MockedFunction<typeof getProjectDetail>;
const mockGetTasksByProject = getTasksByProject as jest.MockedFunction<typeof getTasksByProject>;
const mockGetTasksForQuoteView = getTasksForQuoteView as jest.MockedFunction<typeof getTasksForQuoteView>;
const mockDecrypt = decrypt as jest.MockedFunction<typeof decrypt>;
const mockCookies = cookies as jest.MockedFunction<typeof cookies>;

async function callGet(id = "15") {
  const request = new NextRequest(`http://localhost/api/projects/${id}/quote-view`, {
    method: "GET",
  });

  return GET(request, { params: Promise.resolve({ id }) });
}

describe("GET /api/projects/[id]/quote-view", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockValidateHttpMethod.mockReturnValue({ isValidMethod: true, response: undefined });
    mockValidateApiRole.mockResolvedValue({
      isAuthorized: true,
      userRole: 4 as never,
      response: undefined,
    } as never);
    mockCookies.mockResolvedValue({
      get: jest.fn().mockReturnValue({ value: "session-token" }),
    } as never);
    mockDecrypt.mockResolvedValue({ id: 22 } as never);
  });

  it("authorizes by invitation but returns all tasks for the invited project", async () => {
    mockGetTasksForQuoteView.mockResolvedValue([{ id: 101 }] as never);
    mockGetProjectDetail.mockResolvedValue({ id: 15, title: "Proyecto" } as never);
    mockGetTasksByProject.mockResolvedValue([
      { id: 101, title: "Invitada", status: "in_progress" },
      { id: 202, title: "Contexto", status: "waiting" },
    ] as never);

    const response = await callGet();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(mockGetTasksForQuoteView).toHaveBeenCalledWith(15, 22);
    expect(mockGetTasksByProject).toHaveBeenCalledWith(15);
    expect(data.invited_task_ids).toEqual([101]);
    expect(data.tasks).toEqual([
      { id: 101, title: "Invitada", status: "in_progress" },
      { id: 202, title: "Contexto", status: "waiting" },
    ]);
  });

  it("rejects access when the collaborator has no invitation in the project", async () => {
    mockGetTasksForQuoteView.mockResolvedValue([] as never);

    const response = await callGet();
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.error).toMatch(/no tienes invitación/i);
    expect(mockGetTasksByProject).not.toHaveBeenCalled();
  });
});

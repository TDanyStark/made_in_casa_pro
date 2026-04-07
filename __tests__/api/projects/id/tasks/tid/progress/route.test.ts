/**
 * @jest-environment node
 */

jest.mock("@/lib/services/api-auth", () => ({
  validateHttpMethod: jest.fn(),
  validateApiRole: jest.fn(),
}));

jest.mock("@/lib/queries/projectTasks", () => ({
  getProjectTaskById: jest.fn(),
  updateTaskProgress: jest.fn(),
}));

jest.mock("@/lib/session", () => ({
  decrypt: jest.fn(),
}));

jest.mock("next/headers", () => ({
  cookies: jest.fn(),
}));

import { NextRequest } from "next/server";
import { POST } from "@/api/projects/[id]/tasks/[tid]/progress/route";
import { validateApiRole, validateHttpMethod } from "@/lib/services/api-auth";
import { getProjectTaskById, updateTaskProgress } from "@/lib/queries/projectTasks";
import { decrypt } from "@/lib/session";
import { cookies } from "next/headers";

const mockValidateHttpMethod = validateHttpMethod as jest.MockedFunction<typeof validateHttpMethod>;
const mockValidateApiRole = validateApiRole as jest.MockedFunction<typeof validateApiRole>;
const mockGetProjectTaskById = getProjectTaskById as jest.MockedFunction<typeof getProjectTaskById>;
const mockUpdateTaskProgress = updateTaskProgress as jest.MockedFunction<typeof updateTaskProgress>;
const mockDecrypt = decrypt as jest.MockedFunction<typeof decrypt>;
const mockCookies = cookies as jest.MockedFunction<typeof cookies>;

function makeRequest(body: Record<string, unknown>) {
  return new NextRequest("http://localhost/api/projects/1/tasks/10/progress", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

function makeParams() {
  return { params: Promise.resolve({ id: "1", tid: "10" }) };
}

async function callPost(req: NextRequest) {
  const response = await POST(req, makeParams());
  if (!response) throw new Error("POST handler returned undefined");
  return response;
}

function makeTask(overrides: Record<string, unknown> = {}) {
  return {
    id: 10,
    project_id: 1,
    assigned_user_id: 5,
    status: "in_progress",
    progress_percent: 20,
    progress_minutes: 30,
    ...overrides,
  };
}

describe("POST /progress", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockValidateHttpMethod.mockReturnValue({ isValidMethod: true, response: undefined });
    mockValidateApiRole.mockResolvedValue({
      isAuthorized: true,
      userRole: 4 as never,
      response: undefined,
    } as never);
    mockCookies.mockResolvedValue({
      get: jest.fn().mockReturnValue({ value: "fake-cookie" }),
    } as never);
    mockDecrypt.mockResolvedValue({ id: 5 } as never);
  });

  it("returns 200 when the assigned user reports progress", async () => {
    mockGetProjectTaskById.mockResolvedValue(makeTask() as never);
    mockUpdateTaskProgress.mockResolvedValue(makeTask({ progress_percent: 60, progress_minutes: 90 }) as never);

    const res = await callPost(makeRequest({ progress_percent: 60, additional_minutes: 60 }));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.task.progress_minutes).toBe(90);
    expect(mockUpdateTaskProgress).toHaveBeenCalledWith(10, {
      progress_percent: 60,
      additional_minutes: 60,
    });
  });

  it("returns 403 when a different user tries to report progress", async () => {
    mockGetProjectTaskById.mockResolvedValue(makeTask({ assigned_user_id: 99 }) as never);

    const res = await callPost(makeRequest({ progress_percent: 60, additional_minutes: 60 }));
    const data = await res.json();

    expect(res.status).toBe(403);
    expect(data.error).toMatch(/asignado/i);
    expect(mockUpdateTaskProgress).not.toHaveBeenCalled();
  });

  it("returns 400 when the task is not in progress", async () => {
    mockGetProjectTaskById.mockResolvedValue(makeTask({ status: "not_started" }) as never);

    const res = await callPost(makeRequest({ progress_percent: 60, additional_minutes: 60 }));
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toMatch(/en progreso/i);
  });
});

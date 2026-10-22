/**
 * @jest-environment node
 */

jest.mock("@/lib/services/api-auth", () => ({
  validateHttpMethod: jest.fn(),
  validateApiRole: jest.fn(),
}));

jest.mock("@/lib/queries/projects", () => ({
  getProjectDetail: jest.fn(),
  updateProject: jest.fn(),
  recalculateProjectProgress: jest.fn(),
}));

jest.mock("@/lib/queries/adjustments", () => ({
  resolveTaskAdjustmentId: jest.fn(),
}));

jest.mock("@/lib/queries/projectTasks", () => ({
  instantiateTasksFromTemplates: jest.fn(),
}));

jest.mock("next/headers", () => ({
  cookies: jest.fn(),
}));

jest.mock("@/lib/session", () => ({
  decrypt: jest.fn(),
}));

jest.mock("@/lib/services/notificationEngine", () => ({
  recalculateProgressAndNotify: jest.fn().mockResolvedValue(0),
}));

jest.mock("@/lib/services/projectDriveAccess", () => ({
  syncProjectDriveAccess: jest.fn().mockResolvedValue(null),
}));

import { NextRequest } from "next/server";
import { POST } from "@/api/projects/[id]/products/route";
import { validateApiRole, validateHttpMethod } from "@/lib/services/api-auth";
import { getProjectDetail, updateProject, recalculateProjectProgress } from "@/lib/queries/projects";
import { resolveTaskAdjustmentId } from "@/lib/queries/adjustments";
import { instantiateTasksFromTemplates } from "@/lib/queries/projectTasks";
import { TaskVersionError } from "@/lib/definitions";
import { cookies } from "next/headers";
import { decrypt } from "@/lib/session";

const mockGetProjectDetail = getProjectDetail as jest.MockedFunction<typeof getProjectDetail>;
const mockUpdateProject = updateProject as jest.MockedFunction<typeof updateProject>;
const mockResolve = resolveTaskAdjustmentId as jest.MockedFunction<typeof resolveTaskAdjustmentId>;
const mockInstantiate = instantiateTasksFromTemplates as jest.MockedFunction<typeof instantiateTasksFromTemplates>;

async function callPost(body: Record<string, unknown>) {
  const response = await POST(
    new NextRequest("http://localhost/api/projects/15/products", {
      method: "POST",
      body: JSON.stringify(body),
      headers: { "Content-Type": "application/json" },
    }),
    { params: Promise.resolve({ id: "15" }) }
  );
  if (!response) throw new Error("POST handler returned undefined");
  return response;
}

describe("POST /api/projects/[id]/products — version is mandatory", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (validateHttpMethod as jest.Mock).mockReturnValue({ isValidMethod: true, response: undefined });
    (validateApiRole as jest.Mock).mockResolvedValue({ isAuthorized: true, userRole: 1, response: undefined });
    (recalculateProjectProgress as jest.Mock).mockResolvedValue(undefined);
    (cookies as jest.Mock).mockResolvedValue({ get: jest.fn().mockReturnValue({ value: "token" }) });
    (decrypt as jest.Mock).mockResolvedValue({ id: 3 });
    mockGetProjectDetail.mockResolvedValue({ id: 15, product_id: null, created_by: 3 } as never);
    mockUpdateProject.mockResolvedValue(undefined as never);
    mockInstantiate.mockResolvedValue(undefined);
  });

  it("instantiates template tasks on the base version resolved by the shared helper", async () => {
    mockResolve.mockResolvedValue(5);

    const res = await callPost({ product_id: 8 });

    expect(res.status).toBe(201);
    expect(mockResolve).toHaveBeenCalledWith(15);
    expect(mockInstantiate).toHaveBeenCalledWith(15, 8, 3, 5, 3);
  });

  it("returns 400 with the exact message and changes nothing when the project has no version", async () => {
    const message = "El proyecto no tiene una versión. No se puede crear la tarea sin versión.";
    mockResolve.mockRejectedValue(new TaskVersionError(message));

    const res = await callPost({ product_id: 8 });

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: message });
    expect(mockUpdateProject).not.toHaveBeenCalled();
    expect(mockInstantiate).not.toHaveBeenCalled();
  });
});

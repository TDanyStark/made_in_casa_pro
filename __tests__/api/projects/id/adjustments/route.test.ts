/**
 * @jest-environment node
 */

jest.mock("@/lib/services/api-auth", () => ({
  validateHttpMethod: jest.fn(),
  validateApiRole: jest.fn(),
}));

jest.mock("@/lib/queries/projects", () => ({
  getProjectById: jest.fn(),
  recalculateProjectProgress: jest.fn(),
}));

jest.mock("@/lib/queries/adjustments", () => ({
  createProjectAdjustment: jest.fn(),
  getAdjustmentsByProject: jest.fn(),
  resolveTaskAdjustmentId: jest.fn(async (_projectId: number, adjustmentId?: number | null) => adjustmentId),
}));

jest.mock("@/lib/queries/projectTasks", () => ({
  findLeastLoadedInternalCollaborator: jest.fn(),
}));

jest.mock("@/lib/services/googleDrive", () => ({
  createSubFolder: jest.fn(),
}));

jest.mock("@/lib/queries/users", () => ({
  getAdminAndLeadershipEmails: jest.fn(),
}));

jest.mock("@/lib/db", () => ({
  db: {
    execute: jest.fn(),
    transaction: jest.fn(),
  },
}));

jest.mock("next/headers", () => ({
  cookies: jest.fn(),
}));

jest.mock("@/lib/session", () => ({
  decrypt: jest.fn(),
}));

jest.mock("@/lib/services/notificationEngine", () => ({
  NOTIFICATION_EVENTS: {
    TASK_ASSIGNED: "task.assigned",
    TASK_READY: "task.ready",
    QUOTE_REQUESTED: "quote.requested",
    PROJECT_ADJUSTMENT_CREATED: "project.adjustment.created",
  },
  dispatchNotification: jest.fn(),
}));

jest.mock("@/lib/services/projectDriveAccess", () => ({
  syncProjectDriveAccess: jest.fn().mockResolvedValue(null),
}));

import { NextRequest } from "next/server";
import { POST } from "@/api/projects/[id]/adjustments/route";
import { validateApiRole, validateHttpMethod } from "@/lib/services/api-auth";
import { getProjectById, recalculateProjectProgress } from "@/lib/queries/projects";
import { createProjectAdjustment, getAdjustmentsByProject, resolveTaskAdjustmentId } from "@/lib/queries/adjustments";
import { TaskVersionError } from "@/lib/definitions";
import { db } from "@/lib/db";
import { cookies } from "next/headers";
import { decrypt } from "@/lib/session";
import { dispatchNotification } from "@/lib/services/notificationEngine";

const mockValidateHttpMethod = validateHttpMethod as jest.MockedFunction<typeof validateHttpMethod>;
const mockValidateApiRole = validateApiRole as jest.MockedFunction<typeof validateApiRole>;
const mockGetProjectById = getProjectById as jest.MockedFunction<typeof getProjectById>;
const mockRecalculate = recalculateProjectProgress as jest.MockedFunction<typeof recalculateProjectProgress>;
const mockCreateAdjustment = createProjectAdjustment as jest.MockedFunction<typeof createProjectAdjustment>;
const mockGetAdjustments = getAdjustmentsByProject as jest.MockedFunction<typeof getAdjustmentsByProject>;
const mockDbTransaction = db.transaction as jest.MockedFunction<typeof db.transaction>;
const mockCookies = cookies as jest.MockedFunction<typeof cookies>;
const mockDecrypt = decrypt as jest.MockedFunction<typeof decrypt>;
const mockDispatch = dispatchNotification as jest.MockedFunction<typeof dispatchNotification>;

async function callPost(body: Record<string, unknown>) {
  const response = await POST(
    new NextRequest("http://localhost/api/projects/15/adjustments", {
      method: "POST",
      body: JSON.stringify(body),
      headers: { "Content-Type": "application/json" },
    }),
    { params: Promise.resolve({ id: "15" }) }
  );
  if (!response) throw new Error("POST handler returned undefined");
  return response;
}

describe("POST /api/projects/[id]/adjustments task notifications", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockValidateHttpMethod.mockReturnValue({ isValidMethod: true, response: undefined });
    mockValidateApiRole.mockResolvedValue({ isAuthorized: true, userRole: 1, response: undefined } as never);
    mockGetProjectById.mockResolvedValue({
      id: 15,
      status: "completed",
      drive_folder_id: null,
      product_id: null,
      created_by: 3,
    } as never);
    mockGetAdjustments.mockResolvedValue([{ id: 1, version_number: 1, status: "completed" }] as never);
    mockCreateAdjustment.mockResolvedValue({ id: 50, version_number: 2, notes: null } as never);
    mockRecalculate.mockResolvedValue(undefined as never);
    mockCookies.mockResolvedValue({ get: jest.fn().mockReturnValue({ value: "session-token" }) } as never);
    mockDecrypt.mockResolvedValue({ id: 3, email: "admin@test.com", rol_id: 1 } as never);
    mockDispatch.mockResolvedValue(undefined);

    let nextId = 100;
    const transaction = {
      execute: jest.fn().mockImplementation(() => Promise.resolve({ rows: [{ id: nextId++ }] })),
      commit: jest.fn().mockResolvedValue(undefined),
      rollback: jest.fn().mockResolvedValue(undefined),
    };
    mockDbTransaction.mockResolvedValue(transaction as never);
  });

  it("sends task.assigned then task.ready for the first (not_started) task and only task.assigned for waiting tasks", async () => {
    const res = await callPost({
      tasks: [
        { title: "Primera", assigned_user_id: 7 },
        { title: "Segunda", assigned_user_id: 8 },
      ],
    });

    expect(res.status).toBe(201);
    const taskEvents = mockDispatch.mock.calls
      .map(([input]) => input)
      .filter((input) => input.eventType !== "project.adjustment.created")
      .map((input) => [input.eventType, "taskId" in input ? input.taskId : null]);
    expect(taskEvents).toEqual([
      ["task.assigned", 100],
      ["task.ready", 100],
      ["task.assigned", 101],
    ]);
    expect(mockDispatch).toHaveBeenCalledWith({
      eventType: "task.ready",
      actorUserId: 3,
      projectId: 15,
      taskId: 100,
    });
  });

  it("does not send task.ready when the first task has no assignee", async () => {
    const res = await callPost({
      tasks: [
        { title: "Primera sin responsable" },
        { title: "Segunda", assigned_user_id: 8 },
      ],
    });

    expect(res.status).toBe(201);
    const types = mockDispatch.mock.calls.map(([input]) => input.eventType);
    expect(types).not.toContain("task.ready");
    expect(types).toContain("task.assigned");
  });

  it("passes the new version to the shared version helper and inserts every task with it", async () => {
    const res = await callPost({ tasks: [{ title: "Primera", assigned_user_id: 7 }] });

    expect(res.status).toBe(201);
    expect(resolveTaskAdjustmentId).toHaveBeenCalledWith(15, 50, expect.anything());
    const tx = await mockDbTransaction.mock.results[0].value;
    const insert = (tx.execute as jest.Mock).mock.calls.find(([q]) => q.sql.includes("INSERT INTO project_tasks"));
    expect(insert[0].args[11]).toBe(50);
  });

  it("returns 400 with the exact message when the version cannot be used for tasks", async () => {
    const message = "La versión indicada no pertenece al proyecto.";
    (resolveTaskAdjustmentId as jest.Mock).mockRejectedValueOnce(new TaskVersionError(message));

    const res = await callPost({ tasks: [{ title: "Primera", assigned_user_id: 7 }] });

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: message });
  });
});

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
  recalculateProgressAndNotify: jest.fn().mockResolvedValue(0),
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
import { createSubFolder } from "@/lib/services/googleDrive";
import { getAdminAndLeadershipEmails } from "@/lib/queries/users";
import { NextResponse } from "next/server";
import { OPERATIONS_ROLES } from "@/lib/role-groups";

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
    mockGetAdjustments.mockResolvedValue([
      { id: 1, version_number: 1, status: "completed", task_count: 2, completed_task_count: 2 },
    ] as never);
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

describe("POST /api/projects/[id]/adjustments eligibility from real latest-version tasks", () => {
  const INELIGIBLE = "No se puede crear un ajuste hasta que todas las tareas de la última versión estén completadas.";

  beforeEach(() => {
    jest.clearAllMocks();
    mockValidateHttpMethod.mockReturnValue({ isValidMethod: true, response: undefined });
    mockValidateApiRole.mockResolvedValue({ isAuthorized: true, userRole: 1, response: undefined } as never);
    mockGetProjectById.mockResolvedValue({
      id: 15,
      status: "completed",
      drive_folder_id: "drive-root",
      product_id: null,
      created_by: 3,
    } as never);
    mockCreateAdjustment.mockResolvedValue({ id: 50, version_number: 2, notes: null } as never);
    mockCookies.mockResolvedValue({ get: jest.fn().mockReturnValue({ value: "session-token" }) } as never);
    mockDecrypt.mockResolvedValue({ id: 3, email: "admin@test.com", rol_id: 1 } as never);
    (getAdminAndLeadershipEmails as jest.Mock).mockResolvedValue([]);
    (createSubFolder as jest.Mock).mockResolvedValue({ folderId: "f2", folderUrl: "https://drive/f2" });
  });

  function expectNoSideEffects() {
    expect(createSubFolder).not.toHaveBeenCalled();
    expect(getAdminAndLeadershipEmails).not.toHaveBeenCalled();
    expect(mockCreateAdjustment).not.toHaveBeenCalled();
    expect(mockDbTransaction).not.toHaveBeenCalled();
    expect(db.execute).not.toHaveBeenCalled();
    expect(mockDispatch).not.toHaveBeenCalled();
  }

  it.each(["active", "in_adjustments", "completed"])(
    "creates the adjustment in a %s project when every latest task is completed, whatever the stored statuses",
    async (projectStatus) => {
      mockGetProjectById.mockResolvedValueOnce({
        id: 15, status: projectStatus, drive_folder_id: "drive-root", product_id: null, created_by: 3,
      } as never);
      mockGetAdjustments.mockResolvedValue([
        { id: 1, version_number: 1, status: "active", task_count: "3", completed_task_count: "3" },
      ] as never);

      const res = await callPost({ tasks: [{ title: "Primera", assigned_user_id: 7 }] });

      expect(res.status).toBe(201);
      expect(createSubFolder).toHaveBeenCalledWith(expect.objectContaining({ folderName: "v2" }));
      expect(mockCreateAdjustment).toHaveBeenCalledTimes(1);
    }
  );

  it.each([
    ["unfinished latest tasks despite completed statuses", [{ id: 1, version_number: 1, status: "completed", task_count: 3, completed_task_count: 2 }]],
    ["an empty latest version", [{ id: 1, version_number: 1, status: "completed", task_count: 0, completed_task_count: 0 }]],
    ["no version at all", []],
    [
      "an older completed version and an unfinished latest one",
      [
        { id: 1, version_number: 1, status: "completed", task_count: 2, completed_task_count: 2 },
        { id: 2, version_number: 2, status: "completed", task_count: 2, completed_task_count: 1 },
      ],
    ],
  ])("rejects %s with 400 before any write or Drive call", async (_label, versions) => {
    mockGetAdjustments.mockResolvedValue(versions as never);

    const res = await callPost({ tasks: [{ title: "Primera", assigned_user_id: 7 }] });

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: INELIGIBLE });
    expectNoSideEffects();
  });

  it("uses the latest version even when an older one is unfinished", async () => {
    mockGetAdjustments.mockResolvedValue([
      { id: 1, version_number: 1, status: "active", task_count: 2, completed_task_count: 1 },
      { id: 2, version_number: 2, status: "completed", task_count: 1, completed_task_count: 1 },
    ] as never);

    const res = await callPost({ tasks: [{ title: "Primera", assigned_user_id: 7 }] });

    expect(res.status).toBe(201);
    expect(createSubFolder).toHaveBeenCalledWith(expect.objectContaining({ folderName: "v3" }));
  });

  it.each([
    ["no tasks field and no product templates", {}],
    ["an empty task list and no product templates", { tasks: [] }],
  ])("rejects %s with 400 before any write or Drive call", async (_label, body) => {
    mockGetAdjustments.mockResolvedValue([
      { id: 1, version_number: 1, status: "completed", task_count: 1, completed_task_count: 1 },
    ] as never);

    const res = await callPost(body);

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "No se puede crear una versión sin tareas. Agrega al menos una tarea." });
    expectNoSideEffects();
  });

  it("rejects an empty task list when the product has no templates, after reading them", async () => {
    mockGetProjectById.mockResolvedValueOnce({
      id: 15, status: "completed", drive_folder_id: "drive-root", product_id: 9, created_by: 3,
    } as never);
    mockGetAdjustments.mockResolvedValue([
      { id: 1, version_number: 1, status: "completed", task_count: 1, completed_task_count: 1 },
    ] as never);
    (db.execute as jest.Mock).mockResolvedValueOnce({ rows: [] });

    const res = await callPost({ tasks: [] });

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "No se puede crear una versión sin tareas. Agrega al menos una tarea." });
    expect(db.execute).toHaveBeenCalledTimes(1);
    expect(createSubFolder).not.toHaveBeenCalled();
    expect(mockCreateAdjustment).not.toHaveBeenCalled();
    expect(mockDbTransaction).not.toHaveBeenCalled();
  });

  it("keeps the operations role check before anything else", async () => {
    const denied = NextResponse.json({ error: "No autorizado" }, { status: 403 });
    mockValidateApiRole.mockResolvedValueOnce({ isAuthorized: false, response: denied } as never);

    const res = await callPost({});

    expect(res.status).toBe(403);
    expect(mockValidateApiRole).toHaveBeenCalledWith(expect.anything(), OPERATIONS_ROLES);
    expect(mockGetProjectById).not.toHaveBeenCalled();
    expectNoSideEffects();
  });
});

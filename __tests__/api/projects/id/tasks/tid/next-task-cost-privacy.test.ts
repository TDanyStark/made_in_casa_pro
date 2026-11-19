/**
 * @jest-environment node
 */
// Completing or approving a task returns the next task; its cost belongs to
// another collaborator and must stay hidden outside operations roles.
jest.mock("@/lib/session", () => ({ decrypt: jest.fn(async () => ({ id: 21, rol_id: 4 })) }));
jest.mock("next/headers", () => ({ cookies: jest.fn(async () => ({ get: () => ({ value: "c" }) })) }));
jest.mock("@/lib/services/api-auth", () => ({
  validateHttpMethod: jest.fn(() => ({ isValidMethod: true })),
  validateApiRole: jest.fn(),
}));
jest.mock("@/lib/queries/projectTasks", () => ({
  getProjectTaskById: jest.fn(),
  completeTask: jest.fn(),
  validateTask: jest.fn(),
}));
jest.mock("@/lib/services/notificationEngine", () => ({
  dispatchNotification: jest.fn(),
  recalculateProgressAndNotify: jest.fn(),
  NOTIFICATION_EVENTS: {},
}));

import { NextRequest } from "next/server";
import { POST as completePost } from "@/api/projects/[id]/tasks/[tid]/complete/route";
import { POST as validatePost } from "@/api/projects/[id]/tasks/[tid]/validate/route";
import { validateApiRole } from "@/lib/services/api-auth";
import { completeTask, getProjectTaskById, validateTask } from "@/lib/queries/projectTasks";

const ownTask = { id: 10, assigned_user_id: 21, completion_cost: 300000 };
const othersTask = { id: 11, assigned_user_id: 33, status: "completed", completion_cost: 450000 };

function actAs(role: number) {
  (validateApiRole as jest.Mock).mockResolvedValue({ isAuthorized: true, userRole: role });
}

function post(path: string, body: unknown) {
  return new NextRequest(`http://localhost/api/projects/1/tasks/10/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const ctx = { params: Promise.resolve({ id: "1", tid: "10" }) };

beforeEach(() => {
  jest.clearAllMocks();
});

describe("POST /api/projects/[id]/tasks/[tid]/complete — next task cost", () => {
  beforeEach(() => {
    (getProjectTaskById as jest.Mock).mockResolvedValue({
      id: 10,
      project_id: 1,
      assigned_user_id: 21,
      task_type: "execution",
      requires_quote: 0,
      assigned_user_is_internal: 1,
    });
    (completeTask as jest.Mock).mockResolvedValue({
      task: ownTask,
      nextTask: othersTask,
      blockedReason: null,
      nextActivated: false,
      nextCompleted: true,
    });
  });

  it("hides the next task cost from a COLABORADOR and keeps their own", async () => {
    actAs(4);
    const res = (await completePost(post("complete", { progress_minutes: 30 }), ctx))!;
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.task).toEqual(ownTask);
    expect(body.nextTask).toEqual({ ...othersTask, completion_cost: null });
  });

  it("keeps the next task cost for an operations role (previous behavior)", async () => {
    actAs(1);
    const res = (await completePost(post("complete", { progress_minutes: 30 }), ctx))!;
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.nextTask).toEqual(othersTask);
  });
});

describe("POST /api/projects/[id]/tasks/[tid]/validate — target task cost", () => {
  beforeEach(() => {
    (getProjectTaskById as jest.Mock).mockResolvedValue({
      id: 10,
      project_id: 1,
      assigned_user_id: 21,
      task_type: "validation",
    });
    (validateTask as jest.Mock).mockResolvedValue({
      task: ownTask,
      targetTask: othersTask,
      blockedReason: null,
      nextCompleted: false,
    });
  });

  it("hides the target task cost from a COLABORADOR and keeps their own", async () => {
    actAs(4);
    const res = (await validatePost(post("validate", { action: "approve" }), ctx))!;
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.task).toEqual(ownTask);
    expect(body.targetTask).toEqual({ ...othersTask, completion_cost: null });
  });

  it("hides the correction task cost on reject and keeps a null targetTask null", async () => {
    actAs(4);
    (validateTask as jest.Mock).mockResolvedValue({ task: ownTask, targetTask: othersTask, targetActivated: true, nextCompleted: false });
    let body = await (await validatePost(post("validate", { action: "reject", targetTaskId: 11 }), ctx))!.json();
    expect(body.targetTask).toEqual({ ...othersTask, completion_cost: null });
    expect(body.task).toEqual(ownTask);

    (validateTask as jest.Mock).mockResolvedValue({ task: ownTask, targetTask: null, blockedReason: "x" });
    body = await (await validatePost(post("validate", { action: "approve" }), ctx))!.json();
    expect(body.targetTask).toBeNull();
    expect(body.blockedReason).toBe("x");
  });

  it.each([2, 3, 5])("operations role %i keeps the target task cost", async (role) => {
    actAs(role);
    const res = (await validatePost(post("validate", { action: "approve" }), ctx))!;
    expect((await res.json()).targetTask).toEqual(othersTask);
  });

  it("keeps the target task cost for an operations role (previous behavior)", async () => {
    actAs(1);
    const res = (await validatePost(post("validate", { action: "approve" }), ctx))!;
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.targetTask).toEqual(othersTask);
  });
});

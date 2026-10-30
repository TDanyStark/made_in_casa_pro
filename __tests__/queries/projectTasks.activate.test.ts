// S5: activateWaitingTask() moves a waiting task to not_started.
const mockTransaction = { execute: jest.fn(), commit: jest.fn(), rollback: jest.fn() };
jest.mock("@/lib/db", () => ({
  db: { execute: jest.fn(), transaction: jest.fn(() => Promise.resolve(mockTransaction)) },
}));
jest.mock("next/cache", () => ({ revalidatePath: jest.fn() }));

import { db } from "@/lib/db";
import { activateWaitingTask } from "@/lib/queries/projectTasks";

const mockExecute = db.execute as jest.Mock;
const result = (rows: Record<string, unknown>[]) => ({ rows, columns: [], columnTypes: [], rowsAffected: rows.length, toJSON: () => ({}) });

beforeEach(() => {
  jest.clearAllMocks();
  mockExecute.mockReset();
  mockTransaction.execute.mockReset();
  mockTransaction.commit.mockResolvedValue(undefined);
  mockTransaction.rollback.mockResolvedValue(undefined);
});

describe("activateWaitingTask()", () => {
  it("sets the task to not_started with today's assigned date and logs the transition", async () => {
    mockTransaction.execute
      .mockResolvedValueOnce(result([{ status: "waiting", assigned_user_id: 8, project_id: 1, task_flag: "new" }]))
      .mockResolvedValue(result([]));
    mockExecute.mockResolvedValueOnce(result([{ id: 10, project_id: 1, status: "not_started" }]));

    await activateWaitingTask(10, 5);

    const sqls = mockTransaction.execute.mock.calls.map(([q]) => q.sql as string);
    expect(sqls[0]).toMatch(/FOR UPDATE/);
    expect(sqls[1]).toMatch(/SET status = 'not_started', assigned_at = CURRENT_TIMESTAMP/);
    expect(sqls[2]).toMatch(/INSERT INTO task_transitions/);
    expect(mockTransaction.execute.mock.calls[2][0].args).toEqual([10, 1, "waiting", "new", 5, "Activada manualmente"]);
    expect(mockTransaction.commit).toHaveBeenCalled();
  });

  it("rejects a task that is not waiting with 409 and writes nothing", async () => {
    mockTransaction.execute.mockResolvedValueOnce(result([{ status: "not_started", assigned_user_id: 8, project_id: 1, task_flag: "new" }]));

    await expect(activateWaitingTask(10, 5)).rejects.toMatchObject({
      name: "TaskRuleError",
      status: 409,
      message: "Solo se pueden activar tareas en espera",
    });
    expect(mockTransaction.execute).toHaveBeenCalledTimes(1);
    expect(mockTransaction.rollback).toHaveBeenCalled();
    expect(mockTransaction.commit).not.toHaveBeenCalled();
  });

  it("rejects a waiting task without assignee with 400 and writes nothing", async () => {
    mockTransaction.execute.mockResolvedValueOnce(result([{ status: "waiting", assigned_user_id: null, project_id: 1, task_flag: "new" }]));

    await expect(activateWaitingTask(10, 5)).rejects.toMatchObject({
      status: 400,
      message: "Asigna un colaborador antes de activar la tarea",
    });
    expect(mockTransaction.execute).toHaveBeenCalledTimes(1);
    expect(mockTransaction.commit).not.toHaveBeenCalled();
  });
});

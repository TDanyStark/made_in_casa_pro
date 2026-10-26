/**
 * S36 (bug review round 2): editing a task writes the quoter invitations and the
 * task row in one transaction; a failure persists neither.
 */
const mockTransaction = {
  execute: jest.fn(),
  commit: jest.fn(),
  rollback: jest.fn(),
};

jest.mock("@/lib/db", () => ({
  db: {
    execute: jest.fn(),
    transaction: jest.fn(() => Promise.resolve(mockTransaction)),
  },
}));

import { db } from "@/lib/db";
import { updateProjectTask } from "@/lib/queries/projectTasks";

type Query = { sql: string; args?: unknown[] };
const mockExecute = db.execute as jest.Mock;
const mockDbTransaction = db.transaction as jest.Mock;
const txCalls = () => mockTransaction.execute.mock.calls.map(([q]) => q as Query);
const directCalls = () => mockExecute.mock.calls.map(([q]) => q as Query);

const task = {
  id: 10,
  project_id: 15,
  title: "Banner",
  assigned_user_id: null,
  status: "blocked",
  task_type: "execution",
  task_flag: "new",
  requires_quote: 1,
  order_index: 2,
  quoter_ids: [],
};

beforeEach(() => {
  jest.clearAllMocks();
  mockExecute.mockReset().mockImplementation(async (q: Query) =>
    /WHERE pt\.id = \$1/.test(q.sql) ? { rows: [task] } : { rows: [] }
  );
  mockTransaction.execute.mockReset().mockResolvedValue({ rows: [] });
  mockTransaction.commit.mockReset().mockResolvedValue(undefined);
  mockTransaction.rollback.mockReset().mockResolvedValue(undefined);
});

describe("updateProjectTask() with quoter invitations (S36)", () => {
  it("writes the task update and the invitation set in the same transaction", async () => {
    await updateProjectTask(10, { title: "Otro" }, 3, { quoterIds: [12, 13] });

    expect(mockDbTransaction).toHaveBeenCalledTimes(1);
    const sqls = txCalls().map((q) => q.sql);
    expect(sqls.some((sql) => /UPDATE project_tasks SET/.test(sql))).toBe(true);
    expect(txCalls()).toContainEqual({ sql: expect.stringContaining("DELETE FROM task_quote_invitations"), args: [10] });
    expect(txCalls()).toContainEqual({ sql: expect.stringContaining("INSERT INTO task_quote_invitations"), args: [10, 12, 3] });
    expect(txCalls()).toContainEqual({ sql: expect.stringContaining("INSERT INTO task_quote_invitations"), args: [10, 13, 3] });
    expect(mockTransaction.commit).toHaveBeenCalledTimes(1);
    expect(directCalls().some((q) => /UPDATE project_tasks|(INSERT INTO|DELETE FROM) task_quote_invitations/.test(q.sql))).toBe(false);
  });

  it("rolls back and persists nothing when saving an invitation fails", async () => {
    mockTransaction.execute.mockImplementation(async (q: Query) => {
      if (/INSERT INTO task_quote_invitations/.test(q.sql)) throw new Error("insert failed");
      return { rows: [] };
    });

    await expect(updateProjectTask(10, { title: "Otro" }, 3, { quoterIds: [12] })).rejects.toThrow("insert failed");

    expect(mockTransaction.rollback).toHaveBeenCalledTimes(1);
    expect(mockTransaction.commit).not.toHaveBeenCalled();
    expect(directCalls().some((q) => /UPDATE project_tasks|(INSERT INTO|DELETE FROM) task_quote_invitations/.test(q.sql))).toBe(false);
  });

  it("rolls back the invitations when the task update fails", async () => {
    mockTransaction.execute.mockImplementation(async (q: Query) => {
      if (/UPDATE project_tasks SET/.test(q.sql)) throw new Error("update failed");
      return { rows: [] };
    });

    await expect(updateProjectTask(10, { title: "Otro" }, 3, { quoterIds: [12] })).rejects.toThrow("update failed");

    expect(mockTransaction.rollback).toHaveBeenCalledTimes(1);
    expect(mockTransaction.commit).not.toHaveBeenCalled();
  });

  it("writes the invitation set even when no task field changes", async () => {
    await updateProjectTask(10, {}, 3, { quoterIds: [] });

    expect(txCalls()).toEqual([{ sql: expect.stringContaining("DELETE FROM task_quote_invitations"), args: [10] }]);
    expect(mockTransaction.commit).toHaveBeenCalledTimes(1);
  });

  it("rejects editing a completed task before writing any invitation", async () => {
    mockExecute.mockImplementation(async () => ({ rows: [{ ...task, status: "completed" }] }));

    await expect(updateProjectTask(10, { title: "Otro" }, 3, { quoterIds: [12] })).rejects.toThrow(
      "No se pueden editar tareas completadas."
    );
    expect(mockDbTransaction).not.toHaveBeenCalled();
  });

  it("updates without a transaction when no invitations are sent (previous behavior)", async () => {
    await updateProjectTask(10, { title: "Otro" }, 3);

    expect(mockDbTransaction).not.toHaveBeenCalled();
    expect(directCalls()).toContainEqual({ sql: expect.stringMatching(/UPDATE project_tasks SET title = \$1/), args: ["Otro", 10] });
  });
});

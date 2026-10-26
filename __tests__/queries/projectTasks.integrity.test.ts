/**
 * Bug review fixes (odd/tasks/bug-review-fixes.md):
 *   S12 completing keeps the stored minutes / cost / delivery url when not sent.
 *   S16 complete and validation rejection lock and re-check inside the transaction;
 *       a rejection target at or after the validation task is a 400.
 *   S17 order_index is computed inside the insert transaction with a project lock.
 *   S19 quoter invitations are saved in the same transaction as the task.
 *   S21 no value is interpolated into the SQL text.
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
import {
  completeTask,
  createProjectTask,
  createRejectionLoopTasks,
  deleteProjectTask,
  reorderProjectTasks,
  startTask,
  validateTask,
} from "@/lib/queries/projectTasks";

type Query = string | { sql: string; args?: unknown[] };
const sqlOf = (q: Query) => (typeof q === "string" ? q : q.sql);
const argsOf = (q: Query) => (typeof q === "string" ? [] : q.args ?? []);

const mockExecute = db.execute as jest.Mock;
const mockDbTransaction = db.transaction as jest.Mock;

function txCalls(): Query[] {
  return mockTransaction.execute.mock.calls.map(([q]) => q as Query);
}
function txCall(pattern: RegExp): Query | undefined {
  return txCalls().find((q) => pattern.test(sqlOf(q)));
}
function allSql(): string[] {
  return [...mockExecute.mock.calls, ...mockTransaction.execute.mock.calls].map(([q]) => sqlOf(q as Query));
}

function taskRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    project_id: 1,
    assigned_user_id: 5,
    status: "in_progress",
    task_type: "execution",
    task_flag: "new",
    requires_quote: 0,
    order_index: 0,
    adjustment_id: 7,
    quoter_ids: [],
    ...overrides,
  };
}

/** db.execute answers getProjectTaskById with `task` (and re-reads with the same row). */
function routeTaskReads(task: Record<string, unknown>) {
  mockExecute.mockImplementation(async (q: Query) =>
    /WHERE pt\.id = \$1/.test(sqlOf(q)) ? { rows: [{ ...task, id: argsOf(q)[0] }] } : { rows: [] }
  );
}

/** Transaction answers: a locked row for FOR UPDATE reads, ids for inserts. */
function routeTx(answers: Array<[RegExp, Record<string, unknown>[]]> = []) {
  mockTransaction.execute.mockImplementation(async (q: Query) => {
    const sql = sqlOf(q);
    for (const [pattern, rows] of answers) if (pattern.test(sql)) return { rows };
    if (/INSERT INTO project_tasks/.test(sql)) return { rows: [{ id: 88 }] };
    return { rows: [] };
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockExecute.mockReset();
  mockTransaction.execute.mockReset();
  mockTransaction.commit.mockReset().mockResolvedValue(undefined);
  mockTransaction.rollback.mockReset().mockResolvedValue(undefined);
});

// ─── S12 ────────────────────────────────────────────────────────────────────

describe("completeTask() keeps stored values that are not sent (S12)", () => {
  const LOCKED = /FROM project_tasks\s+WHERE id = \$1\s+FOR UPDATE/;

  it("approving a validation keeps progress_minutes, completion_cost and delivery_url", async () => {
    routeTaskReads(taskRow({ task_type: "validation" }));
    routeTx([[LOCKED, [{ status: "in_progress" }]]]);

    await validateTask(1, 5, "approve");

    const update = txCall(/SET status = 'completed'/)!;
    expect(sqlOf(update)).toMatch(/progress_minutes = COALESCE\(\$2, progress_minutes\)/);
    expect(sqlOf(update)).toMatch(/delivery_url = COALESCE\(\$3, delivery_url\)/);
    expect(sqlOf(update)).toMatch(/completion_cost = COALESCE\(\$4, completion_cost\)/);
    expect(argsOf(update).slice(0, 4)).toEqual([1, null, null, null]);
  });

  it("replaces progress_minutes with the total sent on complete", async () => {
    routeTaskReads(taskRow());
    routeTx([[LOCKED, [{ status: "in_progress" }]]]);

    await completeTask(1, 5, null, { progress_minutes: 240, delivery_url: "https://x.test", completion_cost: 0 });

    expect(argsOf(txCall(/SET status = 'completed'/)!).slice(0, 4)).toEqual([1, 240, "https://x.test", 0]);
  });
});

// ─── S16 ────────────────────────────────────────────────────────────────────

describe("completeTask() locks and re-checks the task inside the transaction (S16)", () => {
  it("locks the task row before updating it", async () => {
    routeTaskReads(taskRow());
    routeTx([[/FOR UPDATE/, [{ status: "in_progress" }]]]);

    await completeTask(1, 5, null, { progress_minutes: 10 });

    const calls = txCalls().map(sqlOf);
    const lock = calls.findIndex((sql) => /FROM project_tasks\s+WHERE id = \$1\s+FOR UPDATE/.test(sql));
    const update = calls.findIndex((sql) => /SET status = 'completed'/.test(sql));
    expect(lock).toBe(0);
    expect(argsOf(txCalls()[0])).toEqual([1]);
    expect(update).toBeGreaterThan(lock);
    expect(mockTransaction.commit).toHaveBeenCalledTimes(1);
  });

  it("rejects with 409 and writes nothing when a concurrent request already completed it", async () => {
    routeTaskReads(taskRow());
    routeTx([[/FOR UPDATE/, [{ status: "completed" }]]]);

    await expect(completeTask(1, 5, null, { progress_minutes: 10 })).rejects.toMatchObject({
      message: "Solo se pueden completar tareas en progreso",
      status: 409,
    });
    expect(txCalls()).toHaveLength(1);
    expect(mockTransaction.commit).not.toHaveBeenCalled();
    expect(mockTransaction.rollback).toHaveBeenCalledTimes(1);
  });
});

describe("createRejectionLoopTasks() (S16)", () => {
  function routeRejection(
    target: { id: number; order_index: number; adjustment_id?: number | null },
    lockedStatus = "in_progress"
  ) {
    mockExecute.mockImplementation(async (q: Query) => {
      const sql = sqlOf(q);
      if (sql.includes("SELECT id, order_index, task_flag, status, adjustment_id FROM project_tasks")) {
        return { rows: [{ id: 10, order_index: 3, task_flag: "new", status: "in_progress", adjustment_id: 7 }] };
      }
      if (/SELECT id, order_index(, adjustment_id)? FROM project_tasks/.test(sql)) {
        return { rows: [{ adjustment_id: 7, ...target }] };
      }
      if (sql.includes("SELECT * FROM project_tasks")) {
        return {
          rows: [
            { id: 7, title: "M", task_type: "execution", order_index: 2, assigned_user_id: 6 },
            { id: 10, title: "N", task_type: "validation", order_index: 3, assigned_user_id: 5 },
          ],
        };
      }
      if (sql.includes("FROM project_adjustments")) return { rows: [{ id: 7 }] };
      if (/WHERE pt\.id = \$1/.test(sql)) return { rows: [taskRow({ id: argsOf(q)[0] })] };
      return { rows: [] };
    });
    routeTx([[/FOR UPDATE/, [{ status: lockedStatus }]]]);
  }

  it.each([
    ["after", 5],
    ["equal to", 3],
  ])("rejects a target whose order is %s the validation task with 400 and writes nothing", async (_label, order) => {
    routeRejection({ id: 12, order_index: order });

    await expect(createRejectionLoopTasks(1, 10, 12, 5)).rejects.toMatchObject({
      message: "La tarea a corregir debe estar antes de la validación",
      status: 400,
    });
    expect(mockDbTransaction).not.toHaveBeenCalled();
    expect(allSql().some((sql) => /INSERT INTO|UPDATE project_tasks/.test(sql))).toBe(false);
  });

  it("locks the validation task and rejects with 409 when it was already resolved concurrently", async () => {
    routeRejection({ id: 7, order_index: 2 }, "completed");

    await expect(createRejectionLoopTasks(1, 10, 7, 5)).rejects.toMatchObject({
      message: "La tarea de validación ya fue resuelta",
      status: 409,
    });
    expect(sqlOf(txCalls()[0])).toMatch(/FOR UPDATE/);
    expect(argsOf(txCalls()[0])).toEqual([10]);
    expect(txCalls().some((q) => /INSERT INTO|UPDATE project_tasks/.test(sqlOf(q)))).toBe(false);
    expect(mockTransaction.rollback).toHaveBeenCalledTimes(1);
  });

  it("creates the correction clones for a target before the validation task (previous behavior)", async () => {
    routeRejection({ id: 7, order_index: 2 });

    const result = await createRejectionLoopTasks(1, 10, 7, 5);

    expect(txCalls().filter((q) => /INSERT INTO project_tasks/.test(sqlOf(q)))).toHaveLength(2);
    expect(mockTransaction.commit).toHaveBeenCalledTimes(1);
    expect(result.firstCorrectionTask.id).toBe(88);
  });

  // S37: the task sent back must belong to the validation task's version.
  it.each([
    ["another version", 8],
    ["no version (legacy)", null],
  ])("rejects a target from %s with 400 and writes nothing", async (_label, adjustmentId) => {
    routeRejection({ id: 7, order_index: 2, adjustment_id: adjustmentId });

    await expect(createRejectionLoopTasks(1, 10, 7, 5)).rejects.toMatchObject({
      name: "TaskRuleError",
      message: "La tarea a corregir debe pertenecer a la misma versión",
      status: 400,
    });
    expect(mockDbTransaction).not.toHaveBeenCalled();
    expect(allSql().some((sql) => /INSERT INTO|UPDATE project_tasks/.test(sql))).toBe(false);
  });
});

// ─── S21 ────────────────────────────────────────────────────────────────────

describe("no interpolated values in SQL (S21)", () => {
  it("deleteProjectTask() passes the adjustment id as a parameter", async () => {
    routeTaskReads(taskRow({ status: "not_started", adjustment_id: 7 }));
    routeTx();

    await deleteProjectTask(1);

    const select = txCall(/SELECT id, status, assigned_user_id FROM project_tasks/)!;
    expect(sqlOf(select)).toContain("adjustment_id = $2");
    expect(sqlOf(select)).not.toMatch(/adjustment_id = 7/);
    expect(argsOf(select)).toEqual([1, 7]);
  });

  it("reorderProjectTasks() passes the adjustment id as a parameter", async () => {
    mockExecute.mockResolvedValue({ rows: [] });
    routeTx();

    await reorderProjectTasks(1, [3, 4], 7);

    const update = txCall(/SET order_index = \$1/)!;
    expect(sqlOf(update)).toContain("adjustment_id = $4");
    expect(sqlOf(update)).not.toMatch(/adjustment_id = 7/);
    expect(argsOf(update)).toEqual([0, 3, 1, 7]);
  });

  it("startTask() passes the target status as a parameter", async () => {
    routeTx([[/FOR UPDATE/, [{ id: 1, status: "not_started", assigned_user_id: null, project_id: 1, task_flag: "new" }]]]);

    await startTask(1, 5);

    const update = txCall(/UPDATE project_tasks SET status = /)!;
    expect(sqlOf(update)).toContain("SET status = $2");
    expect(sqlOf(update)).not.toContain("'in_progress'");
    expect(argsOf(update)).toEqual([1, "in_progress"]);
  });

  it("completeTask() passes the adjustment id of the next-task lookup as a parameter", async () => {
    routeTaskReads(taskRow({ adjustment_id: 7 }));
    routeTx([[/FOR UPDATE/, [{ status: "in_progress" }]]]);

    await completeTask(1, 5, null, { progress_minutes: 10 });

    const next = txCall(/SELECT id, assigned_user_id, requires_quote, task_flag, status/)!;
    expect(sqlOf(next)).toContain("adjustment_id = $3");
    expect(sqlOf(next)).not.toMatch(/adjustment_id = 7/);
    expect(argsOf(next)).toEqual([1, 1, 7]);
  });
});

// ─── S17 / S19 ──────────────────────────────────────────────────────────────

describe("createProjectTask() computes order and status inside one locked transaction (S17, S19)", () => {
  const ORDER = /COALESCE\(MAX\(order_index\), -1\) \+ 1 AS next_order/;
  const ACTIVE = /AS cnt FROM project_tasks/;

  function routeCreate(nextOrder: number, activeCount = 0) {
    routeTaskReads(taskRow({ id: 88 }));
    routeTx([
      [/FROM project_adjustments/, [{ id: 7 }]],
      [ORDER, [{ next_order: nextOrder }]],
      [ACTIVE, [{ cnt: String(activeCount) }]],
    ]);
  }

  const base = { project_id: 1, title: "Nueva", adjustment_id: 7 };

  it("locks the project before reading the next order_index and inserts with it", async () => {
    routeCreate(4, 1);

    await createProjectTask(base);

    const calls = txCalls().map(sqlOf);
    const lock = calls.findIndex((sql) => /FROM projects WHERE id = \$1 FOR NO KEY UPDATE$/.test(sql));
    const order = calls.findIndex((sql) => ORDER.test(sql));
    const insert = txCall(/INSERT INTO project_tasks/)!;
    expect(lock).toBeGreaterThanOrEqual(0);
    expect(order).toBeGreaterThan(lock);
    expect(argsOf(txCalls()[lock])).toEqual([1]);
    expect(argsOf(txCalls()[order])).toEqual([1, 7]);
    expect(argsOf(insert)[11]).toBe(4); // order_index
    expect(argsOf(insert)[6]).toBe("waiting"); // an active task exists
    expect(mockDbTransaction).toHaveBeenCalledTimes(1);
    expect(mockTransaction.commit).toHaveBeenCalledTimes(1);
  });

  it("starts the first task as not_started", async () => {
    routeCreate(0);
    await createProjectTask(base);
    expect(argsOf(txCall(/INSERT INTO project_tasks/)!)[6]).toBe("not_started");
  });

  it("starts as not_started when every previous task is done, counting blocked/paused as active", async () => {
    routeCreate(2, 0);
    await createProjectTask(base);
    expect(argsOf(txCall(/INSERT INTO project_tasks/)!)[6]).toBe("not_started");
    expect(sqlOf(txCall(ACTIVE)!)).toContain("'blocked'");
    expect(sqlOf(txCall(ACTIVE)!)).toContain("'paused'");
  });

  it("keeps an explicit status (previous behavior)", async () => {
    routeCreate(3, 1);
    await createProjectTask({ ...base, status: "in_progress", assigned_user_id: 9 });
    expect(argsOf(txCall(/INSERT INTO project_tasks/)!)[6]).toBe("in_progress");
  });

  it("blocks a task that requires a quote and has no assignee, logging the transition", async () => {
    routeCreate(0);

    await createProjectTask({ ...base, requires_quote: 1, created_by: 3 });

    expect(argsOf(txCall(/INSERT INTO project_tasks/)!)[6]).toBe("blocked");
    expect(argsOf(txCall(/INSERT INTO task_transitions/)!)).toEqual([
      88, 1, "blocked", "new", 3, "Requiere cotización de colaborador externo",
    ]);
  });

  it("saves the quoter invitations in the same transaction", async () => {
    routeCreate(0);

    await createProjectTask({ ...base, quoter_ids: [12, 13], created_by: 3 });

    const invites = txCalls().filter((q) => /INSERT INTO task_quote_invitations/.test(sqlOf(q)));
    expect(invites.map(argsOf)).toEqual([[88, 12, 3], [88, 13, 3]]);
    expect(mockTransaction.commit).toHaveBeenCalledTimes(1);
  });

  it("rolls back the task when an invitation fails and commits nothing", async () => {
    routeCreate(0);
    const fallback = mockTransaction.execute.getMockImplementation()!;
    mockTransaction.execute.mockImplementation(async (q: Query) => {
      if (/INSERT INTO task_quote_invitations/.test(sqlOf(q))) throw new Error("insert failed");
      return fallback(q);
    });

    await expect(createProjectTask({ ...base, quoter_ids: [12], created_by: 3 })).rejects.toThrow("insert failed");
    expect(mockTransaction.commit).not.toHaveBeenCalled();
    expect(mockTransaction.rollback).toHaveBeenCalledTimes(1);
  });

  it("rejects a validation task in the first position without committing", async () => {
    routeCreate(0);

    await expect(createProjectTask({ ...base, task_type: "validation" })).rejects.toThrow(
      "Una tarea de validación no puede ser la primera tarea del proyecto."
    );
    expect(txCall(/INSERT INTO project_tasks/)).toBeUndefined();
    expect(mockTransaction.commit).not.toHaveBeenCalled();
  });
});

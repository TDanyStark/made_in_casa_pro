/**
 * Bug review fixes (odd/tasks/bug-review-fixes.md):
 *   S13 acceptQuote locks the task inside the transaction and only accepts a
 *       pending quote of a blocked, unassigned task without an accepted quote.
 *   S14 submitQuote rejects closed tasks and never overwrites an accepted quote.
 *   S22 rejectQuote is scoped to the task/project and revalidates the project.
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
import { revalidatePath } from "next/cache";
import { acceptQuote, rejectQuote, submitQuote } from "@/lib/queries/taskQuotes";

type Query = string | { sql: string; args?: unknown[] };
const sqlOf = (q: Query) => (typeof q === "string" ? q : q.sql);
const argsOf = (q: Query) => (typeof q === "string" ? [] : q.args ?? []);

const mockExecute = db.execute as jest.Mock;

function writes(): string[] {
  return [...mockExecute.mock.calls, ...mockTransaction.execute.mock.calls]
    .map(([q]) => sqlOf(q as Query))
    .filter((sql) => /^\s*(INSERT|UPDATE|DELETE)/.test(sql));
}

beforeEach(() => {
  jest.clearAllMocks();
  mockExecute.mockReset();
  mockTransaction.execute.mockReset();
  mockTransaction.commit.mockReset().mockResolvedValue(undefined);
  mockTransaction.rollback.mockReset().mockResolvedValue(undefined);
});

// ─── S13 ────────────────────────────────────────────────────────────────────

describe("acceptQuote() (S13)", () => {
  const scope = { projectId: 15, taskId: 10 };
  const QUOTE = /FROM task_quotes WHERE id = \$1/;
  const TASK_LOCK = /FROM project_tasks WHERE id = \$1 FOR UPDATE/;
  const QUOTES_LOCK = /FROM task_quotes WHERE task_id = \$1 FOR UPDATE/;

  function route({
    quote = { id: 77, task_id: 10, user_id: 8 } as Record<string, unknown> | null,
    task = { id: 10, project_id: 15, status: "blocked", task_flag: "new", assigned_user_id: null } as Record<string, unknown> | null,
    quotes = [{ id: 77, status: "pending" }, { id: 78, status: "pending" }] as Record<string, unknown>[],
  } = {}) {
    mockTransaction.execute.mockImplementation(async (q: Query) => {
      const sql = sqlOf(q);
      if (QUOTE.test(sql)) return { rows: quote ? [quote] : [] };
      if (TASK_LOCK.test(sql)) return { rows: task ? [task] : [] };
      if (QUOTES_LOCK.test(sql)) return { rows: quotes };
      return { rows: [] };
    });
  }

  async function expectRejected(status: number, message: string) {
    await expect(acceptQuote(77, 3, scope)).rejects.toMatchObject({ status, message });
    expect(writes()).toEqual([]);
    expect(mockTransaction.commit).not.toHaveBeenCalled();
    expect(mockTransaction.rollback).toHaveBeenCalledTimes(1);
    expect(revalidatePath).not.toHaveBeenCalled();
  }

  it("reads inside the transaction and locks the task before the quotes, then assigns and activates it", async () => {
    route();

    await acceptQuote(77, 3, scope);

    expect(mockExecute).not.toHaveBeenCalled();
    const sqls = mockTransaction.execute.mock.calls.map(([q]) => sqlOf(q as Query));
    const taskLock = sqls.findIndex((sql) => TASK_LOCK.test(sql));
    const quotesLock = sqls.findIndex((sql) => QUOTES_LOCK.test(sql));
    expect(taskLock).toBeGreaterThan(-1);
    expect(quotesLock).toBeGreaterThan(taskLock);
    const assign = mockTransaction.execute.mock.calls.map(([q]) => q as Query).find((q) => /SET assigned_user_id = \$1, status = 'not_started'/.test(sqlOf(q)))!;
    expect(argsOf(assign)).toEqual([8, 10]);
    expect(mockTransaction.commit).toHaveBeenCalledTimes(1);
    expect(revalidatePath).toHaveBeenCalledWith("/projects/15");
  });

  it("404 when the quote does not exist", async () => {
    route({ quote: null });
    await expectRejected(404, "Cotización no encontrada");
  });

  it("404 when the quote belongs to another task", async () => {
    route({ quote: { id: 77, task_id: 11, user_id: 8 } });
    await expectRejected(404, "Cotización no encontrada");
  });

  it("404 without a TypeError when the task does not exist", async () => {
    route({ task: null });
    await expectRejected(404, "Tarea no encontrada");
  });

  it("404 when the task belongs to another project", async () => {
    route({ task: { id: 10, project_id: 99, status: "blocked", task_flag: "new", assigned_user_id: null } });
    await expectRejected(404, "Tarea no encontrada");
  });

  it("409 when the quote is no longer pending", async () => {
    route({ quotes: [{ id: 77, status: "rejected" }] });
    await expectRejected(409, "La cotización ya no está pendiente");
  });

  it("409 when another quote of the task was already accepted", async () => {
    route({ quotes: [{ id: 77, status: "pending" }, { id: 78, status: "accepted" }] });
    await expectRejected(409, "La tarea ya tiene una cotización aceptada");
  });

  it.each([
    ["in_progress", null],
    ["completed", null],
    ["blocked", 5],
  ])("409 when the task is %s (assignee %s) instead of blocked without assignee", async (status, assignee) => {
    route({ task: { id: 10, project_id: 15, status, task_flag: "new", assigned_user_id: assignee } });
    await expectRejected(409, "La tarea ya no está esperando cotización");
  });
});

// ─── S14 ────────────────────────────────────────────────────────────────────

describe("submitQuote() (S14)", () => {
  const data = { task_id: 10, user_id: 8, price: 500, delivery_days: 2, notes: "<p>Ok</p>" };
  const OPEN = /FROM project_tasks pt[\s\S]*WHERE pt\.id = \$1[\s\S]*FOR UPDATE/;

  function route({ invited = true, open = true, upserted = true } = {}) {
    mockTransaction.execute.mockImplementation(async (q: Query) => {
      const sql = sqlOf(q);
      if (/FROM task_quote_invitations/.test(sql)) return { rows: invited ? [{ id: 1 }] : [] };
      if (OPEN.test(sql)) return { rows: open ? [{ id: 10 }] : [] };
      if (/INSERT INTO task_quotes/.test(sql)) return { rows: upserted ? [{ id: 55 }] : [] };
      return { rows: [] };
    });
    mockExecute.mockResolvedValue({ rows: [{ id: 55, task_id: 10, status: "pending" }] });
  }

  it("rejects with 409 and writes nothing when the task no longer accepts quotes", async () => {
    route({ open: false });

    await expect(submitQuote(data)).rejects.toMatchObject({ status: 409, message: "Esta tarea ya no recibe cotizaciones" });
    expect(writes()).toEqual([]);
    expect(mockTransaction.commit).not.toHaveBeenCalled();
  });

  it("checks the open-task filter on the locked task row", async () => {
    route();
    await submitQuote(data);
    const open = mockTransaction.execute.mock.calls.map(([q]) => q as Query).find((q) => OPEN.test(sqlOf(q)))!;
    expect(sqlOf(open)).toContain("pt.status = 'blocked'");
    expect(sqlOf(open)).toContain("pt.assigned_user_id IS NULL");
    expect(sqlOf(open)).toContain("tq2.status = 'accepted'");
    expect(argsOf(open)).toEqual([10]);
  });

  it("never overwrites an accepted quote: the upsert skips accepted rows and the call is a 409", async () => {
    route({ upserted: false });

    await expect(submitQuote(data)).rejects.toMatchObject({ status: 409, message: "Esta tarea ya no recibe cotizaciones" });
    const upsert = mockTransaction.execute.mock.calls.map(([q]) => sqlOf(q as Query)).find((sql) => /INSERT INTO task_quotes/.test(sql))!;
    expect(upsert).toMatch(/WHERE task_quotes\.status <> 'accepted'/);
    expect(mockTransaction.commit).not.toHaveBeenCalled();
  });

  it("keeps rejecting a user without invitation with the previous message", async () => {
    route({ invited: false });
    await expect(submitQuote(data)).rejects.toThrow("No tienes invitación para cotizar esta tarea");
    expect(writes()).toEqual([]);
  });

  it("saves a quote for an open task (previous behavior)", async () => {
    route();

    const quote = await submitQuote(data);

    expect(quote).toEqual({ id: 55, task_id: 10, status: "pending" });
    expect(mockTransaction.commit).toHaveBeenCalledTimes(1);
  });
});

// ─── S22 ────────────────────────────────────────────────────────────────────

describe("rejectQuote() (S22)", () => {
  const scope = { projectId: 15, taskId: 10 };

  it("rejects the quote of the task/project and revalidates the project", async () => {
    mockExecute
      .mockResolvedValueOnce({ rows: [{ id: 77 }] })
      .mockResolvedValueOnce({ rows: [] });

    await rejectQuote(77, scope);

    expect(argsOf(mockExecute.mock.calls[0][0])).toEqual([77, 10, 15]);
    expect(sqlOf(mockExecute.mock.calls[1][0])).toContain("SET status = 'rejected'");
    expect(argsOf(mockExecute.mock.calls[1][0])).toEqual([77]);
    expect(revalidatePath).toHaveBeenCalledWith("/projects/15");
  });

  it("404 and no update when the quote is not of that task/project", async () => {
    mockExecute.mockResolvedValueOnce({ rows: [] });

    await expect(rejectQuote(77, scope)).rejects.toMatchObject({ status: 404, message: "Cotización no encontrada" });
    expect(writes()).toEqual([]);
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});

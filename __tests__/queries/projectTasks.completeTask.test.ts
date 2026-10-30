/**
 * Tests for completeTask() query function.
 *
 * Bugfix: tasks are strictly sequential per project + adjustment_id. When the
 * task immediately after the one being completed is already 'blocked' (e.g.
 * pending an external quote), completeTask() must NOT skip past it to
 * evaluate/activate a later 'waiting' task — that would let work behind the
 * blocked task cut the queue before the block is resolved.
 */

// Mock transaction object
const mockTransaction = {
  execute: jest.fn(),
  commit: jest.fn(),
  rollback: jest.fn(),
};

// Mock DB (with transaction support) before any imports
jest.mock('@/lib/db', () => ({
  db: {
    execute: jest.fn(),
    transaction: jest.fn(() => Promise.resolve(mockTransaction)),
  },
}));

jest.mock('next/cache', () => ({
  revalidatePath: jest.fn(),
}));

import { db } from '@/lib/db';
import { completeTask } from '@/lib/queries/projectTasks';

const mockExecute = db.execute as jest.MockedFunction<typeof db.execute>;

function makeResult(rows: Record<string, unknown>[], rowsAffected?: number) {
  return {
    rows: rows as never,
    columns: [] as string[],
    columnTypes: [] as string[],
    rowsAffected: rowsAffected ?? rows.length,
    toJSON: () => ({}),
  };
}

// Full task row shape returned by getProjectTaskById (TASK_SELECT)
function makeTaskRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    project_id: 1,
    template_id: null,
    title: 'Task',
    description: null,
    area_id: null,
    area_name: null,
    assigned_user_id: 5,
    assigned_user_name: 'Alice',
    assigned_user_rol_id: 4,
    assigned_user_is_internal: 1,
    status: 'in_progress',
    task_type: 'execution',
    task_flag: 'new',
    requires_quote: 0,
    assign_to_commercial: 0,
    order_index: 0,
    created_at: '2026-01-01',
    updated_at: '2026-01-01',
    assigned_at: null,
    completed_at: null,
    adjustment_id: null,
    delivery_url: null,
    delivery_notes: null,
    completion_cost: null,
    progress_percent: 0,
    progress_minutes: 0,
    quoter_ids: [],
    quote_count: 0,
    pending_quote_count: 0,
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockExecute.mockReset();
  mockTransaction.execute.mockReset();
  mockTransaction.commit.mockReset();
  mockTransaction.rollback.mockReset();
  mockTransaction.commit.mockResolvedValue(undefined);
  mockTransaction.rollback.mockResolvedValue(undefined);
});

describe('completeTask()', () => {
  it('does not promote or block a task past an already-blocked immediate successor', async () => {
    // getProjectTaskById(taskId): the task being completed (order_index 0, in_progress)
    mockExecute.mockResolvedValueOnce(
      makeResult([makeTaskRow({ id: 1, status: 'in_progress', project_id: 1, adjustment_id: null })])
    );

    mockTransaction.execute
      .mockResolvedValueOnce(makeResult([{ status: 'in_progress' }])) // lock + re-check status
      .mockResolvedValueOnce(makeResult([])) // 0. read assignee salary + weekly hours
      .mockResolvedValueOnce(makeResult([])) // 1. UPDATE current task -> completed
      .mockResolvedValueOnce(makeResult([])) // 2. INSERT transition (completed)
      .mockResolvedValueOnce(
        // 3. SELECT immediate next task by order_index — already 'blocked'
        makeResult([
          { id: 2, assigned_user_id: null, requires_quote: 1, task_flag: 'new', status: 'blocked' },
        ])
      );

    // Post-commit re-fetches
    mockExecute.mockResolvedValueOnce(makeResult([makeTaskRow({ id: 1, status: 'completed' })])); // updatedTask
    mockExecute.mockResolvedValueOnce(makeResult([makeTaskRow({ id: 2, status: 'blocked' })])); // nextTask

    const result = await completeTask(1, 5, null, { progress_minutes: 10 });

    // Only 5 transaction calls: lock, read assignee, UPDATE complete, INSERT transition, SELECT next.
    // No UPDATE/INSERT was issued against the already-blocked next task, and no
    // further task beyond it was queried or touched.
    expect(mockTransaction.execute).toHaveBeenCalledTimes(5);

    // The SELECT for the next task must NOT filter out 'blocked' — it must always
    // fetch the immediate next task by order_index regardless of status.
    expect(mockTransaction.execute).toHaveBeenNthCalledWith(
      5,
      expect.objectContaining({
        sql: expect.not.stringContaining("IN ('waiting', 'not_started')"),
      })
    );

    expect(result.task.status).toBe('completed');
    expect(result.nextTask?.status).toBe('blocked');
    expect(result.blockedReason).toMatch(/bloqueada/i);
    expect(mockTransaction.commit).toHaveBeenCalled();
  });

  it('blocks the immediate next waiting task when it requires a quote and has no assignee', async () => {
    mockExecute.mockResolvedValueOnce(
      makeResult([makeTaskRow({ id: 1, status: 'in_progress', project_id: 1, adjustment_id: null })])
    );

    mockTransaction.execute
      .mockResolvedValueOnce(makeResult([{ status: 'in_progress' }])) // lock + re-check status
      .mockResolvedValueOnce(makeResult([])) // 0. read assignee salary + weekly hours
      .mockResolvedValueOnce(makeResult([])) // UPDATE current -> completed
      .mockResolvedValueOnce(makeResult([])) // INSERT transition (completed)
      .mockResolvedValueOnce(
        makeResult([
          { id: 2, assigned_user_id: null, requires_quote: 1, task_flag: 'new', status: 'waiting' },
        ])
      ) // SELECT next
      .mockResolvedValueOnce(makeResult([])) // UPDATE next -> blocked
      .mockResolvedValueOnce(makeResult([])); // INSERT transition (blocked)

    mockExecute.mockResolvedValueOnce(makeResult([makeTaskRow({ id: 1, status: 'completed' })]));
    mockExecute.mockResolvedValueOnce(makeResult([makeTaskRow({ id: 2, status: 'blocked' })]));

    const result = await completeTask(1, 5);

    expect(mockTransaction.execute).toHaveBeenNthCalledWith(
      6,
      expect.objectContaining({
        sql: expect.stringContaining("status = 'blocked'"),
        args: expect.arrayContaining([2]),
      })
    );
    expect(result.blockedReason).toMatch(/cotizaci[oó]n/i);
    expect(mockTransaction.commit).toHaveBeenCalled();
  });

  it('blocks the immediate next waiting task when it has no assignee (no quote required)', async () => {
    mockExecute.mockResolvedValueOnce(
      makeResult([makeTaskRow({ id: 1, status: 'in_progress', project_id: 1, adjustment_id: null })])
    );

    mockTransaction.execute
      .mockResolvedValueOnce(makeResult([{ status: 'in_progress' }])) // lock + re-check status
      .mockResolvedValueOnce(makeResult([])) // 0. read assignee salary + weekly hours
      .mockResolvedValueOnce(makeResult([])) // UPDATE current -> completed
      .mockResolvedValueOnce(makeResult([])) // INSERT transition (completed)
      .mockResolvedValueOnce(
        makeResult([
          { id: 2, assigned_user_id: null, requires_quote: 0, task_flag: 'new', status: 'waiting' },
        ])
      ) // SELECT next
      .mockResolvedValueOnce(makeResult([])) // UPDATE next -> blocked
      .mockResolvedValueOnce(makeResult([])); // INSERT transition (blocked)

    mockExecute.mockResolvedValueOnce(makeResult([makeTaskRow({ id: 1, status: 'completed' })]));
    mockExecute.mockResolvedValueOnce(makeResult([makeTaskRow({ id: 2, status: 'blocked' })]));

    const result = await completeTask(1, 5);

    expect(mockTransaction.execute).toHaveBeenNthCalledWith(
      6,
      expect.objectContaining({
        sql: expect.stringContaining("status = 'blocked'"),
        args: expect.arrayContaining([2]),
      })
    );
    expect(result.blockedReason).toMatch(/colaborador asignado/i);
  });

  it('activates the immediate next waiting/assigned task to not_started', async () => {
    mockExecute.mockResolvedValueOnce(
      makeResult([makeTaskRow({ id: 1, status: 'in_progress', project_id: 1, adjustment_id: null })])
    );

    mockTransaction.execute
      .mockResolvedValueOnce(makeResult([{ status: 'in_progress' }])) // lock + re-check status
      .mockResolvedValueOnce(makeResult([])) // 0. read assignee salary + weekly hours
      .mockResolvedValueOnce(makeResult([])) // UPDATE current -> completed
      .mockResolvedValueOnce(makeResult([])) // INSERT transition (completed)
      .mockResolvedValueOnce(
        makeResult([
          { id: 2, assigned_user_id: 9, requires_quote: 0, task_flag: 'new', status: 'waiting' },
        ])
      ) // SELECT next
      .mockResolvedValueOnce(makeResult([])) // UPDATE next -> not_started
      .mockResolvedValueOnce(makeResult([])); // INSERT transition (not_started)

    mockExecute.mockResolvedValueOnce(makeResult([makeTaskRow({ id: 1, status: 'completed' })]));
    mockExecute.mockResolvedValueOnce(makeResult([makeTaskRow({ id: 2, status: 'not_started' })]));

    const result = await completeTask(1, 5);

    expect(mockTransaction.execute).toHaveBeenNthCalledWith(
      6,
      expect.objectContaining({
        sql: expect.stringContaining("status = 'not_started'"),
        args: expect.arrayContaining([2]),
      })
    );
    expect(result.blockedReason).toBeUndefined();
    expect(result.nextTask?.status).toBe('not_started');
    expect(result.nextActivated).toBe(true);
    expect(result.nextCompleted).toBe(false);
  });

  it('scopes the next-task lookup to the same adjustment_id', async () => {
    mockExecute.mockResolvedValueOnce(
      makeResult([makeTaskRow({ id: 1, status: 'in_progress', project_id: 1, adjustment_id: 7 })])
    );

    mockTransaction.execute
      .mockResolvedValueOnce(makeResult([{ status: 'in_progress' }])) // lock + re-check status
      .mockResolvedValueOnce(makeResult([])) // 0. read assignee salary + weekly hours
      .mockResolvedValueOnce(makeResult([])) // UPDATE current -> completed
      .mockResolvedValueOnce(makeResult([])) // INSERT transition (completed)
      .mockResolvedValueOnce(makeResult([])); // SELECT next — none found in this adjustment

    mockExecute.mockResolvedValueOnce(makeResult([makeTaskRow({ id: 1, status: 'completed' })]));

    const result = await completeTask(1, 5);

    expect(mockTransaction.execute).toHaveBeenNthCalledWith(
      5,
      expect.objectContaining({
        sql: expect.stringContaining('adjustment_id = $3'),
        args: [1, 1, 7],
      })
    );
    expect(result.nextTask).toBeNull();
    expect(result.blockedReason).toBeUndefined();
  });

  it('rolls back the transaction if completion fails', async () => {
    mockExecute.mockResolvedValueOnce(
      makeResult([makeTaskRow({ id: 1, status: 'in_progress', project_id: 1, adjustment_id: null })])
    );

    mockTransaction.execute.mockRejectedValueOnce(new Error('db exploded'));

    await expect(completeTask(1, 5)).rejects.toThrow('db exploded');

    expect(mockTransaction.rollback).toHaveBeenCalled();
    expect(mockTransaction.commit).not.toHaveBeenCalled();
  });

  it('throws when the task is not in_progress', async () => {
    mockExecute.mockResolvedValueOnce(
      makeResult([makeTaskRow({ id: 1, status: 'waiting' })])
    );

    await expect(completeTask(1, 5)).rejects.toThrow(
      'Solo se pueden completar tareas en progreso'
    );
    expect(mockTransaction.execute).not.toHaveBeenCalled();
  });

  it('throws when the task is already completed', async () => {
    mockExecute.mockResolvedValueOnce(
      makeResult([makeTaskRow({ id: 1, status: 'completed' })])
    );

    await expect(completeTask(1, 5)).rejects.toThrow(
      'Esta tarea ya está completada y no puede modificarse'
    );
  });
});

// S13: completion freezes salary, month working minutes and the resulting rate.
describe('completeTask() freezes the monthly-salary rate', () => {
  beforeEach(() => {
    jest.useFakeTimers({ now: new Date('2026-02-15T15:00:00Z'), doNotFake: ['nextTick', 'setImmediate', 'queueMicrotask'] });
  });
  afterEach(() => jest.useRealTimers());

  async function completeWith(assignee: Record<string, unknown>[]) {
    mockExecute.mockResolvedValueOnce(
      makeResult([makeTaskRow({ id: 1, status: 'in_progress', project_id: 1, adjustment_id: null })])
    );
    mockTransaction.execute
      .mockResolvedValueOnce(makeResult([{ status: 'in_progress' }])) // lock + re-check status
      .mockResolvedValueOnce(makeResult(assignee)) // read assignee salary + weekly hours
      .mockResolvedValueOnce(makeResult([])) // UPDATE completed
      .mockResolvedValueOnce(makeResult([])) // INSERT transition
      .mockResolvedValueOnce(makeResult([])); // SELECT next
    mockExecute.mockResolvedValueOnce(makeResult([makeTaskRow({ id: 1, status: 'completed' })]));

    await completeTask(1, 5, null, { progress_minutes: 90, completion_cost: null });

    const read = mockTransaction.execute.mock.calls[1][0] as { sql: string; args: unknown[] };
    expect(read.sql).toContain('u.monthly_salary');
    expect(read.sql).toContain('u.is_internal');
    expect(read.sql).toContain("key = 'weekly_work_hours'");
    expect(read.args).toEqual([1]);
    const update = mockTransaction.execute.mock.calls[2][0] as { sql: string; args: unknown[] };
    expect(update.sql).toContain("SET status = 'completed'");
    expect(update.sql).toMatch(/completion_hourly_rate = \$5/);
    expect(update.sql).toMatch(/completion_monthly_salary = \$6/);
    expect(update.sql).toMatch(/completion_month_minutes = \$7/);
    expect(update.sql).not.toContain('hourly_rate END');
    return update.args;
  }

  it('stores rate, salary and month minutes for an internal with salary', async () => {
    const args = await completeWith([{ is_internal: 1, monthly_salary: '5040000.00', weekly_work_hours: null }]);
    expect(args).toEqual([1, 90, null, null, 30000, 5040000, 10080]);
  });

  it('uses the weekly_work_hours setting', async () => {
    const args = await completeWith([{ is_internal: 1, monthly_salary: '4800000', weekly_work_hours: '40' }]);
    expect(args).toEqual([1, 90, null, null, 30000, 4800000, 9600]);
  });

  it('stores nothing for an internal without salary', async () => {
    const args = await completeWith([{ is_internal: 1, monthly_salary: null, weekly_work_hours: null }]);
    expect(args).toEqual([1, 90, null, null, null, null, null]);
  });

  it('stores nothing for an external collaborator', async () => {
    const args = await completeWith([{ is_internal: 0, monthly_salary: '5040000', weekly_work_hours: null }]);
    expect(args).toEqual([1, 90, null, null, null, null, null]);
  });
});

// S1-S3 (odd/tasks/task-queue-activation.md): automation activates at most the
// immediate next task, only when every earlier task is completed.
describe('completeTask() with manually activated parallel tasks', () => {
  function completeWithNext(next: Record<string, unknown>, nextRow: Record<string, unknown>) {
    mockExecute.mockResolvedValueOnce(
      makeResult([makeTaskRow({ id: 1, status: 'in_progress', project_id: 1, adjustment_id: 3 })])
    );
    mockTransaction.execute
      .mockResolvedValueOnce(makeResult([{ status: 'in_progress' }])) // lock
      .mockResolvedValueOnce(makeResult([])) // read assignee
      .mockResolvedValueOnce(makeResult([])) // UPDATE completed
      .mockResolvedValueOnce(makeResult([])) // INSERT transition
      .mockResolvedValueOnce(makeResult([next])) // SELECT next
      .mockResolvedValue(makeResult([])); // any further write
    mockExecute.mockResolvedValueOnce(makeResult([makeTaskRow({ id: 1, status: 'completed' })]));
    mockExecute.mockResolvedValueOnce(makeResult([makeTaskRow(nextRow)]));
    return completeTask(1, 5, null, { progress_minutes: 10 });
  }

  it('counts the open tasks before the next one in the same version', async () => {
    await completeWithNext(
      { id: 2, assigned_user_id: 9, requires_quote: 0, task_flag: 'new', status: 'waiting', open_before: 0 },
      { id: 2, status: 'not_started' }
    );
    const select = mockTransaction.execute.mock.calls[4][0] as { sql: string };
    expect(select.sql).toMatch(/AS open_before/);
    expect(select.sql).toMatch(/status <> 'completed'/);
  });

  it('S2: leaves an already active (not_started) next task untouched', async () => {
    const result = await completeWithNext(
      { id: 2, assigned_user_id: 9, requires_quote: 0, task_flag: 'new', status: 'not_started', open_before: 0 },
      { id: 2, status: 'not_started', assigned_user_id: 9 }
    );
    expect(mockTransaction.execute).toHaveBeenCalledTimes(5);
    expect(result.nextActivated).toBe(false);
    expect(result.nextCompleted).toBe(false);
    expect(result.blockedReason).toBeUndefined();
    expect(mockTransaction.commit).toHaveBeenCalled();
  });

  it('S1: does not activate the waiting next task while an earlier task is still open', async () => {
    const result = await completeWithNext(
      { id: 3, assigned_user_id: 9, requires_quote: 0, task_flag: 'new', status: 'waiting', open_before: 1 },
      { id: 3, status: 'waiting', assigned_user_id: 9 }
    );
    expect(mockTransaction.execute).toHaveBeenCalledTimes(5);
    expect(result.nextActivated).toBe(false);
    expect(result.blockedReason).toBeUndefined();
  });

  it('S1: does not block an unassigned waiting next task while an earlier task is still open', async () => {
    const result = await completeWithNext(
      { id: 3, assigned_user_id: null, requires_quote: 1, task_flag: 'new', status: 'waiting', open_before: 2 },
      { id: 3, status: 'waiting', assigned_user_id: null }
    );
    expect(mockTransaction.execute).toHaveBeenCalledTimes(5);
    expect(result.blockedReason).toBeUndefined();
  });

  it('S3: reports that the next task was already completed and activates nothing', async () => {
    const result = await completeWithNext(
      { id: 4, assigned_user_id: 9, requires_quote: 0, task_flag: 'new', status: 'completed', open_before: 0 },
      { id: 4, status: 'completed' }
    );
    expect(mockTransaction.execute).toHaveBeenCalledTimes(5);
    expect(result.nextActivated).toBe(false);
    expect(result.nextCompleted).toBe(true);
  });
});

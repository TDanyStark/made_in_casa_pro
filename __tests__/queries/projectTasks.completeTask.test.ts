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

    // Only 3 transaction calls: UPDATE complete, INSERT transition, SELECT next.
    // No UPDATE/INSERT was issued against the already-blocked next task, and no
    // further task beyond it was queried or touched.
    expect(mockTransaction.execute).toHaveBeenCalledTimes(3);

    // The SELECT for the next task must NOT filter out 'blocked' — it must always
    // fetch the immediate next task by order_index regardless of status.
    expect(mockTransaction.execute).toHaveBeenNthCalledWith(
      3,
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
      4,
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
      .mockResolvedValueOnce(makeResult([])) // UPDATE current -> completed
      .mockResolvedValueOnce(makeResult([])) // INSERT transition (completed)
      .mockResolvedValueOnce(
        makeResult([
          { id: 2, assigned_user_id: null, requires_quote: 0, task_flag: 'new', status: 'not_started' },
        ])
      ) // SELECT next
      .mockResolvedValueOnce(makeResult([])) // UPDATE next -> blocked
      .mockResolvedValueOnce(makeResult([])); // INSERT transition (blocked)

    mockExecute.mockResolvedValueOnce(makeResult([makeTaskRow({ id: 1, status: 'completed' })]));
    mockExecute.mockResolvedValueOnce(makeResult([makeTaskRow({ id: 2, status: 'blocked' })]));

    const result = await completeTask(1, 5);

    expect(mockTransaction.execute).toHaveBeenNthCalledWith(
      4,
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
      4,
      expect.objectContaining({
        sql: expect.stringContaining("status = 'not_started'"),
        args: expect.arrayContaining([2]),
      })
    );
    expect(result.blockedReason).toBeUndefined();
    expect(result.nextTask?.status).toBe('not_started');
  });

  it('scopes the next-task lookup to the same adjustment_id', async () => {
    mockExecute.mockResolvedValueOnce(
      makeResult([makeTaskRow({ id: 1, status: 'in_progress', project_id: 1, adjustment_id: 7 })])
    );

    mockTransaction.execute
      .mockResolvedValueOnce(makeResult([])) // UPDATE current -> completed
      .mockResolvedValueOnce(makeResult([])) // INSERT transition (completed)
      .mockResolvedValueOnce(makeResult([])); // SELECT next — none found in this adjustment

    mockExecute.mockResolvedValueOnce(makeResult([makeTaskRow({ id: 1, status: 'completed' })]));

    const result = await completeTask(1, 5);

    expect(mockTransaction.execute).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({
        sql: expect.stringContaining('adjustment_id = 7'),
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

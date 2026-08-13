/**
 * Tests for deleteProjectTask() query function.
 *
 * Bugfix: deleting an active task must promote the next pending task
 * (same project + same adjustment_id) to 'not_started' so the project
 * never ends up paused with every remaining task stuck in 'waiting'.
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
import { deleteProjectTask } from '@/lib/queries/projectTasks';

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
    status: 'not_started',
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

describe('deleteProjectTask()', () => {
  it('does nothing when the task does not exist', async () => {
    mockExecute.mockResolvedValueOnce(makeResult([])); // getProjectTaskById -> not found

    await deleteProjectTask(999);

    expect(mockTransaction.execute).not.toHaveBeenCalled();
    expect(mockTransaction.commit).not.toHaveBeenCalled();
  });

  it('throws when the task is completed', async () => {
    mockExecute.mockResolvedValueOnce(
      makeResult([makeTaskRow({ status: 'completed' })])
    );

    await expect(deleteProjectTask(1)).rejects.toThrow(
      'No se pueden eliminar tareas completadas.'
    );
    expect(mockTransaction.execute).not.toHaveBeenCalled();
  });

  it('deleting the active (not_started) task promotes the next waiting task to not_started', async () => {
    // getProjectTaskById(1): the active task being deleted
    mockExecute.mockResolvedValueOnce(
      makeResult([makeTaskRow({ id: 1, status: 'not_started', project_id: 1, adjustment_id: null })])
    );

    mockTransaction.execute
      .mockResolvedValueOnce(makeResult([])) // DELETE
      .mockResolvedValueOnce(
        makeResult([
          { id: 2, status: 'waiting', assigned_user_id: 5 },
          { id: 3, status: 'waiting', assigned_user_id: null },
        ])
      ) // SELECT remaining tasks ordered by order_index
      .mockResolvedValueOnce(makeResult([])); // UPDATE promote id=2

    await deleteProjectTask(1);

    // DELETE issued for the removed task
    expect(mockTransaction.execute).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        sql: expect.stringContaining('DELETE FROM project_tasks'),
        args: [1],
      })
    );

    // Next pending task (id=2, lowest order_index among remaining) promoted to not_started
    expect(mockTransaction.execute).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({
        sql: expect.stringContaining("status = 'not_started'"),
        args: expect.arrayContaining([2]),
      })
    );

    expect(mockTransaction.commit).toHaveBeenCalled();
    expect(mockTransaction.rollback).not.toHaveBeenCalled();
  });

  it('deleting an intermediate waiting task does not touch the already-active task', async () => {
    // getProjectTaskById: an intermediate waiting task (not the active one) is deleted
    mockExecute.mockResolvedValueOnce(
      makeResult([makeTaskRow({ id: 2, status: 'waiting', project_id: 1, adjustment_id: null })])
    );

    mockTransaction.execute
      .mockResolvedValueOnce(makeResult([])) // DELETE
      .mockResolvedValueOnce(
        makeResult([
          { id: 1, status: 'not_started', assigned_user_id: 5 }, // already active — first non-completed
          { id: 3, status: 'waiting', assigned_user_id: null },
        ])
      ); // SELECT remaining tasks — no promotion/demotion needed

    await deleteProjectTask(2);

    // Only DELETE + SELECT were issued — no status-changing UPDATE, since the
    // first non-completed task is already 'not_started'.
    expect(mockTransaction.execute).toHaveBeenCalledTimes(2);
    expect(mockTransaction.commit).toHaveBeenCalled();
  });

  it('deleting the last remaining task leaves nothing to promote (no error, commits cleanly)', async () => {
    mockExecute.mockResolvedValueOnce(
      makeResult([makeTaskRow({ id: 1, status: 'not_started', project_id: 1, adjustment_id: null })])
    );

    mockTransaction.execute
      .mockResolvedValueOnce(makeResult([])) // DELETE
      .mockResolvedValueOnce(makeResult([])); // SELECT — no tasks remain

    await expect(deleteProjectTask(1)).resolves.toBeUndefined();

    expect(mockTransaction.execute).toHaveBeenCalledTimes(2);
    expect(mockTransaction.commit).toHaveBeenCalled();
  });

  it('demotes a duplicate not_started task that is not the first pending one', async () => {
    mockExecute.mockResolvedValueOnce(
      makeResult([makeTaskRow({ id: 1, status: 'not_started', project_id: 1, adjustment_id: null })])
    );

    mockTransaction.execute
      .mockResolvedValueOnce(makeResult([])) // DELETE
      .mockResolvedValueOnce(
        makeResult([
          { id: 2, status: 'not_started', assigned_user_id: 5 }, // first non-completed — stays active
          { id: 4, status: 'not_started', assigned_user_id: null }, // stray duplicate — must demote
        ])
      )
      .mockResolvedValueOnce(makeResult([])); // UPDATE demote id=4

    await deleteProjectTask(1);

    expect(mockTransaction.execute).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({
        sql: expect.stringContaining("status = 'waiting'"),
        args: expect.arrayContaining([4]),
      })
    );
    expect(mockTransaction.commit).toHaveBeenCalled();
  });

  it('scopes promotion to the same adjustment_id and does not leak into other adjustments', async () => {
    // Deleted task belongs to adjustment_id = 7
    mockExecute.mockResolvedValueOnce(
      makeResult([makeTaskRow({ id: 1, status: 'not_started', project_id: 1, adjustment_id: 7 })])
    );

    mockTransaction.execute
      .mockResolvedValueOnce(makeResult([])) // DELETE
      .mockResolvedValueOnce(
        makeResult([{ id: 5, status: 'waiting', assigned_user_id: 9 }])
      ) // SELECT — already scoped to adjustment_id = 7 by the query
      .mockResolvedValueOnce(makeResult([])); // UPDATE promote id=5

    await deleteProjectTask(1);

    // The SELECT for remaining tasks must filter by adjustment_id = 7
    expect(mockTransaction.execute).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        sql: expect.stringContaining('adjustment_id = 7'),
      })
    );

    // And the promoted task belongs to that adjustment's next pending task
    expect(mockTransaction.execute).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({
        sql: expect.stringContaining("status = 'not_started'"),
        args: expect.arrayContaining([5]),
      })
    );

    expect(mockTransaction.commit).toHaveBeenCalled();
  });

  it('rolls back the transaction if promotion fails', async () => {
    mockExecute.mockResolvedValueOnce(
      makeResult([makeTaskRow({ id: 1, status: 'not_started', project_id: 1, adjustment_id: null })])
    );

    mockTransaction.execute
      .mockResolvedValueOnce(makeResult([])) // DELETE
      .mockRejectedValueOnce(new Error('db exploded')); // SELECT fails

    await expect(deleteProjectTask(1)).rejects.toThrow('db exploded');

    expect(mockTransaction.rollback).toHaveBeenCalled();
    expect(mockTransaction.commit).not.toHaveBeenCalled();
  });
});

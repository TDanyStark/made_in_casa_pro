/**
 * Single in-progress task per collaborator (odd/tasks/single-in-progress-task.md).
 *
 * S1/S2: starting a task pauses every other 'in_progress' task of the same
 *        assignee, inside one transaction that locks the assignee row.
 * S3:    pauseTask moves an 'in_progress' task to 'paused'.
 * S5:    resumeTask moves a 'paused' task back to 'in_progress' and pauses the
 *        assignee's current one.
 */

type Row = Record<string, unknown>;

const mockTransaction = {
  execute: jest.fn(),
  commit: jest.fn(),
  rollback: jest.fn(),
};

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
import { revalidatePath } from 'next/cache';
import { startTask, pauseTask, resumeTask } from '@/lib/queries/projectTasks';

/**
 * Routes transaction SQL by content so tests do not depend on call order.
 * `task` is the row returned by the locked task SELECT; `otherInProgress`
 * are the rows the auto-pause UPDATE ... RETURNING reports.
 */
function setupTransaction(task: Row | null, otherInProgress: Row[] = []) {
  mockTransaction.execute.mockImplementation(async (query: { sql: string }) => {
    const sql = query.sql;
    if (/FROM project_tasks\s+WHERE id = \$1\s+FOR UPDATE/i.test(sql)) {
      return { rows: task ? [task] : [] };
    }
    if (/SET status = 'paused'/.test(sql) && /assigned_user_id = \$1/.test(sql)) {
      return { rows: otherInProgress };
    }
    return { rows: [] };
  });
}

function sqlCalls(): Array<{ sql: string; args?: unknown[] }> {
  return mockTransaction.execute.mock.calls.map((c) => c[0]);
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('startTask() — single in-progress rule', () => {
  it('pauses the other in-progress tasks of the assignee and logs each pause', async () => {
    setupTransaction(
      { id: 10, status: 'not_started', assigned_user_id: 5, project_id: 1, task_flag: 'new' },
      [
        { id: 20, project_id: 2, task_flag: 'new' },
        { id: 21, project_id: 3, task_flag: 'correction' },
      ]
    );

    const result = await startTask(10, 7);

    expect(result).toEqual({ success: true, pausedTaskIds: [20, 21] });
    const calls = sqlCalls();
    expect(calls).toContainEqual(
      expect.objectContaining({ sql: expect.stringMatching(/FROM users WHERE id = \$1 FOR UPDATE/), args: [5] })
    );
    expect(calls).toContainEqual(
      expect.objectContaining({
        sql: expect.stringMatching(/SET status = 'paused'[\s\S]*status = 'in_progress'[\s\S]*id <> \$2/),
        args: [5, 10],
      })
    );
    const pauseLogs = calls.filter(
      (c) => /INSERT INTO task_transitions/.test(c.sql) && c.args?.[3] === 'paused'
    );
    expect(pauseLogs.map((c) => c.args?.slice(0, 4))).toEqual([
      [20, 2, 'in_progress', 'paused'],
      [21, 3, 'in_progress', 'paused'],
    ]);
    expect(pauseLogs.every((c) => c.args?.[6] === 7)).toBe(true);
    expect(mockTransaction.commit).toHaveBeenCalledTimes(1);
    expect(mockTransaction.rollback).not.toHaveBeenCalled();
    expect(revalidatePath).toHaveBeenCalledWith('/projects/1');
    expect(revalidatePath).toHaveBeenCalledWith('/projects/2');
    expect(revalidatePath).toHaveBeenCalledWith('/projects/3');
  });

  it('does not lock or pause anything when the task has no assignee', async () => {
    setupTransaction({ id: 10, status: 'not_started', assigned_user_id: null, project_id: 1, task_flag: 'new' });

    const result = await startTask(10, 7);

    expect(result).toEqual({ success: true, pausedTaskIds: [] });
    expect(sqlCalls().some((c) => /FROM users/.test(c.sql))).toBe(false);
    expect(sqlCalls().some((c) => /SET status = 'paused'/.test(c.sql))).toBe(false);
  });

  it('rolls back and changes nothing when the task is not not_started', async () => {
    setupTransaction({ id: 10, status: 'paused', assigned_user_id: 5, project_id: 1, task_flag: 'new' });

    const result = await startTask(10, 5);

    expect(result).toEqual({
      success: false,
      error: 'La tarea debe estar en estado "sin iniciar" para poder tomarla',
    });
    expect(sqlCalls().some((c) => /^\s*UPDATE/.test(c.sql))).toBe(false);
    expect(mockTransaction.rollback).toHaveBeenCalledTimes(1);
    expect(mockTransaction.commit).not.toHaveBeenCalled();
  });
});

describe('pauseTask()', () => {
  it('moves an in_progress task to paused and logs the transition', async () => {
    setupTransaction({ id: 10, status: 'in_progress', assigned_user_id: 5, project_id: 1, task_flag: 'new' });

    const result = await pauseTask(10, 5);

    expect(result).toEqual({ success: true });
    const calls = sqlCalls();
    expect(calls).toContainEqual(
      expect.objectContaining({ sql: expect.stringMatching(/SET status = 'paused'/), args: [10] })
    );
    const log = calls.find((c) => /INSERT INTO task_transitions/.test(c.sql));
    expect(log?.args).toEqual([10, 1, 'in_progress', 'paused', 'new', 'new', 5, null]);
    expect(mockTransaction.commit).toHaveBeenCalledTimes(1);
    expect(revalidatePath).toHaveBeenCalledWith('/projects/1');
  });

  it.each(['not_started', 'paused', 'completed', 'blocked', 'waiting'])(
    'rejects a %s task without writing',
    async (status) => {
      setupTransaction({ id: 10, status, assigned_user_id: 5, project_id: 1, task_flag: 'new' });

      const result = await pauseTask(10, 5);

      expect(result).toEqual({ success: false, error: 'Solo se pueden pausar tareas en progreso' });
      expect(sqlCalls().some((c) => /^\s*(UPDATE|INSERT)/.test(c.sql))).toBe(false);
      expect(mockTransaction.rollback).toHaveBeenCalledTimes(1);
    }
  );

  it('returns not found for a missing task', async () => {
    setupTransaction(null);

    expect(await pauseTask(99, 5)).toEqual({ success: false, error: 'Tarea no encontrada' });
    expect(mockTransaction.rollback).toHaveBeenCalledTimes(1);
  });
});

describe('resumeTask()', () => {
  it('moves a paused task to in_progress and pauses the current one', async () => {
    setupTransaction(
      { id: 10, status: 'paused', assigned_user_id: 5, project_id: 1, task_flag: 'new' },
      [{ id: 20, project_id: 2, task_flag: 'new' }]
    );

    const result = await resumeTask(10, 5);

    expect(result).toEqual({ success: true, pausedTaskIds: [20] });
    const calls = sqlCalls();
    expect(calls).toContainEqual(
      expect.objectContaining({ sql: expect.stringMatching(/SET status = 'in_progress'/), args: [10] })
    );
    const logs = calls
      .filter((c) => /INSERT INTO task_transitions/.test(c.sql))
      .map((c) => c.args?.slice(0, 4));
    expect(logs).toEqual([
      [20, 2, 'in_progress', 'paused'],
      [10, 1, 'paused', 'in_progress'],
    ]);
    expect(mockTransaction.commit).toHaveBeenCalledTimes(1);
  });

  it.each(['not_started', 'in_progress', 'completed', 'blocked', 'waiting'])(
    'rejects a %s task without writing',
    async (status) => {
      setupTransaction({ id: 10, status, assigned_user_id: 5, project_id: 1, task_flag: 'new' });

      const result = await resumeTask(10, 5);

      expect(result).toEqual({ success: false, error: 'Solo se pueden reanudar tareas pausadas' });
      expect(sqlCalls().some((c) => /^\s*(UPDATE|INSERT)/.test(c.sql))).toBe(false);
      expect(mockTransaction.rollback).toHaveBeenCalledTimes(1);
    }
  );
});

describe('transaction failure', () => {
  it('rolls back and rethrows when a write fails', async () => {
    mockTransaction.execute.mockImplementation(async (query: { sql: string }) => {
      if (/FOR UPDATE/.test(query.sql) && /project_tasks/.test(query.sql)) {
        return { rows: [{ id: 10, status: 'in_progress', assigned_user_id: 5, project_id: 1, task_flag: 'new' }] };
      }
      if (/^\s*UPDATE/.test(query.sql)) throw new Error('db down');
      return { rows: [] };
    });

    await expect(pauseTask(10, 5)).rejects.toThrow('db down');
    expect(mockTransaction.rollback).toHaveBeenCalledTimes(1);
    expect(mockTransaction.commit).not.toHaveBeenCalled();
    expect(db.execute).not.toHaveBeenCalled();
  });
});

describe('updateProjectTask() — manual status change keeps the rule', () => {
  // getProjectTaskById uses db.execute; return the same row before and after.
  function withCurrentTask(row: Row) {
    (db.execute as jest.Mock).mockResolvedValue({ rows: [{ ...row, quoter_ids: '[]' }] });
  }

  it('pauses the assignee\'s other in-progress tasks when status is set to in_progress', async () => {
    const { updateProjectTask } = jest.requireActual('@/lib/queries/projectTasks');
    withCurrentTask({ id: 10, project_id: 1, status: 'paused', assigned_user_id: 5, order_index: 1 });
    setupTransaction(null, [{ id: 20, project_id: 2, task_flag: 'new' }]);

    await updateProjectTask(10, { status: 'in_progress' }, 7);

    const calls = sqlCalls();
    expect(calls).toContainEqual(
      expect.objectContaining({ sql: expect.stringMatching(/SET status = 'paused'/), args: [5, 10] })
    );
    expect(calls).toContainEqual(
      expect.objectContaining({ sql: expect.stringMatching(/UPDATE project_tasks SET status = \$1/), args: ['in_progress', 10] })
    );
    expect(mockTransaction.commit).toHaveBeenCalledTimes(1);
    expect(revalidatePath).toHaveBeenCalledWith('/projects/2');
  });

  it('keeps the previous single-statement update when status is not in_progress', async () => {
    const { updateProjectTask } = jest.requireActual('@/lib/queries/projectTasks');
    withCurrentTask({ id: 10, project_id: 1, status: 'not_started', assigned_user_id: 5, order_index: 1 });

    await updateProjectTask(10, { title: 'Nuevo' }, 7);

    expect(db.transaction).not.toHaveBeenCalled();
    expect(db.execute).toHaveBeenCalledWith(
      expect.objectContaining({ sql: 'UPDATE project_tasks SET title = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', args: ['Nuevo', 10] })
    );
  });
});

describe('completeTask() — paused task must be resumed first (S6)', () => {
  it('throws and opens no transaction', async () => {
    const { completeTask } = jest.requireActual('@/lib/queries/projectTasks');
    (db.execute as jest.Mock).mockResolvedValue({
      rows: [{ id: 10, project_id: 1, status: 'paused', task_type: 'execution', quoter_ids: '[]' }],
    });

    await expect(completeTask(10, 5)).rejects.toThrow('Solo se pueden completar tareas en progreso');
    expect(db.transaction).not.toHaveBeenCalled();
  });
});

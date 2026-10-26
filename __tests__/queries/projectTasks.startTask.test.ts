/**
 * Tests for startTask() query function (previous behavior preserved).
 * The single in-progress rule is covered in projectTasks.pause.test.ts.
 */

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

import { startTask } from '@/lib/queries/projectTasks';

function withTask(task: Record<string, unknown> | null) {
  mockTransaction.execute.mockImplementation(async (query: { sql: string }) => {
    if (/FROM project_tasks\s+WHERE id = \$1\s+FOR UPDATE/i.test(query.sql)) {
      return { rows: task ? [task] : [] };
    }
    return { rows: [] };
  });
}

const calls = () => mockTransaction.execute.mock.calls.map((c) => c[0] as { sql: string; args?: unknown[] });

beforeEach(() => {
  jest.clearAllMocks();
});

describe('startTask()', () => {
  it('returns { success: false, error } when task does not exist', async () => {
    withTask(null);

    const result = await startTask(99, 1);

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/no encontrada/i);
    expect(mockTransaction.rollback).toHaveBeenCalledTimes(1);
  });

  it.each(['in_progress', 'waiting', 'completed'])(
    'returns { success: false, error } when task is %s',
    async (status) => {
      withTask({ id: 10, status, assigned_user_id: 5, project_id: 1, task_flag: 'new' });

      const result = await startTask(10, 5);

      expect(result.success).toBe(false);
      expect(result.error).toContain('sin iniciar');
      expect(calls().some((c) => /^\s*(UPDATE|INSERT)/.test(c.sql))).toBe(false);
    }
  );

  it('returns { success: true } and sets status = in_progress for a not_started task', async () => {
    withTask({ id: 10, status: 'not_started', assigned_user_id: 5, project_id: 1, task_flag: 'new' });

    const result = await startTask(10, 5);

    expect(result.success).toBe(true);
    expect(result.error).toBeUndefined();
    expect(calls()).toContainEqual(
      expect.objectContaining({ sql: expect.stringContaining("SET status = $2"), args: [10, 'in_progress'] })
    );
    expect(mockTransaction.commit).toHaveBeenCalledTimes(1);
  });

  it('logs transition from not_started to in_progress', async () => {
    withTask({ id: 10, status: 'not_started', assigned_user_id: 5, project_id: 1, task_flag: 'new' });

    await startTask(10, 5);

    const log = calls().find((c) => /INSERT INTO task_transitions/.test(c.sql) && c.args?.[0] === 10);
    expect(log?.args).toEqual([10, 1, 'not_started', 'in_progress', 'new', 'new', 5, null]);
  });
});

/**
 * Tests for startTask() query function
 */

// Mock DB before imports
jest.mock('@/lib/db', () => ({
  db: {
    execute: jest.fn(),
    transaction: jest.fn(),
  },
}));

// Mock next/cache (revalidatePath)
jest.mock('next/cache', () => ({
  revalidatePath: jest.fn(),
}));

import { db } from '@/lib/db';
import { startTask } from '@/lib/queries/projectTasks';

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

beforeEach(() => {
  jest.clearAllMocks();
});

describe('startTask()', () => {
  it('returns { success: false, error } when task does not exist', async () => {
    mockExecute.mockResolvedValueOnce(makeResult([])); // SELECT returns nothing

    const result = await startTask(99, 1);

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/no encontrada/i);
  });

  it('returns { success: false, error } when task is not in not_started status', async () => {
    mockExecute.mockResolvedValueOnce(makeResult([{
      id: 10,
      status: 'in_progress',
      assigned_user_id: 5,
      project_id: 1,
    }]));

    const result = await startTask(10, 5);

    expect(result.success).toBe(false);
    expect(result.error).toContain('sin iniciar');
  });

  it('returns { success: false, error } when task is in waiting status', async () => {
    mockExecute.mockResolvedValueOnce(makeResult([{
      id: 10,
      status: 'waiting',
      assigned_user_id: 5,
      project_id: 1,
    }]));

    const result = await startTask(10, 5);

    expect(result.success).toBe(false);
    expect(result.error).toContain('sin iniciar');
  });

  it('returns { success: false, error } when task is already completed', async () => {
    mockExecute.mockResolvedValueOnce(makeResult([{
      id: 10,
      status: 'completed',
      assigned_user_id: 5,
      project_id: 1,
    }]));

    const result = await startTask(10, 5);

    expect(result.success).toBe(false);
    expect(result.error).toContain('sin iniciar');
  });

  it('returns { success: true } when task is in not_started and updates status', async () => {
    // 1. SELECT returns the task
    mockExecute.mockResolvedValueOnce(makeResult([{
      id: 10,
      status: 'not_started',
      assigned_user_id: 5,
      project_id: 1,
    }]));
    // 2. UPDATE execute
    mockExecute.mockResolvedValueOnce(makeResult([]));
    // 3. INSERT transition execute
    mockExecute.mockResolvedValueOnce(makeResult([]));

    const result = await startTask(10, 5);

    expect(result.success).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it('calls UPDATE to set status = in_progress for the task', async () => {
    mockExecute.mockResolvedValueOnce(makeResult([{
      id: 10,
      status: 'not_started',
      assigned_user_id: 5,
      project_id: 1,
    }]));
    mockExecute.mockResolvedValueOnce(makeResult([])); // UPDATE
    mockExecute.mockResolvedValueOnce(makeResult([])); // INSERT transition

    await startTask(10, 5);

    expect(mockExecute).toHaveBeenNthCalledWith(2, expect.objectContaining({
      sql: expect.stringContaining("status = 'in_progress'"),
      args: expect.arrayContaining([10]),
    }));
  });

  it('logs transition from not_started to in_progress', async () => {
    mockExecute.mockResolvedValueOnce(makeResult([{
      id: 10,
      status: 'not_started',
      assigned_user_id: 5,
      project_id: 1,
    }]));
    mockExecute.mockResolvedValueOnce(makeResult([])); // UPDATE
    mockExecute.mockResolvedValueOnce(makeResult([])); // INSERT transition

    await startTask(10, 5);

    expect(mockExecute).toHaveBeenNthCalledWith(3, expect.objectContaining({
      sql: expect.stringContaining("'not_started'"),
      args: expect.arrayContaining([10, 5]),
    }));
    expect(mockExecute).toHaveBeenNthCalledWith(3, expect.objectContaining({
      sql: expect.stringContaining("'in_progress'"),
    }));
  });
});

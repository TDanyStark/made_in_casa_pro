// S7: cost of one task, with the data that explains it.
const mockTx = { execute: jest.fn(), commit: jest.fn(), rollback: jest.fn() };
jest.mock('@/lib/db', () => ({
  db: { execute: jest.fn(), transaction: jest.fn(() => Promise.resolve(mockTx)) },
}));
jest.mock('next/cache', () => ({ revalidatePath: jest.fn() }));

import { db } from '@/lib/db';
import { revalidatePath } from 'next/cache';
import { getTaskCost, updateTaskCost } from '@/lib/queries/taskCost';

const mockExecute = db.execute as jest.MockedFunction<typeof db.execute>;
const res = (rows: Record<string, unknown>[]) =>
  ({ rows, columns: [], columnTypes: [], rowsAffected: rows.length, toJSON: () => ({}) }) as never;

function row(overrides: Record<string, unknown> = {}) {
  return {
    assigned_user_id: 1,
    assigned_user_name: 'Ana',
    assignee_is_internal: 1,
    assignee_monthly_salary: '5040000.00',
    weekly_work_hours: null,
    status: 'completed',
    progress_minutes: 90,
    completion_hourly_rate: '30000',
    completion_cost: null,
    accepted_quote_price: null,
    completion_cost_original: null,
    updated_by_name: null,
    completion_cost_updated_at: null,
    ...overrides,
  };
}

beforeEach(() => jest.clearAllMocks());

describe('getTaskCost()', () => {
  it('returns null when the task does not exist in the project', async () => {
    mockExecute.mockResolvedValueOnce(res([]));
    expect(await getTaskCost(65, 141)).toBeNull();
    const call = mockExecute.mock.calls[0][0] as { sql: string; args: unknown[] };
    expect(call.sql).toContain('pt.id = $1');
    expect(call.sql).toContain('pt.project_id = $2');
    expect(call.sql).toContain('pt.completion_hourly_rate');
    expect(call.sql).toContain("tq.status = 'accepted'");
    expect(call.sql).toContain('pt.completion_cost_original');
    expect(call.sql).toContain('pt.completion_cost_updated_by');
    expect(call.args).toEqual([141, 65]);
  });

  it('uses the frozen rate of a completed internal task, never the current one', async () => {
    mockExecute.mockResolvedValueOnce(res([row()]));
    expect(await getTaskCost(65, 141)).toEqual({
      cost: 45000, internal: true, minutes: 90, hourly_rate: 30000, source: 'frozen_rate',
      editable: false, original_cost: null, updated_by_name: null, updated_at: null,
    });
  });

  // S11, S13: unfinished internal work uses the current salary over the current month.
  describe('unfinished internal work', () => {
    afterEach(() => jest.useRealTimers());
    const now = (iso: string) =>
      jest.useFakeTimers({ now: new Date(iso), doNotFake: ['nextTick', 'setImmediate', 'queueMicrotask'] });

    it('uses the current monthly salary over the current month minutes', async () => {
      now('2026-02-15T15:00:00Z'); // February 2026: 10080 min -> 30000/h
      mockExecute.mockResolvedValueOnce(res([row({ status: 'in_progress', progress_minutes: 30, completion_hourly_rate: null })]));
      expect(await getTaskCost(65, 141)).toEqual({
        cost: 15000, internal: true, minutes: 30, hourly_rate: 30000, source: 'current_rate',
        editable: false, original_cost: null, updated_by_name: null, updated_at: null,
      });
      const call = mockExecute.mock.calls[0][0] as { sql: string };
      expect(call.sql).toContain('u.monthly_salary');
      expect(call.sql).toContain("key = 'weekly_work_hours'");
      expect(call.sql).not.toContain('u.hourly_rate');
    });

    it('uses the weekly_work_hours setting and the month in force', async () => {
      now('2026-02-15T15:00:00Z'); // 40 h: 20 days x 480 min = 9600 min -> 4800000 -> 30000/h
      mockExecute.mockResolvedValueOnce(res([row({
        status: 'in_progress', progress_minutes: 60, completion_hourly_rate: null,
        assignee_monthly_salary: '4800000', weekly_work_hours: '40',
      })]));
      expect(await getTaskCost(65, 141)).toMatchObject({ cost: 30000, hourly_rate: 30000 });
    });
  });

  it('uses the price declared by an external collaborator', async () => {
    mockExecute.mockResolvedValueOnce(res([row({
      assignee_is_internal: 0, assignee_monthly_salary: null, completion_hourly_rate: null, completion_cost: '500000',
    })]));
    expect(await getTaskCost(65, 141)).toEqual({
      cost: 500000, internal: false, minutes: 90, hourly_rate: null, source: 'declared',
      editable: true, original_cost: null, updated_by_name: null, updated_at: null,
    });
  });

  it('uses the accepted quote price when nothing was declared', async () => {
    mockExecute.mockResolvedValueOnce(res([row({
      assignee_is_internal: 0, completion_hourly_rate: null, accepted_quote_price: '70000',
    })]));
    expect(await getTaskCost(65, 141)).toEqual({
      cost: 70000, internal: false, minutes: 90, hourly_rate: null, source: 'quote',
      editable: true, original_cost: null, updated_by_name: null, updated_at: null,
    });
  });

  it('reports no cost for an external task with NULL is_internal and nothing declared', async () => {
    mockExecute.mockResolvedValueOnce(res([row({
      assignee_is_internal: null, assignee_monthly_salary: null, completion_hourly_rate: null, progress_minutes: 1080,
    })]));
    expect(await getTaskCost(65, 141)).toEqual({
      cost: 0, internal: false, minutes: 1080, hourly_rate: null, source: 'none',
      editable: true, original_cost: null, updated_by_name: null, updated_at: null,
    });
  });

  it('reports no cost for unfinished internal work without a rate', async () => {
    mockExecute.mockResolvedValueOnce(res([row({
      status: 'in_progress', assignee_monthly_salary: null, completion_hourly_rate: null,
    })]));
    expect(await getTaskCost(65, 141)).toEqual({
      cost: 0, internal: true, minutes: 90, hourly_rate: null, source: 'none',
      editable: false, original_cost: null, updated_by_name: null, updated_at: null,
    });
  });

  // S16: audit trail of a corrected external cost.
  it('returns the corrected cost with the declared original, who and when', async () => {
    mockExecute.mockResolvedValueOnce(res([row({
      assignee_is_internal: 0, assignee_monthly_salary: null, completion_hourly_rate: null,
      completion_cost: '650000.00', completion_cost_original: '500000.00',
      updated_by_name: 'Diana Directiva', completion_cost_updated_at: new Date('2026-05-03T15:00:00.000Z'),
    })]));
    expect(await getTaskCost(65, 141)).toEqual({
      cost: 650000, internal: false, minutes: 90, hourly_rate: null, source: 'declared',
      editable: true, original_cost: 500000, updated_by_name: 'Diana Directiva',
      updated_at: '2026-05-03T15:00:00.000Z',
    });
  });

  it('is not editable for a completed task of an internal assignee without a frozen rate', async () => {
    mockExecute.mockResolvedValueOnce(res([row({ completion_hourly_rate: null })]));
    expect(await getTaskCost(65, 141)).toMatchObject({ internal: true, editable: false });
  });
});

// S15, S16: directivo/admin correct the cost of a completed external task.
describe('updateTaskCost()', () => {
  type Query = { sql: string; args: unknown[] };
  const txQueries = () => mockTx.execute.mock.calls.map(([q]) => q as Query);
  const writes = () => txQueries().filter((q) => /^\s*UPDATE/i.test(q.sql));

  function locked(overrides: Record<string, unknown> = {}) {
    return {
      status: 'completed',
      completion_hourly_rate: null,
      completion_cost: '500000.00',
      completion_cost_original: null,
      assignee_is_internal: 0,
      ...overrides,
    };
  }
  const queueLocked = (r: Record<string, unknown> | null) => {
    mockTx.execute.mockResolvedValueOnce(res(r ? [r] : []));
    mockTx.execute.mockResolvedValueOnce(res([]));
  };

  beforeEach(() => {
    mockTx.execute.mockReset();
    mockTx.commit.mockReset();
    mockTx.rollback.mockReset();
  });

  it('locks the task row of the project before deciding', async () => {
    queueLocked(locked());
    await updateTaskCost(65, 141, 600000, 7);
    expect(db.transaction).toHaveBeenCalledWith('write');
    const [lock] = txQueries();
    expect(lock.sql).toMatch(/FOR UPDATE OF pt/);
    expect(lock.sql).toContain('pt.id = $1');
    expect(lock.sql).toContain('pt.project_id = $2');
    expect(lock.args).toEqual([141, 65]);
  });

  it('stores the declared value as original on the first correction', async () => {
    queueLocked(locked());
    expect(await updateTaskCost(65, 141, 600000, 7)).toBe('updated');
    expect(writes()).toHaveLength(1);
    const [update] = writes();
    expect(update.sql).toContain('completion_cost = $1');
    expect(update.sql).toContain('completion_cost_original = $2');
    expect(update.sql).toContain('completion_cost_updated_by = $3');
    expect(update.sql).toContain('completion_cost_updated_at = CURRENT_TIMESTAMP');
    expect(update.args).toEqual([600000, 500000, 7, 141, 65]);
    expect(mockTx.commit).toHaveBeenCalledTimes(1);
    expect(mockTx.rollback).not.toHaveBeenCalled();
    expect(revalidatePath).toHaveBeenCalledWith('/projects/65');
  });

  it('keeps the first declared value across a second correction', async () => {
    queueLocked(locked({ completion_cost: '600000.00', completion_cost_original: '500000.00' }));
    expect(await updateTaskCost(65, 141, 700000, 8)).toBe('updated');
    expect(writes()[0].args).toEqual([700000, 500000, 8, 141, 65]);
  });

  it('keeps original NULL when nothing had been declared before', async () => {
    queueLocked(locked({ completion_cost: null }));
    expect(await updateTaskCost(65, 141, 0, 7)).toBe('updated');
    expect(writes()[0].args).toEqual([0, null, 7, 141, 65]);
  });

  it('keeps original NULL when the value does not change', async () => {
    queueLocked(locked());
    expect(await updateTaskCost(65, 141, 500000, 7)).toBe('updated');
    expect(writes()[0].args).toEqual([500000, null, 7, 141, 65]);
  });

  it.each([
    ['not_found', null],
    ['not_completed', locked({ status: 'in_progress' })],
    ['internal', locked({ completion_hourly_rate: '30000' })],
    ['internal', locked({ assignee_is_internal: 1 })],
  ])('returns %s without writing', async (expected, lockedRow) => {
    queueLocked(lockedRow as Record<string, unknown> | null);
    expect(await updateTaskCost(65, 141, 600000, 7)).toBe(expected);
    expect(writes()).toHaveLength(0);
    expect(mockTx.commit).not.toHaveBeenCalled();
    expect(mockTx.rollback).toHaveBeenCalledTimes(1);
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('rolls back and rethrows when the write fails', async () => {
    mockTx.execute.mockResolvedValueOnce(res([locked()]));
    mockTx.execute.mockRejectedValueOnce(new Error('db down'));
    await expect(updateTaskCost(65, 141, 600000, 7)).rejects.toThrow('db down');
    expect(mockTx.rollback).toHaveBeenCalledTimes(1);
    expect(mockTx.commit).not.toHaveBeenCalled();
  });
});

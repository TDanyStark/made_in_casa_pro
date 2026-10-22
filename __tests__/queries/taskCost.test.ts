// S7: cost of one task, with the data that explains it.
jest.mock('@/lib/db', () => ({ db: { execute: jest.fn() } }));

import { db } from '@/lib/db';
import { getTaskCost } from '@/lib/queries/taskCost';

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
    expect(call.args).toEqual([141, 65]);
  });

  it('uses the frozen rate of a completed internal task, never the current one', async () => {
    mockExecute.mockResolvedValueOnce(res([row()]));
    expect(await getTaskCost(65, 141)).toEqual({
      cost: 45000, internal: true, minutes: 90, hourly_rate: 30000, source: 'frozen_rate',
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
    });
  });

  it('uses the accepted quote price when nothing was declared', async () => {
    mockExecute.mockResolvedValueOnce(res([row({
      assignee_is_internal: 0, completion_hourly_rate: null, accepted_quote_price: '70000',
    })]));
    expect(await getTaskCost(65, 141)).toEqual({
      cost: 70000, internal: false, minutes: 90, hourly_rate: null, source: 'quote',
    });
  });

  it('reports no cost for an external task with NULL is_internal and nothing declared', async () => {
    mockExecute.mockResolvedValueOnce(res([row({
      assignee_is_internal: null, assignee_monthly_salary: null, completion_hourly_rate: null, progress_minutes: 1080,
    })]));
    expect(await getTaskCost(65, 141)).toEqual({
      cost: 0, internal: false, minutes: 1080, hourly_rate: null, source: 'none',
    });
  });

  it('reports no cost for unfinished internal work without a rate', async () => {
    mockExecute.mockResolvedValueOnce(res([row({
      status: 'in_progress', assignee_monthly_salary: null, completion_hourly_rate: null,
    })]));
    expect(await getTaskCost(65, 141)).toEqual({
      cost: 0, internal: true, minutes: 90, hourly_rate: null, source: 'none',
    });
  });
});

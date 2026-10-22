// S11, S14: internal collaborators are configured with a monthly salary. Setting
// it recalculates, once, their completed internal tasks not yet frozen under the
// monthly model, with the month each task was completed in (America/Bogota).
const mockTx = { execute: jest.fn(), commit: jest.fn(), rollback: jest.fn() };

jest.mock('@/lib/db', () => ({
  db: { execute: jest.fn(), transaction: jest.fn(() => Promise.resolve(mockTx)) },
}));

import { db } from '@/lib/db';
import { getUserById, updateUser } from '@/lib/queries/users';

const mockExecute = db.execute as jest.MockedFunction<typeof db.execute>;
const mockTransaction = db.transaction as jest.Mock;

function makeResult(rows: Record<string, unknown>[]) {
  return {
    rows: rows as never,
    columns: [] as string[],
    columnTypes: [] as string[],
    rowsAffected: rows.length,
    toJSON: () => ({}),
  };
}

const userRow = {
  id: 3, name: 'Ana', email: 'a@test.com', password: '', rol_id: 4,
  area_id: null, is_internal: 1, is_active: 1, monthly_salary: '5040000.00',
  must_change_password: 0, last_login: null, created_at: null,
};

beforeEach(() => {
  jest.clearAllMocks();
  mockTx.execute.mockReset();
  mockTx.commit.mockResolvedValue(undefined);
  mockTx.rollback.mockResolvedValue(undefined);
});

describe('getUserById() monthly salary', () => {
  it('maps monthly_salary as a number and no longer exposes hourly_rate', async () => {
    mockExecute.mockResolvedValueOnce(makeResult([{ ...userRow, hourly_rate: '30000.00' }]));
    const user = await getUserById(3);
    expect(user.monthly_salary).toBe(5040000);
    expect(user).not.toHaveProperty('hourly_rate');
  });

  it('maps a missing monthly_salary to null', async () => {
    mockExecute.mockResolvedValueOnce(makeResult([{ ...userRow, monthly_salary: null }]));
    const user = await getUserById(3);
    expect(user.monthly_salary).toBeNull();
  });
});

// ─── In-memory store behind the transaction ──────────────────────────────────

type Task = {
  id: number;
  assigned_user_id: number;
  status: string;
  completed_at: Date | null;
  completion_cost: number | null;
  accepted_quote: boolean;
  completion_hourly_rate: number | null;
  completion_monthly_salary: number | null;
  completion_month_minutes: number | null;
};

type Query = { sql: string; args?: unknown[] };

function task(id: number, overrides: Partial<Task> = {}): Task {
  return {
    id,
    assigned_user_id: 3,
    status: 'completed',
    completed_at: new Date('2026-02-10T15:00:00Z'),
    completion_cost: null,
    accepted_quote: false,
    completion_hourly_rate: null,
    completion_monthly_salary: null,
    completion_month_minutes: null,
    ...overrides,
  };
}

function makeStore(isInternal: number | null, weekly: string | null = null) {
  const user = { id: 3, is_internal: isInternal, monthly_salary: null as number | null };
  const tasks: Task[] = [
    task(1, { completion_hourly_rate: 30000 }), // frozen under the hourly model, Feb 2026
    task(2, { completed_at: new Date('2026-03-10T15:00:00Z') }), // March 2026
    task(3, { completed_at: new Date('2026-03-01T03:00:00Z') }), // Feb 28 in Bogotá
    task(4, { completion_cost: 500000 }), // external price
    task(5, { accepted_quote: true }), // accepted quote
    task(6, { status: 'in_progress', completed_at: null }), // unfinished
    task(7, { completed_at: null }), // completed without date
    task(8, { completion_hourly_rate: 20000, completion_monthly_salary: 4000000, completion_month_minutes: 10584 }),
    task(9, { assigned_user_id: 4 }), // another collaborator
  ];

  mockTx.execute.mockImplementation(async (q: Query) => {
    const sql = q.sql;
    const args = q.args ?? [];
    if (/UPDATE users/.test(sql)) {
      user.monthly_salary = args[0] as number;
      return makeResult([{ id: user.id, is_internal: user.is_internal, monthly_salary: user.monthly_salary }]);
    }
    if (/FROM app_settings/.test(sql)) return makeResult(weekly === null ? [] : [{ value: weekly }]);
    if (/SELECT[\s\S]*FROM project_tasks/.test(sql)) {
      // Each filter only applies when the SQL carries it, so a missing guard is visible.
      const rows = tasks.filter((t) =>
        (!/assigned_user_id = \$1/.test(sql) || t.assigned_user_id === args[0]) &&
        (!sql.includes("status = 'completed'") || t.status === 'completed') &&
        (!sql.includes('completed_at IS NOT NULL') || t.completed_at !== null) &&
        (!sql.includes('completion_monthly_salary IS NULL') || t.completion_monthly_salary === null) &&
        (!sql.includes('completion_cost IS NULL') || t.completion_cost === null) &&
        (!sql.includes("tq.status = 'accepted'") || !t.accepted_quote)
      );
      return makeResult(rows.map((t) => ({ id: t.id, completed_at: t.completed_at })));
    }
    if (/UPDATE project_tasks/.test(sql)) {
      const [id, rate, salary, minutes] = args as number[];
      const t = tasks.find((x) => x.id === id)!;
      t.completion_hourly_rate = rate;
      t.completion_monthly_salary = salary;
      t.completion_month_minutes = minutes;
      return makeResult([]);
    }
    throw new Error(`unexpected SQL: ${sql}`);
  });
  mockExecute.mockResolvedValue(makeResult([userRow]));
  return { user, tasks };
}

const frozen = (t: Task) => [t.completion_hourly_rate, t.completion_monthly_salary, t.completion_month_minutes];

describe('updateUser() monthly salary', () => {
  it('recalculates once the eligible completed tasks with the month they were completed in', async () => {
    const { tasks } = makeStore(1);

    await updateUser('3', { monthly_salary: 5040000 });

    expect(frozen(tasks[0])).toEqual([30000, 5040000, 10080]);
    expect(frozen(tasks[1])).toEqual([28571.43, 5040000, 10584]);
    expect(frozen(tasks[2])).toEqual([30000, 5040000, 10080]);
    for (const i of [3, 4, 5, 6]) expect(frozen(tasks[i])).toEqual([null, null, null]);
    expect(frozen(tasks[7])).toEqual([20000, 4000000, 10584]);
    expect(frozen(tasks[8])).toEqual([null, null, null]);
    expect(mockTx.commit).toHaveBeenCalledTimes(1);
    expect(mockTx.rollback).not.toHaveBeenCalled();
  });

  it('never touches tasks already frozen under the monthly model on a later salary change', async () => {
    const { tasks } = makeStore(1);

    await updateUser('3', { monthly_salary: 5040000 });
    await updateUser('3', { monthly_salary: 6000000 });

    expect(frozen(tasks[0])).toEqual([30000, 5040000, 10080]);
    expect(frozen(tasks[1])).toEqual([28571.43, 5040000, 10584]);
    expect(frozen(tasks[7])).toEqual([20000, 4000000, 10584]);
  });

  it('uses the weekly_work_hours setting for the month minutes', async () => {
    const { tasks } = makeStore(1, '40');

    await updateUser('3', { monthly_salary: 4800000 });

    // February 2026: 20 days × 480 min = 9600 min -> 4800000 / 9600 × 60
    expect(frozen(tasks[0])).toEqual([30000, 4800000, 9600]);
  });

  it.each([
    ['an external collaborator', 0, 5040000],
    ['a collaborator without internal flag', null, 5040000],
    ['an internal with salary 0', 1, 0],
  ])('does not touch tasks for %s', async (_label, isInternal, salary) => {
    const { tasks } = makeStore(isInternal as number | null);
    const before = tasks.map(frozen);

    await updateUser('3', { monthly_salary: salary as number });

    expect(tasks.map(frozen)).toEqual(before);
    const queried = mockTx.execute.mock.calls.some(([q]) => /FROM project_tasks/.test((q as Query).sql));
    expect(queried).toBe(false);
    expect(mockTx.commit).toHaveBeenCalledTimes(1);
  });

  it('rolls back and reports the error when the recalculation fails', async () => {
    makeStore(1);
    const fallback = mockTx.execute.getMockImplementation()!;
    mockTx.execute.mockImplementation(async (q: Query) => {
      if (/UPDATE project_tasks/.test(q.sql)) throw new Error('db exploded');
      return fallback(q);
    });

    await expect(updateUser('3', { monthly_salary: 5040000 })).rejects.toThrow('No se pudo actualizar el usuario');
    expect(mockTx.rollback).toHaveBeenCalledTimes(1);
    expect(mockTx.commit).not.toHaveBeenCalled();
  });

  it('does not touch project tasks when monthly_salary is not provided', async () => {
    mockExecute
      .mockResolvedValueOnce(makeResult([]))
      .mockResolvedValueOnce(makeResult([userRow]));

    await updateUser('3', { name: 'Ana B' });

    const call = mockExecute.mock.calls[0][0] as { sql: string };
    expect(call.sql).toContain('name = $1');
    expect(call.sql).not.toMatch(/project_tasks/);
    expect(call.sql).not.toContain('hourly_rate');
    expect(mockTransaction).not.toHaveBeenCalled();
  });
});

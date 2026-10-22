// S3, S6: internal hourly rate replaces the monthly salary; setting it freezes
// the rate on the collaborator's completed internal tasks that have none yet.
jest.mock('@/lib/db', () => ({
  db: { execute: jest.fn() },
}));

import { db } from '@/lib/db';
import { getUserById, updateUser } from '@/lib/queries/users';

const mockExecute = db.execute as jest.MockedFunction<typeof db.execute>;

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
  area_id: null, is_internal: 1, is_active: 1, hourly_rate: '30000.00',
  must_change_password: 0, last_login: null, created_at: null,
};

beforeEach(() => jest.clearAllMocks());

describe('getUserById() hourly rate', () => {
  it('maps hourly_rate as a number and no longer exposes monthly_salary', async () => {
    mockExecute.mockResolvedValueOnce(makeResult([{ ...userRow, monthly_salary: 5000000 }]));
    const user = await getUserById(3);
    expect(user.hourly_rate).toBe(30000);
    expect(user).not.toHaveProperty('monthly_salary');
  });

  it('maps a missing hourly_rate to null', async () => {
    mockExecute.mockResolvedValueOnce(makeResult([{ ...userRow, hourly_rate: null }]));
    const user = await getUserById(3);
    expect(user.hourly_rate).toBeNull();
  });
});

describe('updateUser() hourly rate', () => {
  it('sets hourly_rate and freezes it only on completed internal tasks without a rate, in one statement', async () => {
    mockExecute
      .mockResolvedValueOnce(makeResult([]))
      .mockResolvedValueOnce(makeResult([userRow]));

    await updateUser('3', { hourly_rate: 30000 });

    const call = mockExecute.mock.calls[0][0] as { sql: string; args: unknown[] };
    expect(call.sql).toContain('hourly_rate = $1');
    expect(call.sql).toMatch(/UPDATE project_tasks/);
    expect(call.sql).toContain('completion_hourly_rate IS NULL');
    expect(call.sql).toContain("pt.status = 'completed'");
    expect(call.sql).toContain('is_internal = 1');
    expect(call.sql).toContain('completion_cost IS NULL');
    expect(call.sql).toContain("tq.status = 'accepted'");
    expect(call.args).toEqual([30000, '3']);
  });

  it('does not touch project tasks when hourly_rate is not provided', async () => {
    mockExecute
      .mockResolvedValueOnce(makeResult([]))
      .mockResolvedValueOnce(makeResult([userRow]));

    await updateUser('3', { name: 'Ana B' });

    const call = mockExecute.mock.calls[0][0] as { sql: string };
    expect(call.sql).not.toMatch(/project_tasks/);
    expect(call.sql).not.toContain('monthly_salary');
  });
});

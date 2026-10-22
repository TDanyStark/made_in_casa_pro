// S1, S4, S5: SQL behind project financials.
jest.mock('@/lib/db', () => ({ db: { execute: jest.fn() } }));
jest.mock('next/cache', () => ({ revalidatePath: jest.fn() }));

import { db } from '@/lib/db';
import { getProjectFinancials, updateProjectSalePrice } from '@/lib/queries/projectFinancials';

const mockExecute = db.execute as jest.MockedFunction<typeof db.execute>;
const res = (rows: Record<string, unknown>[], rowsAffected = rows.length) =>
  ({ rows, columns: [], columnTypes: [], rowsAffected, toJSON: () => ({}) }) as never;

beforeEach(() => jest.clearAllMocks());

describe('getProjectFinancials()', () => {
  it('returns null when the project does not exist', async () => {
    mockExecute.mockResolvedValueOnce(res([]));
    expect(await getProjectFinancials(9)).toBeNull();
    expect(mockExecute).toHaveBeenCalledTimes(1);
  });

  const anaRow = {
    assigned_user_id: 1, assigned_user_name: 'Ana', assignee_is_internal: 1, assignee_hourly_rate: '99',
    status: 'completed', progress_minutes: 60, completion_hourly_rate: '300', completion_cost: null, accepted_quote_price: null,
  };
  const versionRows = [{ id: '4', version_number: '1' }, { id: 7, version_number: 2 }];

  it('reads frozen rates, external prices and accepted quotes of the project tasks', async () => {
    mockExecute
      .mockResolvedValueOnce(res([{ sale_price: '1000.00' }]))
      .mockResolvedValueOnce(res(versionRows))
      .mockResolvedValueOnce(res([anaRow]));
    const r = await getProjectFinancials(9);
    const sql = (mockExecute.mock.calls[2][0] as { sql: string; args: unknown[] });
    expect(sql.sql).toContain('pt.completion_hourly_rate');
    expect(sql.sql).toContain("tq.status = 'accepted'");
    expect(sql.sql).not.toContain('pt.adjustment_id');
    expect(sql.args).toEqual([9]);
    expect(r).toMatchObject({ sale_price: 1000, internal_cost: 300, margin: 700, adjustment_id: null });
  });

  // S9: versions list and version filter.
  it('lists the project versions ordered by version number', async () => {
    mockExecute
      .mockResolvedValueOnce(res([{ sale_price: null }]))
      .mockResolvedValueOnce(res(versionRows))
      .mockResolvedValueOnce(res([]));
    const r = await getProjectFinancials(9);
    const sql = (mockExecute.mock.calls[1][0] as { sql: string; args: unknown[] });
    expect(sql.sql).toContain('FROM project_adjustments');
    expect(sql.sql).toContain('ORDER BY version_number');
    expect(sql.args).toEqual([9]);
    expect(r?.versions).toEqual([{ id: 4, version_number: 1 }, { id: 7, version_number: 2 }]);
  });

  it('filters the tasks by version and hides the project-level margin', async () => {
    mockExecute
      .mockResolvedValueOnce(res([{ sale_price: '1000.00' }]))
      .mockResolvedValueOnce(res(versionRows))
      .mockResolvedValueOnce(res([anaRow]));
    const r = await getProjectFinancials(9, 7);
    const sql = (mockExecute.mock.calls[2][0] as { sql: string; args: unknown[] });
    expect(sql.sql).toContain('pt.adjustment_id = $2');
    expect(sql.args).toEqual([9, 7]);
    expect(r).toMatchObject({
      sale_price: 1000, internal_cost: 300, total_cost: 300, margin: null, adjustment_id: 7,
      versions: [{ id: 4, version_number: 1 }, { id: 7, version_number: 2 }],
    });
  });
});

describe('updateProjectSalePrice()', () => {
  it('updates sale_price and reports whether the project exists', async () => {
    mockExecute.mockResolvedValueOnce(res([{ id: 9 }]));
    expect(await updateProjectSalePrice(9, 2500)).toBe(true);
    expect(mockExecute.mock.calls[0][0]).toEqual(expect.objectContaining({
      sql: expect.stringContaining('SET sale_price = $2'),
      args: [9, 2500],
    }));
    mockExecute.mockResolvedValueOnce(res([]));
    expect(await updateProjectSalePrice(9, null)).toBe(false);
  });
});

jest.mock('@/lib/db', () => ({
  db: {
    execute: jest.fn(),
  },
}));

jest.mock('next/cache', () => ({
  revalidatePath: jest.fn(),
}));

import { db } from '@/lib/db';
import {
  createProject,
  getProjectById,
  recalculateProjectProgress,
  updateProject,
} from '@/lib/queries/projects';

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

describe('project queries metadata fields', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('getProjectById selects the new metadata columns', async () => {
    mockExecute.mockResolvedValueOnce(makeResult([{ id: 1, ideal_delivery_at: null, oc: null, billing_closed_at: null }]));

    await getProjectById(1);

    expect(mockExecute).toHaveBeenCalledWith(
      expect.objectContaining({
        sql: expect.stringContaining('p.ideal_delivery_at'),
      })
    );
    expect(mockExecute).toHaveBeenCalledWith(
      expect.objectContaining({
        sql: expect.stringContaining('p.billing_closed_at'),
      })
    );
  });

  it('createProject persists ideal delivery, oc and billing closure fields', async () => {
    mockExecute
      .mockResolvedValueOnce(makeResult([{ id: 15 }]))
      .mockResolvedValueOnce(makeResult([]))
      .mockResolvedValueOnce(
        makeResult([
          {
            id: 15,
            title: 'Proyecto',
            ideal_delivery_at: '2026-04-07T14:30:00.000Z',
            oc: 'OC-100',
            billing_closed_at: '2026-04-20T17:00:00.000Z',
          },
        ])
      );

    await createProject({
      title: 'Proyecto',
      brand_id: 2,
      manager_id: 3,
      ideal_delivery_at: '2026-04-07T14:30:00.000Z',
      oc: 'OC-100',
      billing_closed_at: '2026-04-20T17:00:00.000Z',
    });

    expect(mockExecute).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        sql: expect.stringContaining('billing_closed_at'),
        args: [
          'Proyecto',
          2,
          3,
          null,
          null,
          null,
          null,
          null,
          '2026-04-07T14:30:00.000Z',
          'OC-100',
          '2026-04-20T17:00:00.000Z',
          'active',
          null,
        ],
      })
    );
  });

  it('updateProject patches the new metadata fields without touching completed_at', async () => {
    mockExecute
      .mockResolvedValueOnce(makeResult([{ id: 9, status: 'active' }]))
      .mockResolvedValueOnce(makeResult([]))
      .mockResolvedValueOnce(
        makeResult([
          {
            id: 9,
            ideal_delivery_at: '2026-04-07T14:30:00.000Z',
            oc: null,
            billing_closed_at: '2026-04-20T17:00:00.000Z',
          },
        ])
      );

    await updateProject(9, {
      ideal_delivery_at: '2026-04-07T14:30:00.000Z',
      oc: null,
      billing_closed_at: '2026-04-20T17:00:00.000Z',
    });

    expect(mockExecute).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        sql: expect.stringContaining('ideal_delivery_at = $1'),
        args: [
          '2026-04-07T14:30:00.000Z',
          null,
          '2026-04-20T17:00:00.000Z',
          9,
        ],
      })
    );
    expect((mockExecute.mock.calls[1]?.[0] as { sql: string }).sql).not.toContain('completed_at');
  });

  it('recalculateProjectProgress completes the project without overwriting billing closure metadata', async () => {
    mockExecute
      .mockResolvedValueOnce(makeResult([{ id: 33 }]))
      .mockResolvedValueOnce(makeResult([{ total: '4', completed: '4' }]))
      .mockResolvedValueOnce(makeResult([]))
      .mockResolvedValueOnce(makeResult([]));

    const progress = await recalculateProjectProgress(33);

    expect(progress).toBe(100);
    expect(mockExecute).toHaveBeenNthCalledWith(
      4,
      expect.objectContaining({
        sql: expect.stringContaining("completed_at = COALESCE(completed_at, CURRENT_TIMESTAMP)"),
        args: [100, 33],
      })
    );

    const finalUpdateSql = (mockExecute.mock.calls[3]?.[0] as { sql: string }).sql;
    expect(finalUpdateSql).toContain("completed_at = COALESCE(completed_at, CURRENT_TIMESTAMP)");
    expect(finalUpdateSql).not.toContain('billing_closed_at');
  });
});

// Spec: odd/tasks/project-costs.md — S2, S3, S5, S6: SQL behind associated project costs.
jest.mock('@/lib/db', () => ({ db: { execute: jest.fn() } }));
jest.mock('next/cache', () => ({ revalidatePath: jest.fn() }));

import { db } from '@/lib/db';
import { revalidatePath } from 'next/cache';
import {
  listCostCategories,
  createCostCategory,
  getProjectCostVersions,
  listProjectCosts,
  getProjectCostsTotal,
  getProjectCost,
  createProjectCost,
  updateProjectCost,
  deleteProjectCost,
} from '@/lib/queries/projectCosts';
import {
  ProjectCostError,
  resolveCostAdjustmentId,
  PROJECT_COST_VERSION_REQUIRED_MESSAGE,
  PROJECT_COST_VERSION_FOREIGN_MESSAGE,
  PROJECT_COST_TASK_FOREIGN_MESSAGE,
  PROJECT_COST_CATEGORY_MISSING_MESSAGE,
} from '@/lib/definitions';

type Query = { sql: string; args: unknown[] };
const mockExecute = db.execute as jest.MockedFunction<typeof db.execute>;
const res = (rows: Record<string, unknown>[]) => ({ rows }) as never;
const calls = () => mockExecute.mock.calls.map(([q]) => q as unknown as Query);

const costRow = {
  id: '5', project_id: '10', adjustment_id: '4', version_number: '1', category_id: '2',
  category_name: 'Herramientas y créditos', description: 'Tokens ChatGPT', amount: '150000.50',
  incurred_at: '2026-03-10', task_id: null, task_title: null, created_by: '77', created_by_name: 'Ana',
  updated_by: null, created_at: '2026-03-10T10:00:00Z', updated_at: '2026-03-10T10:00:00Z',
};
const cost = {
  id: 5, project_id: 10, adjustment_id: 4, version_number: 1, category_id: 2,
  category_name: 'Herramientas y créditos', description: 'Tokens ChatGPT', amount: 150000.5,
  incurred_at: '2026-03-10', task_id: null, task_title: null, created_by: 77, created_by_name: 'Ana',
  updated_by: null, created_at: '2026-03-10T10:00:00Z', updated_at: '2026-03-10T10:00:00Z',
};

beforeEach(() => jest.clearAllMocks());

describe('resolveCostAdjustmentId() (S5)', () => {
  const one = [{ id: 4, version_number: 1 }];
  const two = [...one, { id: 7, version_number: 2 }];

  it('takes the only version when none is given', () => {
    expect(resolveCostAdjustmentId(one, undefined)).toBe(4);
    expect(resolveCostAdjustmentId(one, null)).toBe(4);
  });

  it('requires the version when the project has 2+ versions', () => {
    expect(() => resolveCostAdjustmentId(two, undefined)).toThrow(new ProjectCostError(PROJECT_COST_VERSION_REQUIRED_MESSAGE));
    expect(() => resolveCostAdjustmentId(two, null)).toThrow(ProjectCostError);
  });

  it('accepts a version of the project and rejects a foreign one', () => {
    expect(resolveCostAdjustmentId(two, 7)).toBe(7);
    expect(() => resolveCostAdjustmentId(two, 99)).toThrow(PROJECT_COST_VERSION_FOREIGN_MESSAGE);
    expect(() => resolveCostAdjustmentId(one, 99)).toThrow(PROJECT_COST_VERSION_FOREIGN_MESSAGE);
  });
});

describe('categories (S6)', () => {
  it('lists categories ordered by name, case-insensitively', async () => {
    mockExecute.mockResolvedValueOnce(res([{ id: '1', name: 'Otro', created_by: null, created_at: 'x' }]));
    expect(await listCostCategories()).toEqual([{ id: 1, name: 'Otro', created_by: null, created_at: 'x' }]);
    expect(calls()[0].sql).toMatch(/FROM project_cost_categories/);
    expect(calls()[0].sql).toMatch(/ORDER BY lower\(name\)/);
  });

  it('creates a trimmed category and reports it as created', async () => {
    mockExecute.mockResolvedValueOnce(res([{ id: 9, name: 'Higgsfield', created_by: 77, created_at: 'x' }]));
    const r = await createCostCategory('  Higgsfield  ', 77);
    expect(r).toEqual({ created: true, category: { id: 9, name: 'Higgsfield', created_by: 77, created_at: 'x' } });
    expect(calls()[0].sql).toMatch(/INSERT INTO project_cost_categories/);
    expect(calls()[0].sql).toMatch(/ON CONFLICT \(\(lower\(name\)\)\) DO NOTHING/);
    expect(calls()[0].args).toEqual(['Higgsfield', 77]);
  });

  it('returns the existing category on a case-insensitive duplicate', async () => {
    mockExecute
      .mockResolvedValueOnce(res([]))
      .mockResolvedValueOnce(res([{ id: '3', name: 'Otro', created_by: null, created_at: 'x' }]));
    const r = await createCostCategory('OTRO', 77);
    expect(r).toEqual({ created: false, category: { id: 3, name: 'Otro', created_by: null, created_at: 'x' } });
    expect(calls()[1].sql).toMatch(/WHERE lower\(name\) = lower\(\$1\)/);
    expect(calls()[1].args).toEqual(['OTRO']);
  });
});

describe('getProjectCostVersions()', () => {
  it('lists the project versions ordered by number', async () => {
    mockExecute.mockResolvedValueOnce(res([{ id: '4', version_number: '1' }, { id: 7, version_number: 2 }]));
    expect(await getProjectCostVersions(10)).toEqual([{ id: 4, version_number: 1 }, { id: 7, version_number: 2 }]);
    expect(calls()[0].sql).toMatch(/FROM project_adjustments WHERE project_id = \$1 ORDER BY version_number/);
    expect(calls()[0].args).toEqual([10]);
  });
});

describe('listProjectCosts()', () => {
  it('lists the project costs with category, version, task and creator', async () => {
    mockExecute.mockResolvedValueOnce(res([costRow]));
    expect(await listProjectCosts(10)).toEqual([cost]);
    const q = calls()[0];
    expect(q.sql).toMatch(/JOIN project_cost_categories/);
    expect(q.sql).toMatch(/JOIN project_adjustments/);
    expect(q.sql).toMatch(/LEFT JOIN project_tasks/);
    expect(q.sql).toMatch(/LEFT JOIN users/);
    expect(q.sql).toMatch(/WHERE pc\.project_id = \$1/);
    expect(q.sql).not.toMatch(/pc\.adjustment_id = \$2/);
    expect(q.args).toEqual([10]);
  });

  it('filters by version (S5)', async () => {
    mockExecute.mockResolvedValueOnce(res([]));
    await listProjectCosts(10, 7);
    expect(calls()[0].sql).toMatch(/pc\.project_id = \$1 AND pc\.adjustment_id = \$2/);
    expect(calls()[0].args).toEqual([10, 7]);
  });
});

describe('getProjectCostsTotal()', () => {
  it('sums the costs with a per-category breakdown', async () => {
    mockExecute.mockResolvedValueOnce(res([
      { category_id: '2', category_name: 'Herramientas y créditos', total: '150000.50' },
      { category_id: 1, category_name: 'Pago comercial', total: '100000.25' },
    ]));
    expect(await getProjectCostsTotal(10)).toEqual({
      total: 250000.75,
      by_category: [
        { category_id: 2, category_name: 'Herramientas y créditos', total: 150000.5 },
        { category_id: 1, category_name: 'Pago comercial', total: 100000.25 },
      ],
    });
    expect(calls()[0].sql).toMatch(/SUM\(pc\.amount\)/);
    expect(calls()[0].sql).toMatch(/GROUP BY/);
    expect(calls()[0].args).toEqual([10]);
  });

  it('filters by version and returns 0 without costs', async () => {
    mockExecute.mockResolvedValueOnce(res([]));
    expect(await getProjectCostsTotal(10, 7)).toEqual({ total: 0, by_category: [] });
    expect(calls()[0].sql).toMatch(/pc\.adjustment_id = \$2/);
    expect(calls()[0].args).toEqual([10, 7]);
  });
});

describe('getProjectCost()', () => {
  it('reads a cost scoped by project', async () => {
    mockExecute.mockResolvedValueOnce(res([costRow]));
    expect(await getProjectCost(10, 5)).toEqual(cost);
    expect(calls()[0].sql).toMatch(/pc\.project_id = \$1 AND pc\.id = \$2/);
    expect(calls()[0].args).toEqual([10, 5]);
  });

  it('returns null for a cost of another project', async () => {
    mockExecute.mockResolvedValueOnce(res([]));
    expect(await getProjectCost(10, 5)).toBeNull();
  });
});

/** Answers the link checks; `fail` names the check that finds nothing. */
function linkChecks(fail?: 'version' | 'category' | 'task', extra: (q: Query) => unknown = () => undefined) {
  mockExecute.mockImplementation((async (q: Query) => {
    if (/FROM project_adjustments/.test(q.sql)) return res(fail === 'version' ? [] : [{ id: 4 }]);
    if (/FROM project_cost_categories WHERE id/.test(q.sql)) return res(fail === 'category' ? [] : [{ id: 2 }]);
    if (/FROM project_tasks WHERE id/.test(q.sql)) return res(fail === 'task' ? [] : [{ id: 8 }]);
    return extra(q) ?? res([costRow]);
  }) as never);
}
const mutations = () => calls().filter((q) => /INSERT INTO|UPDATE project_costs|DELETE FROM/.test(q.sql));

describe('createProjectCost()', () => {
  const input = { adjustment_id: 4, category_id: 2, description: 'Tokens ChatGPT', amount: 150000.5, incurred_at: '2026-03-10', task_id: 8 };

  it('validates version, category and task (S3) then inserts with the creator', async () => {
    linkChecks(undefined, (q) => (/INSERT INTO project_costs/.test(q.sql) ? res([{ id: 5 }]) : undefined));
    expect(await createProjectCost(10, input, 77)).toEqual(cost);
    const adj = calls().find((q) => /FROM project_adjustments/.test(q.sql))!;
    expect(adj.sql).toMatch(/WHERE id = \$1 AND project_id = \$2/);
    expect(adj.args).toEqual([4, 10]);
    const task = calls().find((q) => /FROM project_tasks/.test(q.sql))!;
    expect(task.sql).toMatch(/WHERE id = \$1 AND project_id = \$2 AND adjustment_id = \$3/);
    expect(task.args).toEqual([8, 10, 4]);
    const insert = calls().find((q) => /INSERT INTO project_costs/.test(q.sql))!;
    expect(insert.args).toEqual([10, 4, 2, 'Tokens ChatGPT', 150000.5, '2026-03-10', 8, 77]);
    expect(revalidatePath).toHaveBeenCalledWith('/projects/10');
  });

  it('defaults the date to today in SQL and the task and description to null', async () => {
    linkChecks(undefined, (q) => (/INSERT INTO project_costs/.test(q.sql) ? res([{ id: 5 }]) : undefined));
    await createProjectCost(10, { adjustment_id: 4, category_id: 2, amount: 10 }, 77);
    const insert = calls().find((q) => /INSERT INTO project_costs/.test(q.sql))!;
    expect(insert.sql).toMatch(/COALESCE\(\$6::date, CURRENT_DATE\)/);
    expect(insert.args).toEqual([10, 4, 2, null, 10, null, null, 77]);
    expect(calls().some((q) => /FROM project_tasks/.test(q.sql))).toBe(false);
  });

  it.each([
    ['version', PROJECT_COST_VERSION_FOREIGN_MESSAGE],
    ['category', PROJECT_COST_CATEGORY_MISSING_MESSAGE],
    ['task', PROJECT_COST_TASK_FOREIGN_MESSAGE],
  ] as const)('rejects a foreign %s and inserts nothing', async (fail, message) => {
    linkChecks(fail);
    await expect(createProjectCost(10, input, 77)).rejects.toThrow(new ProjectCostError(message));
    expect(mutations()).toEqual([]);
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});

describe('updateProjectCost()', () => {
  it('returns null and changes nothing for a cost of another project', async () => {
    mockExecute.mockResolvedValue(res([]));
    expect(await updateProjectCost(10, 5, { amount: 1 }, 77)).toBeNull();
    expect(mutations()).toEqual([]);
  });

  it('updates only the given fields, scoped by project, recording who edited', async () => {
    linkChecks();
    expect(await updateProjectCost(10, 5, { amount: 2000, description: null }, 88)).toEqual(cost);
    const update = calls().find((q) => /UPDATE project_costs/.test(q.sql))!;
    expect(update.sql).toMatch(/WHERE id = \$\d+ AND project_id = \$\d+/);
    expect(update.sql).toMatch(/updated_by = /);
    expect(update.sql).toMatch(/updated_at = (CURRENT_TIMESTAMP|now\(\))/);
    // Current row: adjustment 4, category 2, no task; amount and description change.
    expect(update.args).toEqual([4, 2, null, 2000, '2026-03-10', null, 88, 5, 10]);
    expect(revalidatePath).toHaveBeenCalledWith('/projects/10');
  });

  it('rejects moving a linked task cost to a version the task does not belong to', async () => {
    mockExecute.mockImplementation((async (q: Query) => {
      if (/FROM project_tasks WHERE id/.test(q.sql)) return res([]);
      if (/FROM project_adjustments/.test(q.sql)) return res([{ id: 7 }]);
      if (/FROM project_cost_categories WHERE id/.test(q.sql)) return res([{ id: 2 }]);
      return res([{ ...costRow, task_id: '8', task_title: 'Pauta' }]);
    }) as never);
    await expect(updateProjectCost(10, 5, { adjustment_id: 7 }, 88)).rejects.toThrow(PROJECT_COST_TASK_FOREIGN_MESSAGE);
    expect(calls().find((q) => /FROM project_tasks/.test(q.sql))!.args).toEqual([8, 10, 7]);
    expect(mutations()).toEqual([]);
  });
});

describe('deleteProjectCost()', () => {
  it('deletes scoped by project', async () => {
    mockExecute.mockResolvedValueOnce(res([{ id: 5 }]));
    expect(await deleteProjectCost(10, 5)).toBe(true);
    expect(calls()[0].sql).toMatch(/DELETE FROM project_costs WHERE id = \$1 AND project_id = \$2/);
    expect(calls()[0].args).toEqual([5, 10]);
    expect(revalidatePath).toHaveBeenCalledWith('/projects/10');
  });

  it('returns false for a cost of another project', async () => {
    mockExecute.mockResolvedValueOnce(res([]));
    expect(await deleteProjectCost(10, 5)).toBe(false);
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});

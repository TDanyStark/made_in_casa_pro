// S20: adjustment completion/deletion are scoped to the project, and the next
// version number is computed while holding the project row lock.
const mockTransaction = {
  execute: jest.fn(),
  commit: jest.fn(),
  rollback: jest.fn(),
};

jest.mock("@/lib/db", () => ({
  db: {
    execute: jest.fn(),
    transaction: jest.fn(() => Promise.resolve(mockTransaction)),
  },
}));

import {
  createProjectAdjustment,
  deleteProjectAdjustment,
} from "@/lib/queries/adjustments";

type Query = { sql: string; args?: unknown[] };
const calls = () => mockTransaction.execute.mock.calls.map(([q]) => q as Query);

beforeEach(() => {
  jest.clearAllMocks();
  mockTransaction.execute.mockReset();
  mockTransaction.commit.mockReset().mockResolvedValue(undefined);
  mockTransaction.rollback.mockReset().mockResolvedValue(undefined);
});

describe("createProjectAdjustment()", () => {
  it("locks the project row before reading the highest version number", async () => {
    mockTransaction.execute.mockImplementation(async (q: Query) => {
      if (/MAX\(version_number\)/.test(q.sql)) return { rows: [{ max_v: 2 }] };
      if (/INSERT INTO project_adjustments/.test(q.sql)) return { rows: [{ id: 30, version_number: 3 }] };
      return { rows: [] };
    });

    const adjustment = await createProjectAdjustment({ project_id: 15 });

    const sqls = calls().map((q) => q.sql);
    const lock = sqls.findIndex((sql) => /FROM projects WHERE id = \$1 FOR NO KEY UPDATE$/.test(sql));
    const max = sqls.findIndex((sql) => /MAX\(version_number\)/.test(sql));
    expect(lock).toBe(0);
    expect(calls()[0].args).toEqual([15]);
    expect(max).toBeGreaterThan(lock);
    expect(calls().find((q) => /INSERT INTO project_adjustments/.test(q.sql))!.args![1]).toBe(3);
    expect(adjustment).toEqual({ id: 30, version_number: 3 });
  });
});

describe("deleteProjectAdjustment()", () => {
  it("throws 'Ajuste no encontrado' and deletes nothing for an adjustment of another project", async () => {
    mockTransaction.execute.mockResolvedValue({ rows: [] });

    await expect(deleteProjectAdjustment(30, 15)).rejects.toThrow("Ajuste no encontrado");

    expect(calls()[0].sql).toMatch(/WHERE id = \$1 AND project_id = \$2/);
    expect(calls()[0].args).toEqual([30, 15]);
    expect(calls().some((q) => /DELETE FROM/.test(q.sql))).toBe(false);
    expect(mockTransaction.commit).not.toHaveBeenCalled();
  });

  it("deletes an empty active adjustment of the project (previous behavior)", async () => {
    mockTransaction.execute.mockImplementation(async (q: Query) => {
      if (/SELECT status FROM project_adjustments/.test(q.sql)) return { rows: [{ status: "active" }] };
      if (/COUNT\(\*\)/.test(q.sql)) return { rows: [{ count: 0 }] };
      return { rows: [] };
    });

    await deleteProjectAdjustment(30, 15);

    const del = calls().find((q) => /DELETE FROM project_adjustments/.test(q.sql))!;
    expect(del.sql).toMatch(/WHERE id = \$1 AND project_id = \$2/);
    expect(del.args).toEqual([30, 15]);
    expect(mockTransaction.commit).toHaveBeenCalledTimes(1);
  });
});

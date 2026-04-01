jest.mock("@/lib/db", () => ({
  db: {
    execute: jest.fn(),
  },
}));

import { db } from "@/lib/db";
import { getMyTasksWithPagination } from "@/lib/queries/projectTasks";

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

describe("getMyTasksWithPagination", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("applies default statuses when statuses is undefined", async () => {
    mockExecute
      .mockResolvedValueOnce(makeResult([{ count: 0 }]))
      .mockResolvedValueOnce(makeResult([]));

    await getMyTasksWithPagination({ userId: 12, page: 1, limit: 10 });

    const countCall = mockExecute.mock.calls[0][0] as { sql: string; args: unknown[] };
    expect(countCall.sql).toContain("pt.status = ANY($");
    expect(countCall.args).toContainEqual([
      "not_started",
      "in_progress",
      "blocked",
      "waiting",
    ]);
  });

  it("builds q OR filter sharing the same placeholder", async () => {
    mockExecute
      .mockResolvedValueOnce(makeResult([{ count: 0 }]))
      .mockResolvedValueOnce(makeResult([]));

    await getMyTasksWithPagination({ userId: 4, q: "cocina", page: 1, limit: 10 });

    const countCall = mockExecute.mock.calls[0][0] as { sql: string; args: unknown[] };
    expect(countCall.sql).toMatch(/\(pt\.title ILIKE \$1 OR p\.title ILIKE \$1\)/);
    expect(countCall.args[0]).toBe("%cocina%");
  });

  it("applies brandId filter", async () => {
    mockExecute
      .mockResolvedValueOnce(makeResult([{ count: 0 }]))
      .mockResolvedValueOnce(makeResult([]));

    await getMyTasksWithPagination({ userId: 8, brandId: 5, page: 1, limit: 10 });

    const countCall = mockExecute.mock.calls[0][0] as { sql: string; args: unknown[] };
    expect(countCall.sql).toContain("p.brand_id = $");
    expect(countCall.args).toContain(5);
  });

  it("uses correct offset for page 2", async () => {
    mockExecute
      .mockResolvedValueOnce(makeResult([{ count: 0 }]))
      .mockResolvedValueOnce(makeResult([]));

    await getMyTasksWithPagination({ userId: 3, page: 2, limit: 10, statuses: ["in_progress"] });

    const dataCall = mockExecute.mock.calls[1][0] as { sql: string; args: unknown[] };
    expect(dataCall.sql).toContain("LIMIT $");
    expect(dataCall.sql).toContain("OFFSET $");
    expect(dataCall.args.slice(-2)).toEqual([10, 10]);
  });

  it("includes adjustment version in data query", async () => {
    mockExecute
      .mockResolvedValueOnce(makeResult([{ count: 0 }]))
      .mockResolvedValueOnce(makeResult([]));

    await getMyTasksWithPagination({ userId: 3, page: 1, limit: 10 });

    const dataCall = mockExecute.mock.calls[1][0] as { sql: string; args: unknown[] };
    expect(dataCall.sql).toContain("COALESCE(pa.version_number, 1) AS version_number");
    expect(dataCall.sql).toContain("LEFT JOIN project_adjustments pa ON pa.id = pt.adjustment_id");
    expect(dataCall.args.slice(-2)).toEqual([10, 0]);
  });
});

jest.mock("@/lib/db", () => ({
  db: {
    execute: jest.fn(),
  },
}));

import { db } from "@/lib/db";
import { getTasksCommandCenterWithPagination } from "@/lib/queries/projectTasks";

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

describe("getTasksCommandCenterWithPagination", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("always constrains creator role to admin/directivo/financiero/comercial", async () => {
    mockExecute
      .mockResolvedValueOnce(makeResult([{ count: 2 }]))
      .mockResolvedValueOnce(
        makeResult([
          {
            id: 10,
            title: "QA entrega",
            project_id: 4,
            project_title: "Campaña x",
            product_name: "Video",
            assigned_user_id: 7,
            assigned_user_name: "Ana",
            task_flag: "new",
            task_type: "validation",
            status: "in_progress",
            assigned_at: "2026-03-20T10:00:00.000Z",
            completed_at: null,
          },
        ])
      );

    const result = await getTasksCommandCenterWithPagination({ page: 1, limit: 10 });

    expect(result.total).toBe(2);
    expect(result.tasks).toHaveLength(1);
    expect(mockExecute).toHaveBeenCalledTimes(2);

    const countCall = mockExecute.mock.calls[0][0] as { sql: string; args: unknown[] };
    expect(countCall.sql).toContain("creator.rol_id = ANY($");
    expect(countCall.args).toContainEqual([1, 2, 5, 3]);
  });

  it("applies creatorUserId filter over project creator user", async () => {
    mockExecute
      .mockResolvedValueOnce(makeResult([{ count: 0 }]))
      .mockResolvedValueOnce(makeResult([]));

    await getTasksCommandCenterWithPagination({ creatorUserId: 7, page: 1, limit: 10 });

    const countCall = mockExecute.mock.calls[0][0] as { sql: string; args: unknown[] };
    expect(countCall.sql).toContain("p.created_by = $");
    expect(countCall.args).toContain(7);
  });

  it("builds OR filter when statuses include completed plus others", async () => {
    mockExecute
      .mockResolvedValueOnce(makeResult([{ count: 0 }]))
      .mockResolvedValueOnce(makeResult([]));

    await getTasksCommandCenterWithPagination({ page: 1, limit: 10, statuses: ["completed", "in_progress"] });

    const countCall = mockExecute.mock.calls[0][0] as { sql: string; args: unknown[] };
    expect(countCall.sql).toContain("pt.status = 'completed' OR pt.status = ANY($");
    expect(countCall.args).toContainEqual(["in_progress"]);
  });

  it("uses pagination placeholders and appends limit/offset args", async () => {
    mockExecute
      .mockResolvedValueOnce(makeResult([{ count: 0 }]))
      .mockResolvedValueOnce(makeResult([]));

    await getTasksCommandCenterWithPagination({ page: 3, limit: 10, statuses: ["not_started"] });

    const dataCall = mockExecute.mock.calls[1][0] as { sql: string; args: unknown[] };
    expect(dataCall.sql).toContain("LIMIT $");
    expect(dataCall.sql).toContain("OFFSET $");
    expect(dataCall.args.slice(-2)).toEqual([10, 20]);
  });
});

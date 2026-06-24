jest.mock("@/lib/db", () => ({
  db: {
    execute: jest.fn(),
  },
}));

jest.mock("next/cache", () => ({
  revalidatePath: jest.fn(),
}));

import { db } from "@/lib/db";
import {
  getMyTasksWithPagination,
  getTasksCommandCenterWithPagination,
} from "@/lib/queries/projectTasks";

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

describe("Task list queries expose deliverable fields", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("getMyTasksWithPagination selects delivery_url, delivery_notes and progress_minutes", async () => {
    // First execute() is the COUNT query, second is the data SELECT.
    mockExecute
      .mockResolvedValueOnce(makeResult([{ total: 0 }]) as never)
      .mockResolvedValueOnce(makeResult([]) as never);

    await getMyTasksWithPagination({ userId: 1 });

    const dataCallSql = (mockExecute.mock.calls[1][0] as { sql: string }).sql;
    expect(dataCallSql).toContain("pt.delivery_url");
    expect(dataCallSql).toContain("AS delivery_notes");
    expect(dataCallSql).toContain("tt.to_status = 'completed'");
    expect(dataCallSql).toContain("pt.progress_minutes");
  });

  it("getTasksCommandCenterWithPagination selects delivery_url, delivery_notes and progress_minutes", async () => {
    // First execute() is the COUNT query, second is the data SELECT.
    mockExecute
      .mockResolvedValueOnce(makeResult([{ total: 0 }]) as never)
      .mockResolvedValueOnce(makeResult([]) as never);

    await getTasksCommandCenterWithPagination({});

    const dataCallSql = (mockExecute.mock.calls[1][0] as { sql: string }).sql;
    expect(dataCallSql).toContain("pt.delivery_url");
    expect(dataCallSql).toContain("AS delivery_notes");
    expect(dataCallSql).toContain("tt.to_status = 'completed'");
    expect(dataCallSql).toContain("pt.progress_minutes");
  });
});

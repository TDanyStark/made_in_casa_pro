jest.mock("@/lib/db", () => ({
  db: {
    execute: jest.fn(),
  },
}));

jest.mock("next/cache", () => ({
  revalidatePath: jest.fn(),
}));

import { db } from "@/lib/db";
import { updateTaskProgress } from "@/lib/queries/projectTasks";

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

describe("updateTaskProgress()", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("accumulates additional minutes instead of replacing them", async () => {
    mockExecute
      .mockResolvedValueOnce(makeResult([{ id: 10, project_id: 7, progress_minutes: 30, progress_percent: 20 }]) as never)
      .mockResolvedValueOnce(makeResult([]) as never)
      .mockResolvedValueOnce(makeResult([{ id: 10, project_id: 7, progress_minutes: 75, progress_percent: 45 }]) as never);

    const result = await updateTaskProgress(10, {
      progress_percent: 45,
      additional_minutes: 45,
    });

    expect(mockExecute).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        sql: expect.stringContaining("progress_minutes = progress_minutes + $2"),
        args: [45, 45, 10],
      })
    );
    expect(result.progress_minutes).toBe(75);
    expect(result.progress_percent).toBe(45);
  });
});

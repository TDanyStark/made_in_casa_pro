jest.mock("@/lib/db", () => ({
  db: {
    execute: jest.fn(),
  },
}));

jest.mock("next/cache", () => ({
  revalidatePath: jest.fn(),
}));

import { db } from "@/lib/db";
import { getTasksByProject } from "@/lib/queries/projectTasks";

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

describe("getTasksByProject() deliverable fields", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("selects delivery notes from the latest completed transition", async () => {
    mockExecute.mockResolvedValueOnce(makeResult([]) as never);

    await getTasksByProject(9, null);

    expect(mockExecute).toHaveBeenCalledWith(
      expect.objectContaining({
        sql: expect.stringContaining("AS delivery_notes"),
      })
    );
    expect(mockExecute).toHaveBeenCalledWith(
      expect.objectContaining({
        sql: expect.stringContaining("tt.to_status = 'completed'"),
      })
    );
  });
});

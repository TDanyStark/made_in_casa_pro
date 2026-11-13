jest.mock("@/lib/db", () => ({
  db: {
    execute: jest.fn(),
  },
}));

import { db } from "@/lib/db";
import { getTaskWorkContext } from "@/lib/queries/projectTasks";

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

const baseRow = {
  task_id: 10,
  project_id: 3,
  project_drive_folder_url: "https://drive.google.com/project",
  version_drive_folder_url: null,
  project_notes: "<p>Tono cálido</p>",
  version_notes: null,
  version_number: 1,
};

const previousTask = {
  id: 7,
  title: "Copy del carrusel",
  task_type: "execution",
  status: "completed",
  version_number: 1,
  assigned_user_name: "Andrés Pérez",
  completed_at: "2026-11-07T10:00:00.000Z",
  delivery_url: "https://drive.google.com/copy",
  delivery_notes: "<p>Textos aprobados</p>",
};

describe("getTaskWorkContext", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns null and skips the history query when the task does not exist", async () => {
    mockExecute.mockResolvedValueOnce(makeResult([]));

    const result = await getTaskWorkContext(999);

    expect(result).toBeNull();
    expect(mockExecute).toHaveBeenCalledTimes(1);
  });

  it("uses the project Drive folder when the task has no version folder", async () => {
    mockExecute
      .mockResolvedValueOnce(makeResult([baseRow]))
      .mockResolvedValueOnce(makeResult([previousTask]));

    const result = await getTaskWorkContext(10);

    expect(result).toEqual({
      task_id: 10,
      project_id: 3,
      drive_folder_url: "https://drive.google.com/project",
      project_notes: "<p>Tono cálido</p>",
      version_notes: null,
      version_number: 1,
      previous_tasks: [previousTask],
    });
  });

  it("prefers the version Drive folder over the project folder", async () => {
    mockExecute
      .mockResolvedValueOnce(
        makeResult([
          {
            ...baseRow,
            version_drive_folder_url: "https://drive.google.com/v2",
            version_notes: "<p>Cambiar portada</p>",
            version_number: 2,
          },
        ])
      )
      .mockResolvedValueOnce(makeResult([]));

    const result = await getTaskWorkContext(10);

    expect(result?.drive_folder_url).toBe("https://drive.google.com/v2");
    expect(result?.version_notes).toBe("<p>Cambiar portada</p>");
    expect(result?.version_number).toBe(2);
    expect(result?.previous_tasks).toEqual([]);
  });

  it("lists only completed tasks of the same project, excluding the current one, newest first", async () => {
    mockExecute
      .mockResolvedValueOnce(makeResult([baseRow]))
      .mockResolvedValueOnce(makeResult([]));

    await getTaskWorkContext(10);

    const historyCall = mockExecute.mock.calls[1][0] as { sql: string; args: unknown[] };
    expect(historyCall.args).toEqual([3, 10]);
    expect(historyCall.sql).toContain("pt.project_id = $1");
    expect(historyCall.sql).toContain("pt.id <> $2");
    expect(historyCall.sql).toContain("pt.status = 'completed'");
    expect(historyCall.sql).toMatch(/ORDER BY pt\.completed_at DESC/);
  });
});

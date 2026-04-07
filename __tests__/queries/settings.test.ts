jest.mock("@/lib/db", () => ({
  db: {
    execute: jest.fn(),
  },
}));

import { db } from "@/lib/db";
import { getAppSettings, upsertSettings } from "@/lib/queries/settings";

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

describe("settings queries", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("defaults daily_report_time to 18:00 when unset", async () => {
    mockExecute.mockResolvedValueOnce(
      makeResult([
        { key: "google_oauth_client_id", value: "abc" },
      ]) as never
    );

    const result = await getAppSettings();

    expect(result.daily_report_time).toBe("18:00");
    expect(result.google_oauth_client_id).toBe("abc");
  });

  it("upserts daily_report_time together with the rest of settings", async () => {
    mockExecute.mockResolvedValue(makeResult([]) as never);

    await upsertSettings({ daily_report_time: "17:30" });

    expect(mockExecute).toHaveBeenCalledWith(
      expect.objectContaining({
        args: ["daily_report_time", "17:30"],
      })
    );
  });
});

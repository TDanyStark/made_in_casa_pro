import { db } from "../db";
import type { DbTransaction } from "../db/types";
import { parseWeeklyWorkHours } from "../work-time";

export interface AppSettings {
  google_oauth_client_id: string | null;
  google_oauth_client_secret: string | null;
  google_oauth_refresh_token: string | null;
  google_oauth_connected_email: string | null;
  daily_report_time: string;
}

const KEYS: (keyof AppSettings)[] = [
  "google_oauth_client_id",
  "google_oauth_client_secret",
  "google_oauth_refresh_token",
  "google_oauth_connected_email",
  "daily_report_time",
];

export async function getAppSettings(): Promise<AppSettings> {
  const placeholders = KEYS.map((_, i) => `$${i + 1}`).join(", ");
  const result = await db.execute({
    sql: `SELECT key, value FROM app_settings WHERE key IN (${placeholders})`,
    args: KEYS,
  });

  const map: Record<string, string | null> = {};
  for (const row of result.rows) {
    map[row.key as string] = (row.value as string | null) ?? null;
  }

  return {
    google_oauth_client_id: map["google_oauth_client_id"] ?? null,
    google_oauth_client_secret: map["google_oauth_client_secret"] ?? null,
    google_oauth_refresh_token: map["google_oauth_refresh_token"] ?? null,
    google_oauth_connected_email: map["google_oauth_connected_email"] ?? null,
    daily_report_time: map["daily_report_time"] ?? "18:00",
  };
}

/** Settings the admin can change; weekly_work_hours is the weekly legal work hours (S12). */
export type SettingsUpdate = Partial<AppSettings> & { weekly_work_hours?: number };

/** Subquery with the stored weekly legal work hours (text, NULL when unset). */
export const WEEKLY_WORK_HOURS_SQL = `(SELECT value FROM app_settings WHERE key = 'weekly_work_hours')`;

/** Weekly legal work hours; 42 when unset. Pass a transaction to read inside it. */
export async function getWeeklyWorkHours(executor: Pick<DbTransaction, "execute"> = db): Promise<number> {
  const result = await executor.execute({
    sql: `SELECT value FROM app_settings WHERE key = 'weekly_work_hours'`,
    args: [],
  });
  return parseWeeklyWorkHours(result.rows[0]?.value);
}

export async function upsertSetting(key: keyof SettingsUpdate, value: string | null): Promise<void> {
  await db.execute({
    sql: `
      INSERT INTO app_settings (key, value, updated_at)
      VALUES ($1, $2, NOW())
      ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
    `,
    args: [key, value],
  });
}

export async function upsertSettings(partial: SettingsUpdate): Promise<void> {
  for (const [key, value] of Object.entries(partial)) {
    await upsertSetting(key as keyof SettingsUpdate, value === null || value === undefined ? null : String(value));
  }
}

import { db } from "../db";

export interface AppSettings {
  google_oauth_client_id: string | null;
  google_oauth_client_secret: string | null;
  google_oauth_refresh_token: string | null;
  google_oauth_connected_email: string | null;
}

const KEYS: (keyof AppSettings)[] = [
  "google_oauth_client_id",
  "google_oauth_client_secret",
  "google_oauth_refresh_token",
  "google_oauth_connected_email",
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
  };
}

export async function upsertSetting(key: keyof AppSettings, value: string | null): Promise<void> {
  await db.execute({
    sql: `
      INSERT INTO app_settings (key, value, updated_at)
      VALUES ($1, $2, NOW())
      ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
    `,
    args: [key, value],
  });
}

export async function upsertSettings(partial: Partial<AppSettings>): Promise<void> {
  for (const [key, value] of Object.entries(partial)) {
    await upsertSetting(key as keyof AppSettings, value ?? null);
  }
}

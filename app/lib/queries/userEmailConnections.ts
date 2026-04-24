import { db } from "../db";

export type EmailConnectionStatus = "connected" | "invalid" | "disconnected";
export type EmailProvider = "gmail";

export type UserEmailConnectionType = {
  id: number;
  user_id: number;
  provider: EmailProvider;
  email: string;
  access_token: string | null;
  refresh_token: string | null;
  expires_at: string | null;
  scopes: string | null;
  status: EmailConnectionStatus;
  last_error: string | null;
  created_at: string;
  updated_at: string;
};

export async function getUserEmailConnection(
  userId: number,
  provider: EmailProvider = "gmail"
): Promise<UserEmailConnectionType | null> {
  try {
    const result = await db.execute({
      sql: `
        SELECT id, user_id, provider, email, access_token, refresh_token,
               expires_at, scopes, status, last_error, created_at, updated_at
        FROM user_email_connections
        WHERE user_id = $1 AND provider = $2
      `,
      args: [userId, provider],
    });
    if (result.rows.length === 0) return null;
    return result.rows[0] as unknown as UserEmailConnectionType;
  } catch (error) {
    console.error("Error fetching user email connection:", error);
    return null;
  }
}

export async function getUserConnectedEmailStatus(
  userId: number
): Promise<boolean> {
  try {
    const result = await db.execute({
      sql: `
        SELECT 1 FROM user_email_connections
        WHERE user_id = $1 AND provider = 'gmail' AND status = 'connected'
        LIMIT 1
      `,
      args: [userId],
    });
    return result.rows.length > 0;
  } catch (error) {
    console.error("Error checking user email status:", error);
    return false;
  }
}

export async function createUserEmailConnection(data: {
  user_id: number;
  email: string;
  access_token: string;
  refresh_token: string;
  expires_at: Date;
  scopes?: string;
}): Promise<UserEmailConnectionType> {
  try {
    const result = await db.execute({
      sql: `
        INSERT INTO user_email_connections (user_id, email, access_token, refresh_token, expires_at, scopes, provider, status)
        VALUES ($1, $2, $3, $4, $5, $6, 'gmail', 'connected')
        ON CONFLICT (user_id, provider) DO UPDATE SET
          email = EXCLUDED.email,
          access_token = EXCLUDED.access_token,
          refresh_token = EXCLUDED.refresh_token,
          expires_at = EXCLUDED.expires_at,
          scopes = EXCLUDED.scopes,
          status = 'connected',
          last_error = NULL,
          updated_at = CURRENT_TIMESTAMP
        RETURNING id, user_id, provider, email, access_token, refresh_token,
                  expires_at, scopes, status, last_error, created_at, updated_at
      `,
      args: [
        data.user_id,
        data.email,
        data.access_token,
        data.refresh_token,
        data.expires_at,
        data.scopes ?? null,
      ],
    });
    return result.rows[0] as unknown as UserEmailConnectionType;
  } catch (error) {
    console.error("Error creating user email connection:", error);
    throw error;
  }
}

export async function updateUserEmailConnectionTokens(
  userId: number,
  data: {
    access_token: string;
    refresh_token: string;
    expires_at: Date;
  }
): Promise<void> {
  try {
    await db.execute({
      sql: `
        UPDATE user_email_connections
        SET access_token = $2, refresh_token = $3, expires_at = $4, status = 'connected', updated_at = CURRENT_TIMESTAMP
        WHERE user_id = $1 AND provider = 'gmail'
      `,
      args: [userId, data.access_token, data.refresh_token, data.expires_at],
    });
  } catch (error) {
    console.error("Error updating email tokens:", error);
    throw error;
  }
}

export async function markEmailConnectionInvalid(
  userId: number,
  errorMessage: string
): Promise<void> {
  try {
    await db.execute({
      sql: `
        UPDATE user_email_connections
        SET status = 'invalid', last_error = $2, updated_at = CURRENT_TIMESTAMP
        WHERE user_id = $1 AND provider = 'gmail'
      `,
      args: [userId, errorMessage],
    });
  } catch (error) {
    console.error("Error marking connection invalid:", error);
    throw error;
  }
}

export async function disconnectUserEmailConnection(
  userId: number
): Promise<void> {
  try {
    await db.execute({
      sql: `
        UPDATE user_email_connections
        SET status = 'disconnected', access_token = NULL, refresh_token = NULL,
            expires_at = NULL, updated_at = CURRENT_TIMESTAMP
        WHERE user_id = $1 AND provider = 'gmail'
      `,
      args: [userId],
    });
  } catch (error) {
    console.error("Error disconnecting email:", error);
    throw error;
  }
}

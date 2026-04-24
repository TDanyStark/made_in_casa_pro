import { google } from "googleapis";
import { getAppSettings } from "@/lib/queries/settings";
import { getUserEmailConnection } from "@/lib/queries/userEmailConnections";

export const USER_GMAIL_SCOPES = [
  "openid",
  "email",
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/gmail.send",
];

export function getUserGmailRedirectUri(appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000") {
  return `${appUrl}/api/user-email/google/callback`;
}

export async function createUserGmailOAuthClient(appUrl?: string) {
  const settings = await getAppSettings();

  if (!settings.google_oauth_client_id || !settings.google_oauth_client_secret) {
    throw new Error("Google OAuth no está configurado. Pide a un administrador configurar Client ID y Client Secret.");
  }

  return new google.auth.OAuth2(
    settings.google_oauth_client_id,
    settings.google_oauth_client_secret,
    getUserGmailRedirectUri(appUrl)
  );
}

export async function generateUserGmailAuthUrl(appUrl?: string) {
  const oauth2Client = await createUserGmailOAuthClient(appUrl);

  return oauth2Client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: USER_GMAIL_SCOPES,
  });
}

export async function getGoogleAccountEmail(
  oauth2Client: Awaited<ReturnType<typeof createUserGmailOAuthClient>>,
  idToken?: string | null
) {
  if (idToken) {
    try {
      const payload = JSON.parse(
        Buffer.from(idToken.split(".")[1], "base64url").toString("utf8")
      );
      if (typeof payload.email === "string" && payload.email) {
        return payload.email;
      }
    } catch {
      // Fall back to the userinfo endpoint when the id token is not parseable.
    }
  }

  const oauth2 = google.oauth2({ version: "v2", auth: oauth2Client });
  const profile = await oauth2.userinfo.get();
  return profile.data.email ?? null;
}

export async function userHasUsableGmailConnection(userId: number) {
  const connection = await getUserEmailConnection(userId);
  return connection?.status === "connected" && !!connection.refresh_token;
}

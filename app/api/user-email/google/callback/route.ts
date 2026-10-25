import { NextRequest, NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/services/api-session";
import {
  createUserGmailOAuthClient,
  getGoogleAccountEmail,
  GMAIL_OAUTH_CALLBACK_PATH,
  GMAIL_OAUTH_STATE_COOKIE,
  USER_GMAIL_SCOPES,
} from "@/lib/services/userGmailOAuth";
import { createUserEmailConnection, getUserEmailConnection } from "@/lib/queries/userEmailConnections";
import { clearOAuthStateCookie, isValidOAuthState } from "@/lib/session";

/**
 * GET /api/user-email/google/callback
 * Only accepts the Google response when its `state` matches the cookie set by
 * /api/user-email/google (login CSRF). Errors go back as fixed codes in
 * `email_error`, never as internal messages.
 */
export async function GET(request: NextRequest) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  // The state cookie is single-use: every response clears it.
  const redirectTo = (pathAndQuery: string) =>
    clearOAuthStateCookie(
      NextResponse.redirect(`${appUrl}${pathAndQuery}`),
      GMAIL_OAUTH_STATE_COOKIE,
      GMAIL_OAUTH_CALLBACK_PATH
    );

  if (!isValidOAuthState(request, GMAIL_OAUTH_STATE_COOKIE)) {
    return redirectTo("/connect-email?email_error=invalid_state");
  }

  const { searchParams } = request.nextUrl;
  const code = searchParams.get("code");
  const error = searchParams.get("error");

  if (error) {
    const errorCode = error === "access_denied" ? "access_denied" : "oauth_error";
    return redirectTo(`/connect-email?email_error=${errorCode}`);
  }

  if (!code) {
    return redirectTo("/connect-email?email_error=no_code");
  }

  const session = await getCurrentSession();
  if (!session?.id) {
    return redirectTo("/?email_error=unauthorized");
  }

  try {
    const oauth2Client = await createUserGmailOAuthClient(appUrl);
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    const existingConnection = await getUserEmailConnection(session.id);
    const refreshToken = tokens.refresh_token ?? existingConnection?.refresh_token ?? null;

    if (!refreshToken) {
      return redirectTo("/connect-email?email_error=no_refresh_token");
    }

    const connectedEmail = await getGoogleAccountEmail(oauth2Client, tokens.id_token);
    if (!connectedEmail) {
      return redirectTo("/connect-email?email_error=no_email");
    }

    await createUserEmailConnection({
      user_id: session.id,
      email: connectedEmail,
      access_token: tokens.access_token ?? null,
      refresh_token: refreshToken,
      expires_at: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
      scopes: tokens.scope ?? USER_GMAIL_SCOPES.join(" "),
    });

    return redirectTo("/connect-email?email_success=1");
  } catch (err) {
    console.error("Error in user Gmail OAuth callback:", err);
    return redirectTo("/connect-email?email_error=oauth_failed");
  }
}

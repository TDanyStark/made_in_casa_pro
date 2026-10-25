import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { getAppSettings, upsertSettings } from "@/lib/queries/settings";
import { validateApiRole } from "@/lib/services/api-auth";
import { ADMIN_ONLY_ROLES } from "@/lib/role-groups";
import { clearOAuthStateCookie, isValidOAuthState } from "@/lib/session";
import { DRIVE_OAUTH_CALLBACK_PATH, DRIVE_OAUTH_STATE_COOKIE } from "../oauth-state";

/**
 * GET /api/settings/google/callback
 * Google redirects here after the user authorizes the app.
 * Exchanges the code for tokens and saves the refresh_token to the DB.
 * Only an admin with the matching OAuth `state` cookie can replace the Drive account.
 * Errors go back as fixed codes in `google_error`, never as internal messages.
 */
export async function GET(request: NextRequest) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  // The state cookie is single-use: every response clears it.
  const redirectTo = (query: string) =>
    clearOAuthStateCookie(
      NextResponse.redirect(`${appUrl}/settings?${query}`),
      DRIVE_OAUTH_STATE_COOKIE,
      DRIVE_OAUTH_CALLBACK_PATH
    );

  const roleValidation = await validateApiRole(request, ADMIN_ONLY_ROLES);
  if (!roleValidation.isAuthorized) {
    return redirectTo("google_error=forbidden");
  }

  if (!isValidOAuthState(request, DRIVE_OAUTH_STATE_COOKIE)) {
    return redirectTo("google_error=invalid_state");
  }

  const { searchParams } = request.nextUrl;
  const code = searchParams.get("code");
  const error = searchParams.get("error");

  if (error) {
    return redirectTo(`google_error=${error === "access_denied" ? "access_denied" : "oauth_error"}`);
  }

  if (!code) {
    return redirectTo("google_error=no_code");
  }

  try {
    const settings = await getAppSettings();

    if (!settings.google_oauth_client_id || !settings.google_oauth_client_secret) {
      return redirectTo("google_error=missing_credentials");
    }

    const redirectUri = `${appUrl}${DRIVE_OAUTH_CALLBACK_PATH}`;

    const oauth2Client = new google.auth.OAuth2(
      settings.google_oauth_client_id,
      settings.google_oauth_client_secret,
      redirectUri
    );

    const { tokens } = await oauth2Client.getToken(code);

    if (!tokens.refresh_token) {
      // This can happen if the user already authorized before and Google doesn't
      // return a new refresh_token. The "prompt: consent" in the auth URL should
      // prevent this, but handle it gracefully.
      return redirectTo("google_error=no_refresh_token");
    }

    // Extract email from the id_token payload (no extra API call needed)
    let connectedEmail: string | null = null;
    if (tokens.id_token) {
      try {
        const payload = JSON.parse(
          Buffer.from(tokens.id_token.split(".")[1], "base64url").toString("utf8")
        );
        connectedEmail = payload.email ?? null;
      } catch {
        // Non-critical — email display is cosmetic
      }
    }

    await upsertSettings({
      google_oauth_refresh_token: tokens.refresh_token,
      google_oauth_connected_email: connectedEmail,
    });

    return redirectTo("google_success=1");
  } catch (err) {
    console.error("Error in Google OAuth callback:", err);
    return redirectTo("google_error=oauth_failed");
  }
}

import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { getAppSettings, upsertSettings } from "@/lib/queries/settings";

/**
 * GET /api/settings/google/callback
 * Google redirects here after the user authorizes the app.
 * Exchanges the code for tokens and saves the refresh_token to the DB.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const error = searchParams.get("error");

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  if (error) {
    return NextResponse.redirect(`${appUrl}/settings?google_error=${encodeURIComponent(error)}`);
  }

  if (!code) {
    return NextResponse.redirect(`${appUrl}/settings?google_error=no_code`);
  }

  try {
    const settings = await getAppSettings();

    if (!settings.google_oauth_client_id || !settings.google_oauth_client_secret) {
      return NextResponse.redirect(`${appUrl}/settings?google_error=missing_credentials`);
    }

    const redirectUri = `${appUrl}/api/settings/google/callback`;

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
      return NextResponse.redirect(
        `${appUrl}/settings?google_error=no_refresh_token`
      );
    }

    // Get the email of the authorized account
    oauth2Client.setCredentials(tokens);
    const oauth2 = google.oauth2({ version: "v2", auth: oauth2Client });
    const { data: userInfo } = await oauth2.userinfo.get();

    await upsertSettings({
      google_oauth_refresh_token: tokens.refresh_token,
      google_oauth_connected_email: userInfo.email ?? null,
    });

    return NextResponse.redirect(`${appUrl}/settings?google_success=1`);
  } catch (err) {
    console.error("Error in Google OAuth callback:", err);
    const msg = err instanceof Error ? err.message : "unknown_error";
    return NextResponse.redirect(
      `${appUrl}/settings?google_error=${encodeURIComponent(msg)}`
    );
  }
}

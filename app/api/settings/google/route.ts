import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { validateApiRole, validateHttpMethod } from "@/lib/services/api-auth";
import { getAppSettings } from "@/lib/queries/settings";
import { ADMIN_ONLY_ROLES } from "@/lib/role-groups";

/**
 * GET /api/settings/google
 * Generates the Google OAuth2 authorization URL and redirects to it.
 * The admin clicks "Conectar con Google" → lands here → redirected to Google.
 */
export async function GET(request: NextRequest) {
  const methodValidation = validateHttpMethod(request, ["GET"]);
  if (!methodValidation.isValidMethod) return methodValidation.response;

  const roleValidation = await validateApiRole(request, ADMIN_ONLY_ROLES);
  if (!roleValidation.isAuthorized) return roleValidation.response;

  try {
    const settings = await getAppSettings();

    if (!settings.google_oauth_client_id || !settings.google_oauth_client_secret) {
      return NextResponse.json(
        { error: "Guarda el Client ID y Client Secret antes de conectar." },
        { status: 400 }
      );
    }

    const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/api/settings/google/callback`;

    const oauth2Client = new google.auth.OAuth2(
      settings.google_oauth_client_id,
      settings.google_oauth_client_secret,
      redirectUri
    );

    const authUrl = oauth2Client.generateAuthUrl({
      access_type: "offline",   // required to get a refresh_token
      prompt: "consent",        // force consent screen so refresh_token is always returned
      scope: [
        "https://www.googleapis.com/auth/drive",
        "https://www.googleapis.com/auth/userinfo.email",
      ],
    });

    return NextResponse.redirect(authUrl);
  } catch (error) {
    console.error("Error generating Google auth URL:", error);
    return NextResponse.json({ error: "Error al generar URL de autorización" }, { status: 500 });
  }
}

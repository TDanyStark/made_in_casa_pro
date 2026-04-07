import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { validateApiRole, validateHttpMethod } from "@/lib/services/api-auth";
import { UserRole } from "@/lib/definitions";
import { getAppSettings, upsertSettings } from "@/lib/queries/settings";

const patchSchema = z.object({
  google_oauth_client_id: z.string().min(1).optional(),
  google_oauth_client_secret: z.string().min(1).optional(),
  google_oauth_refresh_token: z.string().nullable().optional(),
  google_oauth_connected_email: z.string().nullable().optional(),
  daily_report_time: z
    .string()
    .regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Formato inválido. Usa HH:MM")
    .optional(),
});

export async function GET(request: NextRequest) {
  const methodValidation = validateHttpMethod(request, ["GET"]);
  if (!methodValidation.isValidMethod) return methodValidation.response;

  const roleValidation = await validateApiRole(request, [UserRole.ADMIN]);
  if (!roleValidation.isAuthorized) return roleValidation.response;

  try {
    const settings = await getAppSettings();
    // Never expose the refresh token or full secret to the client
    return NextResponse.json({
      google_oauth_client_id: settings.google_oauth_client_id,
      google_oauth_client_secret: settings.google_oauth_client_secret
        ? "***configured***"
        : null,
      google_oauth_connected_email: settings.google_oauth_connected_email,
      google_oauth_connected: !!settings.google_oauth_refresh_token,
      daily_report_time: settings.daily_report_time,
    });
  } catch (error) {
    console.error("Error fetching settings:", error);
    return NextResponse.json({ error: "Error al obtener configuración" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  const methodValidation = validateHttpMethod(request, ["PATCH"]);
  if (!methodValidation.isValidMethod) return methodValidation.response;

  const roleValidation = await validateApiRole(request, [UserRole.ADMIN]);
  if (!roleValidation.isAuthorized) return roleValidation.response;

  try {
    const body = await request.json();
    const validation = patchSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: "Datos inválidos", details: validation.error.format() },
        { status: 400 }
      );
    }

    await upsertSettings(validation.data);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Error updating settings:", error);
    return NextResponse.json({ error: "Error al guardar configuración" }, { status: 500 });
  }
}

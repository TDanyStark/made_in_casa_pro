import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { validateApiRole, validateHttpMethod } from "@/lib/services/api-auth";
import { UserRole } from "@/lib/definitions";

/**
 * GET /api/collaborators?area_id=X
 * Returns active users from a given area (id + name), accessible to non-ADMIN roles.
 * Used for task assignment selects across modules.
 */
export async function GET(request: NextRequest) {
  const methodValidation = validateHttpMethod(request, ["GET"]);
  if (!methodValidation.isValidMethod) return methodValidation.response;

  const roleValidation = await validateApiRole(request, [
    UserRole.ADMIN,
    UserRole.COMERCIAL,
    UserRole.DIRECTIVO,
  ]);
  if (!roleValidation.isAuthorized) return roleValidation.response;

  try {
    const url = new URL(request.url);
    const areaId = url.searchParams.get("area_id");

    let sql = `SELECT id, name FROM users WHERE is_active = 1`;
    const args: unknown[] = [];

    if (areaId) {
      args.push(Number(areaId));
      sql += ` AND area_id = $${args.length}`;
    }

    sql += ` ORDER BY name ASC`;

    const result = await db.execute({ sql, args });
    return NextResponse.json(result.rows);
  } catch (error) {
    console.error("Error fetching collaborators:", error);
    return NextResponse.json({ error: "Error al obtener colaboradores" }, { status: 500 });
  }
}

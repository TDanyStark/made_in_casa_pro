import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { validateApiRole, validateHttpMethod } from "@/lib/services/api-auth";
import { UserRole } from "@/lib/definitions";

/**
 * GET /api/collaborators
 * Query params:
 *   - area_id: filter by area (optional)
 *   - include_external: '1' | 'true' to include external collaborators (default: only internals when area given)
 *   - only_external: '1' | 'true' to return only external collaborators (for quote invitations)
 * 
 * Returns active users with task_count (active tasks) for load display.
 * 
 * Behavior:
 *   - No area_id → return all users (internals + externals if include_external=1)
 *   - area_id + default → return only internals of that area (is_internal=1)
 *   - area_id + include_external=1 → return everyone from that area
 *   - only_external=1 → return only externals (is_internal=0, rol_id=4)
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
    const includeExternal = url.searchParams.get("include_external") === "1" || url.searchParams.get("include_external") === "true";
    const onlyExternal = url.searchParams.get("only_external") === "1" || url.searchParams.get("only_external") === "true";

    const args: unknown[] = [];
    const conditions: string[] = ["u.is_active = 1", "u.rol_id = 4"];

    if (onlyExternal) {
      conditions.push("u.is_internal = 0");
    } else if (areaId && !includeExternal) {
      // Default behavior with area: internals only
      conditions.push("u.is_internal = 1");
    }

    if (areaId) {
      args.push(Number(areaId));
      conditions.push(`u.area_id = $${args.length}`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const sql = `
      SELECT
        u.id,
        u.name,
        u.is_internal,
        u.area_id,
        a.name AS area_name,
        (
          SELECT COUNT(*)
          FROM project_tasks pt
          WHERE pt.assigned_user_id = u.id
            AND pt.status NOT IN ('completed', 'waiting')
        ) AS active_task_count
      FROM users u
      LEFT JOIN areas a ON u.area_id = a.id
      ${whereClause}
      ORDER BY u.is_internal DESC, active_task_count ASC, u.name ASC
    `;

    const result = await db.execute({ sql, args });
    return NextResponse.json(result.rows);
  } catch (error) {
    console.error("Error fetching collaborators:", error);
    return NextResponse.json({ error: "Error al obtener colaboradores" }, { status: 500 });
  }
}

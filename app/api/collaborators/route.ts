import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { validateApiRole, validateHttpMethod } from "@/lib/services/api-auth";
import { OPERATIONS_ROLES } from "@/lib/role-groups";

/**
 * GET /api/collaborators
 * Query params:
 *   - area_id: filter by area (optional)
 *   - include_external: '1' to include external collaborators alongside internals
 *   - only_external: '1' to return only external collaborators (for quote invitations)
 *   - all_users: '1' to return ALL active users regardless of role (for free assignment)
 *
 * Behavior:
 *   - all_users=1 → all active users of any role, optionally filtered by area_id
 *   - only_external=1 → only externals (is_internal=0, rol_id=4), optionally by area_id
 *   - area_id + default → only internals of that area (is_internal=1, rol_id=4)
 *   - area_id + include_external=1 → everyone (rol_id=4) from that area
 *   - no area_id + no flags → all active collaborators (rol_id=4)
 */
export async function GET(request: NextRequest) {
  const methodValidation = validateHttpMethod(request, ["GET"]);
  if (!methodValidation.isValidMethod) return methodValidation.response;

  const roleValidation = await validateApiRole(request, OPERATIONS_ROLES);
  if (!roleValidation.isAuthorized) return roleValidation.response;

  try {
    const url = new URL(request.url);
    const areaId = url.searchParams.get("area_id");
    const includeExternal =
      url.searchParams.get("include_external") === "1" ||
      url.searchParams.get("include_external") === "true";
    const onlyExternal =
      url.searchParams.get("only_external") === "1" ||
      url.searchParams.get("only_external") === "true";
    const allUsers =
      url.searchParams.get("all_users") === "1" ||
      url.searchParams.get("all_users") === "true";

    const args: unknown[] = [];
    const conditions: string[] = ["u.is_active = 1"];

    if (allUsers) {
      // No rol_id filter — return every active user
    } else if (onlyExternal) {
      conditions.push("u.rol_id = 4", "u.is_internal = 0");
    } else if (areaId && !includeExternal) {
      conditions.push("u.rol_id = 4", "u.is_internal = 1");
    } else {
      conditions.push("u.rol_id = 4");
    }

    if (areaId) {
      args.push(Number(areaId));
      conditions.push(`u.area_id = $${args.length}`);
    }

    const whereClause = `WHERE ${conditions.join(" AND ")}`;

    const sql = `
      SELECT
        u.id,
        u.name,
        u.rol_id,
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
      ORDER BY
        CASE u.rol_id
          WHEN 1 THEN 1
          WHEN 2 THEN 2
          WHEN 3 THEN 3
          WHEN 4 THEN CASE WHEN u.is_internal = 1 THEN 4 ELSE 5 END
          ELSE 6
        END ASC,
        active_task_count ASC,
        u.name ASC
    `;

    const result = await db.execute({ sql, args });
    return NextResponse.json(result.rows);
  } catch (error) {
    console.error("Error fetching collaborators:", error);
    return NextResponse.json({ error: "Error al obtener colaboradores" }, { status: 500 });
  }
}

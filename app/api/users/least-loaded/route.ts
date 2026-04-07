import { NextRequest, NextResponse } from "next/server";
import { validateApiRole, validateHttpMethod } from "@/lib/services/api-auth";
import { findLeastLoadedInternalCollaborator, resolveProjectTaskAssignment } from "@/lib/queries/projectTasks";
import { db } from "@/lib/db";
import { OPERATIONS_ROLES } from "@/lib/role-groups";

export async function GET(request: NextRequest) {
  const methodValidation = validateHttpMethod(request, ["GET"]);
  if (!methodValidation.isValidMethod) return methodValidation.response;

  const roleValidation = await validateApiRole(request, OPERATIONS_ROLES);
  if (!roleValidation.isAuthorized) return roleValidation.response;

  try {
    const { searchParams } = new URL(request.url);
    const areaId = searchParams.get("area_id") ? parseInt(searchParams.get("area_id")!) : null;
    const projectId = searchParams.get("project_id") ? parseInt(searchParams.get("project_id")!) : null;
    const mode = searchParams.get("mode") as "auto" | "commercial" | null;

    let userId: number | null = null;

    if (mode === "commercial" && projectId) {
      userId = await resolveProjectTaskAssignment(projectId, { assign_to_commercial: 1 });
    } else {
      // Default to auto-assign least loaded in area
      userId = await findLeastLoadedInternalCollaborator(areaId);
    }

    if (!userId) {
      return NextResponse.json({ data: null });
    }

    const userResult = await db.execute({
      sql: `SELECT id, name FROM users WHERE id = $1`,
      args: [userId],
    });

    if (userResult.rows.length === 0) {
      return NextResponse.json({ data: null });
    }

    return NextResponse.json({ data: userResult.rows[0] });
  } catch (error) {
    console.error("Error fetching least loaded user:", error);
    return NextResponse.json({ error: "Error al obtener usuario" }, { status: 500 });
  }
}

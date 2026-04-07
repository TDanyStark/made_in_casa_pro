import { NextRequest, NextResponse } from "next/server";
import { validateApiRole, validateHttpMethod } from "@/lib/services/api-auth";
import { AUTHENTICATED_ROLES } from "@/lib/role-groups";
import { getTaskTransitions } from "@/lib/queries/projectTasks";

type Params = { params: Promise<{ id: string; tid: string }> };

/**
 * GET /api/projects/[id]/tasks/[tid]/history
 * Returns the transition history (audit log) for a specific task.
 */
export async function GET(request: NextRequest, { params }: Params) {
  const methodValidation = validateHttpMethod(request, ["GET"]);
  if (!methodValidation.isValidMethod) return methodValidation.response;

  const roleValidation = await validateApiRole(request, AUTHENTICATED_ROLES);
  if (!roleValidation.isAuthorized) return roleValidation.response;

  try {
    const { tid } = await params;
    const transitions = await getTaskTransitions(parseInt(tid));
    return NextResponse.json(transitions);
  } catch (error) {
    console.error("Error fetching task history:", error);
    return NextResponse.json({ error: "Error al obtener historial" }, { status: 500 });
  }
}

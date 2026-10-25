import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { validateApiRole, validateHttpMethod } from "@/lib/services/api-auth";
import { PROJECT_EDIT_ROLES } from "@/lib/role-groups";
import { decrypt } from "@/lib/session";
import { recalculateProgressAndNotify } from "@/lib/services/notificationEngine";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  const methodValidation = validateHttpMethod(request, ["POST"]);
  if (!methodValidation.isValidMethod) return methodValidation.response;

  const roleValidation = await validateApiRole(request, PROJECT_EDIT_ROLES);
  if (!roleValidation.isAuthorized) return roleValidation.response;

  try {
    const { id } = await params;
    const cookie = (await cookies()).get("session")?.value;
    const session = cookie ? await decrypt(cookie) : null;
    const currentUserId = session?.id ? Number(session.id) : null;

    // A manual recalculation can also be the one that reaches 100%: don't lose project.ready_to_close.
    const progress = await recalculateProgressAndNotify(parseInt(id), currentUserId);
    return NextResponse.json({ progress });
  } catch (error) {
    console.error("Error recalculating progress:", error);
    return NextResponse.json({ error: "Error al recalcular progreso" }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { validateApiRole, validateHttpMethod } from "@/lib/services/api-auth";
import { OPERATIONS_ROLES } from "@/lib/role-groups";
import { reorderProjectTasks } from "@/lib/queries/projectTasks";
import { cookies } from "next/headers";
import { decrypt } from "@/lib/session";
import { dispatchReadyForActivatedTasks, parseNotifyParam } from "../taskReadyNotifications";

const schema = z.object({
  orderedIds: z.array(z.number().int().positive()).min(1),
  adjustment_id: z.number().int().positive().optional().nullable(),
});

type Params = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  const methodValidation = validateHttpMethod(request, ["POST"]);
  if (!methodValidation.isValidMethod) return methodValidation.response;

  const roleValidation = await validateApiRole(request, OPERATIONS_ROLES);
  if (!roleValidation.isAuthorized) return roleValidation.response;

  const notifyParam = parseNotifyParam(request);
  if (!notifyParam.ok) return notifyParam.response;

  try {
    const { id } = await params;
    const body = await request.json();
    const validation = schema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json({ error: "Datos inválidos", details: validation.error.format() }, { status: 400 });
    }
    const { orderedIds, adjustment_id } = validation.data;
    const projectId = parseInt(id);
    const activatedIds = await reorderProjectTasks(projectId, orderedIds, adjustment_id);

    const cookie = (await cookies()).get("session")?.value;
    const session = cookie ? await decrypt(cookie) : null;
    const currentUserId = session?.id ? Number(session.id) : null;
    if (currentUserId && notifyParam.notify) {
      await dispatchReadyForActivatedTasks(activatedIds, currentUserId, projectId);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error reordering tasks:", error);
    return NextResponse.json({ error: "Error al reordenar tareas" }, { status: 500 });
  }
}

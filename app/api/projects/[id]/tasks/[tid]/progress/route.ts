import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { validateApiRole, validateHttpMethod } from "@/lib/services/api-auth";
import { getProjectTaskById, updateTaskProgress } from "@/lib/queries/projectTasks";
import { decrypt } from "@/lib/session";
import { cookies } from "next/headers";
import { AUTHENTICATED_ROLES } from "@/lib/role-groups";

const bodySchema = z.object({
  progress_percent: z.number().min(0).max(100),
  additional_minutes: z.number().int().min(0),
});

type Params = { params: Promise<{ id: string; tid: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  const methodValidation = validateHttpMethod(request, ["POST"]);
  if (!methodValidation.isValidMethod) return methodValidation.response;

  const roleValidation = await validateApiRole(request, AUTHENTICATED_ROLES);
  if (!roleValidation.isAuthorized) return roleValidation.response;

  try {
    const { id, tid } = await params;
    const projectId = Number.parseInt(id, 10);
    const taskId = Number.parseInt(tid, 10);

    const cookie = (await cookies()).get("session")?.value;
    const session = cookie ? await decrypt(cookie) : null;
    if (!session?.id) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const validation = bodySchema.safeParse(await request.json());
    if (!validation.success) {
      return NextResponse.json(
        { error: "Datos inválidos", details: validation.error.format() },
        { status: 400 }
      );
    }

    const task = await getProjectTaskById(taskId);
    if (!task) {
      return NextResponse.json({ error: "Tarea no encontrada" }, { status: 404 });
    }

    if (task.project_id !== projectId) {
      return NextResponse.json({ error: "Tarea no pertenece al proyecto" }, { status: 400 });
    }

    if (task.assigned_user_id !== session.id) {
      return NextResponse.json(
        { error: "Solo el colaborador asignado puede reportar avance" },
        { status: 403 }
      );
    }

    if (task.status !== "in_progress") {
      return NextResponse.json(
        { error: "Solo se puede reportar avance para tareas en progreso" },
        { status: 400 }
      );
    }

    const updatedTask = await updateTaskProgress(taskId, validation.data);

    return NextResponse.json({
      ok: true,
      message: "Avance guardado correctamente",
      task: updatedTask,
    });
  } catch (error) {
    console.error("Error reporting task progress:", error);
    return NextResponse.json({ error: "Error al reportar avance" }, { status: 500 });
  }
}

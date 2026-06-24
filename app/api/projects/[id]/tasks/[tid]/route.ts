import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { validateApiRole, validateHttpMethod } from "@/lib/services/api-auth";
import {
  getProjectTaskById,
  updateProjectTask,
  deleteProjectTask,
  resolveProjectTaskAssignment,
} from "@/lib/queries/projectTasks";
import { recalculateProjectProgress } from "@/lib/queries/projects";
import { db } from "@/lib/db";
import { cookies } from "next/headers";
import { decrypt } from "@/lib/session";
import { AUTHENTICATED_ROLES, OPERATIONS_ROLES } from "@/lib/role-groups";
import { dispatchNotification, NOTIFICATION_EVENTS } from "@/lib/services/notificationEngine";

const patchSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  area_id: z.coerce.number().int().positive().nullable().optional(),
  assigned_user_id: z.coerce.number().int().positive().nullable().optional(),
  status: z.enum(["not_started", "waiting", "in_progress", "completed", "blocked"]).optional(),
  task_type: z.enum(["execution", "validation"]).optional(),
  task_flag: z.enum(["new", "correction", "adjustment"]).optional(),
  requires_quote: z.coerce.number().int().min(0).max(1).optional(),
  assign_to_commercial: z.coerce.number().int().min(0).max(1).optional(),
  quoter_ids: z.array(z.coerce.number().int().positive()).optional(),
});

type Params = { params: Promise<{ id: string; tid: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const methodValidation = validateHttpMethod(request, ["GET"]);
  if (!methodValidation.isValidMethod) return methodValidation.response;

  const roleValidation = await validateApiRole(request, AUTHENTICATED_ROLES);
  if (!roleValidation.isAuthorized) return roleValidation.response;

  const { tid } = await params;
  const task = await getProjectTaskById(parseInt(tid));
  if (!task) return NextResponse.json({ error: "Tarea no encontrada" }, { status: 404 });
  return NextResponse.json(task);
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const methodValidation = validateHttpMethod(request, ["PATCH"]);
  if (!methodValidation.isValidMethod) return methodValidation.response;

  const roleValidation = await validateApiRole(request, AUTHENTICATED_ROLES);
  if (!roleValidation.isAuthorized) return roleValidation.response;

  try {
    const { id, tid } = await params;
    const projectId = parseInt(id);
    const body = await request.json();
    const validation = patchSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
    }

    if (validation.data.status === "completed") {
      return NextResponse.json(
        { error: "No se puede marcar una tarea como completada desde la edición. Usa el botón 'Completar' para registrar la duración y los entregables." },
        { status: 422 }
      );
    }

    const taskId = parseInt(tid);
    const existingTask = await getProjectTaskById(taskId);
    if (!existingTask) return NextResponse.json({ error: "Tarea no encontrada" }, { status: 404 });

    const updateData = { ...validation.data };

    // Re-resolve assignment if mode or area changes
    const modeChanged = validation.data.assign_to_commercial !== undefined && validation.data.assign_to_commercial !== existingTask.assign_to_commercial;
    const areaChanged = validation.data.area_id !== undefined && validation.data.area_id !== existingTask.area_id;
    const userExplicitlySet = validation.data.assigned_user_id !== undefined;

    if (modeChanged || areaChanged || userExplicitlySet) {
      updateData.assigned_user_id = await resolveProjectTaskAssignment(projectId, {
        assigned_user_id: validation.data.assigned_user_id ?? (userExplicitlySet ? null : existingTask.assigned_user_id),
        area_id: validation.data.area_id !== undefined ? validation.data.area_id : existingTask.area_id,
        assign_to_commercial: validation.data.assign_to_commercial !== undefined ? validation.data.assign_to_commercial : existingTask.assign_to_commercial,
      });
    }

    // New blocked logic for updates
    const finalRequiresQuote = validation.data.requires_quote !== undefined ? validation.data.requires_quote : existingTask.requires_quote;
    const finalAssignedUser = updateData.assigned_user_id !== undefined ? updateData.assigned_user_id : existingTask.assigned_user_id;

    if (Number(finalRequiresQuote) === 1 && !finalAssignedUser && validation.data.status === undefined) {
      updateData.status = "blocked";
    }

    const updated = await updateProjectTask(taskId, updateData);
    if (!updated) return NextResponse.json({ error: "Tarea no encontrada" }, { status: 404 });

    const cookie = (await cookies()).get("session")?.value;
    const session = cookie ? await decrypt(cookie) : null;
    const currentUserId = session?.id ? Number(session.id) : null;

    // Handle quoter invitations sync
    if (validation.data.quoter_ids !== undefined) {
      const transaction = await db.transaction("write");
      try {
        await transaction.execute({
          sql: `DELETE FROM task_quote_invitations WHERE task_id = $1`,
          args: [taskId],
        });
        for (const quoterId of validation.data.quoter_ids) {
          await transaction.execute({
            sql: `INSERT INTO task_quote_invitations (task_id, user_id, invited_by) VALUES ($1, $2, $3)`,
            args: [taskId, quoterId, currentUserId],
          });
        }
        await transaction.commit();
      } catch (err) {
        await transaction.rollback();
        console.error("Error syncing quoter invitations:", err);
      }
    }

    // Recalculate progress when status changes
    if (validation.data.status !== undefined) {
      await recalculateProjectProgress(projectId);
    }

    if (currentUserId) {
      const assignmentChanged = updated.assigned_user_id !== existingTask.assigned_user_id;
      if (assignmentChanged && existingTask.assigned_user_id) {
        await dispatchNotification({
          eventType: NOTIFICATION_EVENTS.TASK_REASSIGNED,
          actorUserId: currentUserId,
          projectId,
          taskId,
          previousUserId: existingTask.assigned_user_id,
          newUserId: updated.assigned_user_id ?? null,
        });
      } else if (assignmentChanged && updated.assigned_user_id) {
        await dispatchNotification({
          eventType: NOTIFICATION_EVENTS.TASK_ASSIGNED,
          actorUserId: currentUserId,
          projectId,
          taskId,
        });
      }

      if (validation.data.quoter_ids !== undefined) {
        for (const quoterId of validation.data.quoter_ids) {
          await dispatchNotification({
            eventType: NOTIFICATION_EVENTS.QUOTE_REQUESTED,
            actorUserId: currentUserId,
            projectId,
            taskId,
            inviteeUserId: quoterId,
          });
        }
      }
    }

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Error updating task:", error);
    return NextResponse.json({ error: "Error al actualizar tarea" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const methodValidation = validateHttpMethod(request, ["DELETE"]);
  if (!methodValidation.isValidMethod) return methodValidation.response;

  const roleValidation = await validateApiRole(request, OPERATIONS_ROLES);
  if (!roleValidation.isAuthorized) return roleValidation.response;

  try {
    const { id, tid } = await params;
    const projectId = parseInt(id);
    await deleteProjectTask(parseInt(tid));
    await recalculateProjectProgress(projectId);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting task:", error);
    return NextResponse.json({ error: "Error al eliminar tarea" }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { validateApiRole, validateHttpMethod } from "@/lib/services/api-auth";
import {
  getProjectTaskById,
  updateProjectTask,
  deleteProjectTask,
  resolveProjectTaskAssignment,
} from "@/lib/queries/projectTasks";
import { userCanAccessProject } from "@/lib/queries/projects";
import { cookies } from "next/headers";
import { decrypt } from "@/lib/session";
import { AUTHENTICATED_ROLES, hasAnyRole, OPERATIONS_ROLES } from "@/lib/role-groups";
import {
  dispatchNotification,
  NOTIFICATION_EVENTS,
  recalculateProgressAndNotify,
} from "@/lib/services/notificationEngine";
import { syncProjectDriveAccess } from "@/lib/services/projectDriveAccess";
import { dispatchReadyForActivatedTasks, parseNotifyParam } from "../taskReadyNotifications";

const patchSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  area_id: z.coerce.number().int().positive().nullable().optional(),
  assigned_user_id: z.coerce.number().int().positive().nullable().optional(),
  status: z.enum(["not_started", "waiting", "in_progress", "paused", "completed", "blocked"]).optional(),
  task_type: z.enum(["execution", "validation"]).optional(),
  task_flag: z.enum(["new", "correction", "adjustment"]).optional(),
  requires_quote: z.coerce.number().int().min(0).max(1).optional(),
  assign_to_commercial: z.coerce.number().int().min(0).max(1).optional(),
  quoter_ids: z.array(z.coerce.number().int().positive()).optional(),
});

type Params = { params: Promise<{ id: string; tid: string }> };

const TASK_NOT_FOUND = { error: "Tarea no encontrada" };

async function getSessionUserId(): Promise<number | null> {
  const cookie = (await cookies()).get("session")?.value;
  const session = cookie ? await decrypt(cookie) : null;
  return session?.id ? Number(session.id) : null;
}

/** A task is only reachable through the URL of its own project. */
async function getTaskOfProject(projectId: number, taskId: number) {
  const task = await getProjectTaskById(taskId);
  return task && task.project_id === projectId ? task : null;
}

export async function GET(request: NextRequest, { params }: Params) {
  const methodValidation = validateHttpMethod(request, ["GET"]);
  if (!methodValidation.isValidMethod) return methodValidation.response;

  const roleValidation = await validateApiRole(request, AUTHENTICATED_ROLES);
  if (!roleValidation.isAuthorized) return roleValidation.response;

  const { id, tid } = await params;
  const projectId = parseInt(id);
  const task = await getTaskOfProject(projectId, parseInt(tid));
  if (!task) return NextResponse.json(TASK_NOT_FOUND, { status: 404 });

  // Roles fuera de operaciones (colaborador) solo ven tareas de proyectos donde tienen acceso.
  if (!hasAnyRole(roleValidation.userRole, OPERATIONS_ROLES)) {
    const userId = await getSessionUserId();
    const allowed = userId
      ? await userCanAccessProject(projectId, userId, roleValidation.userRole)
      : false;
    if (!allowed) {
      return NextResponse.json({ error: "No tienes acceso a este proyecto" }, { status: 403 });
    }
  }
  return NextResponse.json(task);
}

/**
 * Editing a task (title, assignee, status, quoters...) is an operations task.
 * Collaborators use the start/pause/resume/progress/complete endpoints instead.
 */
export async function PATCH(request: NextRequest, { params }: Params) {
  const methodValidation = validateHttpMethod(request, ["PATCH"]);
  if (!methodValidation.isValidMethod) return methodValidation.response;

  const roleValidation = await validateApiRole(request, OPERATIONS_ROLES);
  if (!roleValidation.isAuthorized) return roleValidation.response;

  const notifyParam = parseNotifyParam(request);
  if (!notifyParam.ok) return notifyParam.response;

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
    const existingTask = await getTaskOfProject(projectId, taskId);
    if (!existingTask) return NextResponse.json(TASK_NOT_FOUND, { status: 404 });

    const currentUserId = await getSessionUserId();

    // Pausing/resuming through PATCH is limited to operations roles (the role
    // check above), which are the leadership roles allowed to pause/resume.
    if (
      validation.data.status === "paused" &&
      existingTask.status !== "paused" &&
      existingTask.status !== "in_progress"
    ) {
      return NextResponse.json({ error: "Solo se pueden pausar tareas en progreso" }, { status: 400 });
    }

    // Quoter invitations are written by updateProjectTask in the same
    // transaction as the task: a failure saves neither and sends no quote.requested.
    const { quoter_ids: quoterIds, ...updateData } = validation.data;

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

    const updated = quoterIds === undefined
      ? await updateProjectTask(taskId, updateData, currentUserId)
      : await updateProjectTask(taskId, updateData, currentUserId, { quoterIds });
    if (!updated) return NextResponse.json({ error: "Tarea no encontrada" }, { status: 404 });
    const assignmentChanged = updated.assigned_user_id !== existingTask.assigned_user_id;
    const driveWarning = assignmentChanged && updated.assigned_user_id
      ? await syncProjectDriveAccess(projectId)
      : null;

    // Recalculate progress when status changes (project.ready_to_close is silenced with notify=false)
    if (validation.data.status !== undefined) {
      await recalculateProgressAndNotify(projectId, currentUserId, { notify: notifyParam.notify });
    }

    // notify=false (project wizard) silences the task emails; quote requests are still sent.
    if (currentUserId && notifyParam.notify) {
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

      // Became active (from waiting/blocked/etc.) with an assignee: it's their turn.
      if (
        existingTask.status !== "not_started" &&
        updated.status === "not_started" &&
        updated.assigned_user_id
      ) {
        await dispatchNotification({
          eventType: NOTIFICATION_EVENTS.TASK_READY,
          actorUserId: currentUserId,
          projectId,
          taskId,
        });
      }
    }

    if (currentUserId && quoterIds !== undefined) {
      for (const quoterId of quoterIds) {
        await dispatchNotification({
          eventType: NOTIFICATION_EVENTS.QUOTE_REQUESTED,
          actorUserId: currentUserId,
          projectId,
          taskId,
          inviteeUserId: quoterId,
        });
      }
    }

    return NextResponse.json({ ...updated, ...(driveWarning ? { driveWarning } : {}) });
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

  const notifyParam = parseNotifyParam(request);
  if (!notifyParam.ok) return notifyParam.response;

  try {
    const { id, tid } = await params;
    const projectId = parseInt(id);
    const taskId = parseInt(tid);
    if (!(await getTaskOfProject(projectId, taskId))) {
      return NextResponse.json(TASK_NOT_FOUND, { status: 404 });
    }
    const activatedIds = await deleteProjectTask(taskId);

    const currentUserId = await getSessionUserId();

    // Deleting the last pending task can take the project to 100% (project.ready_to_close).
    await recalculateProgressAndNotify(projectId, currentUserId, { notify: notifyParam.notify });
    if (currentUserId && notifyParam.notify) {
      await dispatchReadyForActivatedTasks(activatedIds, currentUserId, projectId);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting task:", error);
    return NextResponse.json({ error: "Error al eliminar tarea" }, { status: 500 });
  }
}

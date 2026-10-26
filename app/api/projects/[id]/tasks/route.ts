import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { validateApiRole, validateHttpMethod } from "@/lib/services/api-auth";
import { getTasksByProject, createProjectTask, resolveProjectTaskAssignment } from "@/lib/queries/projectTasks";
import { resolveTaskAdjustmentId, assertLatestTaskVersion } from "@/lib/queries/adjustments";
import { TaskVersionError } from "@/lib/definitions";
import { db } from "@/lib/db";
import { cookies } from "next/headers";
import { decrypt } from "@/lib/session";
import { AUTHENTICATED_ROLES, hasAnyRole, OPERATIONS_ROLES } from "@/lib/role-groups";
import { userCanAccessProject } from "@/lib/queries/projects";
import {
  dispatchNotification,
  NOTIFICATION_EVENTS,
  recalculateProgressAndNotify,
} from "@/lib/services/notificationEngine";
import { syncProjectDriveAccess } from "@/lib/services/projectDriveAccess";
import { parseNotifyParam } from "./taskReadyNotifications";

const taskSchema = z.object({
  title: z.string().min(1, "El título es requerido"),
  description: z.string().optional().nullable(),
  area_id: z.coerce.number().int().positive().optional().nullable(),
  assigned_user_id: z.coerce.number().int().positive().optional().nullable(),
  status: z.enum(["not_started", "waiting", "in_progress", "completed", "blocked"]).optional(),
  task_type: z.enum(["execution", "validation"]).optional().default("execution"),
  task_flag: z.enum(["new", "correction", "adjustment"]).optional().default("new"),
  requires_quote: z.coerce.number().int().min(0).max(1).optional().default(0),
  assign_to_commercial: z.coerce.number().int().min(0).max(1).optional().default(0),
  adjustment_id: z.coerce.number().int().positive().optional().nullable(),
  quoter_ids: z.array(z.coerce.number().int().positive()).optional().default([]),
});

type Params = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const methodValidation = validateHttpMethod(request, ["GET"]);
  if (!methodValidation.isValidMethod) return methodValidation.response;

  const roleValidation = await validateApiRole(request, AUTHENTICATED_ROLES);
  if (!roleValidation.isAuthorized) return roleValidation.response;

  const { id } = await params;
  const projectId = parseInt(id);

  // Roles fuera de operaciones (colaborador) solo ven proyectos donde tienen acceso.
  if (!hasAnyRole(roleValidation.userRole, OPERATIONS_ROLES)) {
    const cookie = (await cookies()).get("session")?.value;
    const session = cookie ? await decrypt(cookie) : null;
    const allowed = session?.id
      ? await userCanAccessProject(projectId, Number(session.id), roleValidation.userRole)
      : false;
    if (!allowed) {
      return NextResponse.json({ error: "No tienes acceso a este proyecto" }, { status: 403 });
    }
  }

  const searchParams = request.nextUrl.searchParams;
  let adjustmentId: number | null | undefined = undefined;
  
  if (searchParams.has("adjustment_id")) {
    const val = searchParams.get("adjustment_id");
    if (val === "null") {
      adjustmentId = null;
    } else {
      adjustmentId = parseInt(val!, 10);
    }
  }

  const tasks = await getTasksByProject(projectId, adjustmentId);
  return NextResponse.json(tasks);
}

export async function POST(request: NextRequest, { params }: Params) {
  const methodValidation = validateHttpMethod(request, ["POST"]);
  if (!methodValidation.isValidMethod) return methodValidation.response;

  const roleValidation = await validateApiRole(request, OPERATIONS_ROLES);
  if (!roleValidation.isAuthorized) return roleValidation.response;

  const notifyParam = parseNotifyParam(request);
  if (!notifyParam.ok) return notifyParam.response;

  try {
    const { id } = await params;
    const projectId = parseInt(id);
    const body = await request.json();
    const validation = taskSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: "Datos inválidos", details: validation.error.format() },
        { status: 400 }
      );
    }

    // 1. Resolve the task's version (latest version when not provided); a task never exists without one
    const adjustmentId = await resolveTaskAdjustmentId(projectId, validation.data.adjustment_id, db, "latest");

    await assertLatestTaskVersion(projectId, adjustmentId);

    // 2. Resolve assignment before creation
    const resolvedAssignedUserId = await resolveProjectTaskAssignment(projectId, {
      assigned_user_id: validation.data.assigned_user_id,
      area_id: validation.data.area_id,
      assign_to_commercial: validation.data.assign_to_commercial,
    });

    const cookie = (await cookies()).get("session")?.value;
    const session = cookie ? await decrypt(cookie) : null;
    const currentUserId = session?.id ? Number(session.id) : null;

    // 3. Order, initial status, insert and quoter invitations run in one
    // transaction (createProjectTask): a failed invitation creates nothing and
    // sends no email.
    const task = await createProjectTask({
      project_id: projectId,
      title: validation.data.title,
      description: validation.data.description ?? null,
      area_id: validation.data.area_id ?? null,
      assigned_user_id: resolvedAssignedUserId,
      status: validation.data.status,
      task_type: validation.data.task_type ?? "execution",
      task_flag: validation.data.task_flag ?? "new",
      requires_quote: validation.data.requires_quote ?? 0,
      assign_to_commercial: validation.data.assign_to_commercial ?? 0,
      adjustment_id: adjustmentId,
      quoter_ids: validation.data.quoter_ids,
      created_by: currentUserId,
    });
    const driveWarning = resolvedAssignedUserId
      ? await syncProjectDriveAccess(projectId)
      : null;

    // notify=false (project wizard) also silences project.ready_to_close.
    await recalculateProgressAndNotify(projectId, currentUserId, { notify: notifyParam.notify });

    if (currentUserId) {
      // notify=false (project wizard): task emails are sent once at the end by notify-created.
      if (notifyParam.notify && task.assigned_user_id) {
        await dispatchNotification({
          eventType: NOTIFICATION_EVENTS.TASK_ASSIGNED,
          actorUserId: currentUserId,
          projectId,
          taskId: task.id,
        });

        // Created already active: it's the assignee's turn, so a second email after "assigned".
        if (task.status === "not_started") {
          await dispatchNotification({
            eventType: NOTIFICATION_EVENTS.TASK_READY,
            actorUserId: currentUserId,
            projectId,
            taskId: task.id,
          });
        }
      }

      for (const quoterId of validation.data.quoter_ids) {
        await dispatchNotification({
          eventType: NOTIFICATION_EVENTS.QUOTE_REQUESTED,
          actorUserId: currentUserId,
          projectId,
          taskId: task.id,
          inviteeUserId: quoterId,
        });
      }
    }

    return NextResponse.json({ ...task, ...(driveWarning ? { driveWarning } : {}) }, { status: 201 });
  } catch (error) {
    if (error instanceof TaskVersionError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("Error creating project task:", error);
    return NextResponse.json({ error: "Error al crear tarea" }, { status: 500 });
  }
}

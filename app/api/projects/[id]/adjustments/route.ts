import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { validateApiRole, validateHttpMethod } from "@/lib/services/api-auth";
import { getProjectById, recalculateProjectProgress } from "@/lib/queries/projects";
import { createProjectAdjustment, getAdjustmentsByProject } from "@/lib/queries/adjustments";
import { findLeastLoadedInternalCollaborator } from "@/lib/queries/projectTasks";
import { createSubFolder } from "@/lib/services/googleDrive";
import { getAdminAndLeadershipEmails } from "@/lib/queries/users";
import { decrypt } from "@/lib/session";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { AUTHENTICATED_ROLES, OPERATIONS_ROLES } from "@/lib/role-groups";
import { dispatchNotification, NOTIFICATION_EVENTS } from "@/lib/services/notificationEngine";

// Task template row type
interface TaskTemplateRow {
  template_id: number;
  title: string;
  area_id: number | null;
  assigned_user_id: number | null;
  assign_to_commercial: number;
  task_type: "execution" | "validation";
  requires_quote: number;
  quoter_ids: number[];
}

// Each task in the final ordered list sent from the wizard
const taskSchema = z.object({
  template_id: z.number().int().positive().optional().nullable(),
  title: z.string().min(1),
  assigned_user_id: z.number().int().positive().optional().nullable(),
  assign_to_commercial: z.number().int().min(0).max(1).optional().default(0),
  area_id: z.number().int().positive().optional().nullable(),
  task_type: z.enum(["execution", "validation"]).optional().default("execution"),
  requires_quote: z.coerce.number().int().min(0).max(1).optional().default(0),
  quoter_ids: z.array(z.coerce.number().int().positive()).optional().default([]),
});

const bodySchema = z.object({
  notes: z.string().optional().nullable(),
  tasks: z.array(taskSchema).optional().default([]),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const methodValidation = validateHttpMethod(request, ["GET"]);
  if (!methodValidation.isValidMethod) return methodValidation.response;

  const roleValidation = await validateApiRole(request, AUTHENTICATED_ROLES);
  if (!roleValidation.isAuthorized) return roleValidation.response;

  try {
    const { id } = await params;
    const projectId = parseInt(id, 10);
    if (isNaN(projectId)) {
      return NextResponse.json({ error: "ID de proyecto inválido" }, { status: 400 });
    }
    const adjustments = await getAdjustmentsByProject(projectId);
    return NextResponse.json(adjustments);
  } catch (error) {
    console.error("Error al obtener ajustes:", error);
    return NextResponse.json({ error: "Error interno al obtener ajustes" }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const methodValidation = validateHttpMethod(request, ["POST"]);
  if (!methodValidation.isValidMethod) return methodValidation.response;

  const roleValidation = await validateApiRole(request, OPERATIONS_ROLES);
  if (!roleValidation.isAuthorized) return roleValidation.response;

  try {
    const { id } = await params;
    const projectId = parseInt(id, 10);
    if (isNaN(projectId)) {
      return NextResponse.json({ error: "ID de proyecto inválido" }, { status: 400 });
    }

    const project = await getProjectById(projectId);
    if (!project) {
      return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });
    }

    if (project.status !== "completed") {
      return NextResponse.json(
        { error: "No se puede crear un ajuste si el proyecto no está completado." },
        { status: 400 }
      );
    }

    const existingAdjustments = await getAdjustmentsByProject(projectId);
    const lastAdjustment = existingAdjustments[existingAdjustments.length - 1];
    if (lastAdjustment && lastAdjustment.status !== "completed") {
      return NextResponse.json(
        { error: "No se puede crear un ajuste si la versión anterior no está completada." },
        { status: 400 }
      );
    }

    const rawBody = await request.json().catch(() => ({}));
    const parsed = bodySchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json({ error: "Datos inválidos", details: parsed.error.format() }, { status: 400 });
    }
    const { notes, tasks } = parsed.data;

    const cookie = (await cookies()).get("session")?.value;
    const session = cookie ? await decrypt(cookie) : null;
    const currentUserId = session?.id ? Number(session.id) : null;

    const nextVersion = lastAdjustment ? lastAdjustment.version_number + 1 : 2;

    // Create Drive subfolder
    let adjustmentFolderId: string | null = null;
    let adjustmentFolderUrl: string | null = null;
    if (project.drive_folder_id) {
      try {
        const creatorEmail = session?.email ?? null;
        const adminEmails = await getAdminAndLeadershipEmails();
        const allEmails = [...adminEmails, ...(creatorEmail ? [creatorEmail] : [])];
        const driveRes = await createSubFolder({
          parentFolderId: project.drive_folder_id,
          folderName: `v${nextVersion}`,
          shareEmails: allEmails,
        });
        adjustmentFolderId = driveRes.folderId;
        adjustmentFolderUrl = driveRes.folderUrl;
      } catch (e) {
        console.error("No se pudo crear carpeta en Drive para el ajuste", e);
      }
    }

    const adjustment = await createProjectAdjustment({
      project_id: projectId,
      drive_folder_id: adjustmentFolderId,
      drive_folder_url: adjustmentFolderUrl,
      notes: notes ?? null,
    });

    // ── Build and insert tasks ────────────────────────────────────────────────
    // If wizard sent an explicit task list, use it. Otherwise fall back to templates.
    let taskList: TaskTemplateRow[] = tasks as TaskTemplateRow[];

    if (taskList.length === 0 && project.product_id) {
      // No wizard tasks sent — load from templates as-is
      const tplResult = await db.execute({
        sql: `SELECT id AS template_id, title, area_id, assigned_user_id, assign_to_commercial, task_type, requires_quote
              FROM product_task_templates WHERE product_id = $1 ORDER BY order_index ASC, id ASC`,
        args: [project.product_id],
      });
      
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const tplTasks = tplResult.rows as any[];
      for (const t of tplTasks) {
        if (Number(t.requires_quote) === 1) {
          const quotersResult = await db.execute({
            sql: `SELECT user_id FROM product_task_template_quoters WHERE template_id = $1`,
            args: [t.template_id],
          });
          t.quoter_ids = quotersResult.rows.map(r => (r as { user_id: number }).user_id);
        } else {
          t.quoter_ids = [];
        }
      }
      taskList = tplTasks;
    }

    const createdNotifications: Array<{
      taskId: number;
      assignedTo: number | null;
      quoterIds: number[];
    }> = [];

    if (taskList.length > 0) {
      const transaction = await db.transaction("write");
      try {
        for (let i = 0; i < taskList.length; i++) {
          const t = taskList[i];

          // Resolve final assigned_user_id
          let assignedTo: number | null = null;

          if (t.assigned_user_id) {
            assignedTo = t.assigned_user_id;
          } else if (Number(t.assign_to_commercial) === 1) {
            assignedTo = project.created_by ?? null;
          } else if (t.area_id) {
            const internalId = await findLeastLoadedInternalCollaborator(t.area_id);
            assignedTo = internalId;
          }

          const isFirst = i === 0;
          let status = isFirst ? "not_started" : "waiting";
          const requiresQuote = Number(t.requires_quote || 0);
          
          const isBlockedByQuote = status === "not_started" && requiresQuote === 1 && !assignedTo;
          if (isBlockedByQuote) {
            status = "blocked";
          }

          const assignedAt = (status === "not_started" || status === "blocked") && assignedTo ? new Date() : null;

          const insertResult = await transaction.execute({
            sql: `
              INSERT INTO project_tasks
                (project_id, template_id, title, area_id, assigned_user_id,
                 status, task_type, task_flag, requires_quote, assign_to_commercial,
                 order_index, assigned_at, adjustment_id)
              VALUES ($1, $2, $3, $4, $5, $6, $7, 'new', $8, $9, $10, $11, $12)
              RETURNING id
            `,
            args: [
              projectId,
              t.template_id ?? null,
              t.title,
              t.area_id ?? null,
              assignedTo,
              status,
              t.task_type ?? "execution",
              requiresQuote,
              t.assign_to_commercial ?? 0,
              i,             // order_index = position in the final list
              assignedAt,
              adjustment.id,
            ],
          });

          const taskId = Number(insertResult.rows[0]?.id);
          createdNotifications.push({
            taskId,
            assignedTo,
            quoterIds: t.quoter_ids ?? [],
          });

          // Insert invitations
          if (t.quoter_ids && t.quoter_ids.length > 0) {
            for (const quoterId of t.quoter_ids) {
              await transaction.execute({
                sql: `INSERT INTO task_quote_invitations (task_id, user_id, invited_by) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
                args: [taskId, quoterId, currentUserId],
              });
            }
          }

          // Log transition if blocked
          if (isBlockedByQuote && currentUserId) {
             await transaction.execute({
              sql: `INSERT INTO task_transitions (task_id, project_id, from_status, to_status, from_flag, to_flag, moved_by, notes)
                    VALUES ($1, $2, NULL, $3, NULL, 'new', $4, $5)`,
              args: [taskId, projectId, "blocked", currentUserId, "Requiere cotización de colaborador externo"],
            });
          }
        }
        await transaction.commit();
      } catch (err) {
        await transaction.rollback();
        throw err;
      }
    }

    await recalculateProjectProgress(projectId);

    if (currentUserId) {
      await dispatchNotification({
        eventType: NOTIFICATION_EVENTS.PROJECT_ADJUSTMENT_CREATED,
        actorUserId: currentUserId,
        projectId,
        adjustmentId: adjustment.id,
        versionNumber: adjustment.version_number,
        notes: adjustment.notes,
        taskCount: createdNotifications.length,
      });

      for (const created of createdNotifications) {
        if (created.assignedTo) {
          await dispatchNotification({
            eventType: NOTIFICATION_EVENTS.TASK_ASSIGNED,
            actorUserId: currentUserId,
            projectId,
            taskId: created.taskId,
          });
        }

        for (const quoterId of created.quoterIds) {
          await dispatchNotification({
            eventType: NOTIFICATION_EVENTS.QUOTE_REQUESTED,
            actorUserId: currentUserId,
            projectId,
            taskId: created.taskId,
            inviteeUserId: quoterId,
          });
        }
      }
    }

    return NextResponse.json(adjustment, { status: 201 });
  } catch (error) {
    console.error("Error al crear ajuste:", error);
    return NextResponse.json({ error: "Error interno al crear ajuste" }, { status: 500 });
  }
}

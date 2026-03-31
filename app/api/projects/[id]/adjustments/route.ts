import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { validateApiRole, validateHttpMethod } from "@/lib/services/api-auth";
import { UserRole } from "@/lib/definitions";
import { getProjectById, recalculateProjectProgress } from "@/lib/queries/projects";
import { createProjectAdjustment, getAdjustmentsByProject } from "@/lib/queries/adjustments";
import { findLeastLoadedInternalCollaborator } from "@/lib/queries/projectTasks";
import { createSubFolder } from "@/lib/services/googleDrive";
import { getAdminAndDirectivoEmails } from "@/lib/queries/users";
import { decrypt } from "@/lib/session";
import { cookies } from "next/headers";
import { db } from "@/lib/db";

// Each task in the final ordered list sent from the wizard
const taskSchema = z.object({
  template_id: z.number().int().positive().optional().nullable(),
  title: z.string().min(1),
  assigned_user_id: z.number().int().positive().optional().nullable(),
  assign_to_commercial: z.number().int().min(0).max(1).optional().default(0),
  area_id: z.number().int().positive().optional().nullable(),
  task_type: z.enum(["execution", "validation"]).optional().default("execution"),
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

  const roleValidation = await validateApiRole(request, [
    UserRole.ADMIN, UserRole.DIRECTIVO, UserRole.COMERCIAL, UserRole.COLABORADOR,
  ]);
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

  const roleValidation = await validateApiRole(request, [
    UserRole.ADMIN, UserRole.DIRECTIVO, UserRole.COMERCIAL,
  ]);
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

    const nextVersion = lastAdjustment ? lastAdjustment.version_number + 1 : 2;

    // Create Drive subfolder
    let adjustmentFolderId: string | null = null;
    let adjustmentFolderUrl: string | null = null;
    if (project.drive_folder_id) {
      try {
        const cookie = (await cookies()).get("session")?.value;
        const session = cookie ? await decrypt(cookie) : null;
        const creatorEmail = session?.email ?? null;
        const adminEmails = await getAdminAndDirectivoEmails();
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
    let taskList = tasks;

    if (taskList.length === 0 && project.product_id) {
      // No wizard tasks sent — load from templates as-is
      const tplResult = await db.execute({
        sql: `SELECT id AS template_id, title, area_id, assigned_user_id, assign_to_commercial, task_type
              FROM product_task_templates WHERE product_id = $1 ORDER BY order_index ASC, id ASC`,
        args: [project.product_id],
      });
      taskList = tplResult.rows as unknown as typeof taskList;
    }

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
          const status = isFirst ? "not_started" : "waiting";
          const assignedAt = isFirst && assignedTo ? new Date() : null;

          await transaction.execute({
            sql: `
              INSERT INTO project_tasks
                (project_id, template_id, title, area_id, assigned_user_id,
                 status, task_type, task_flag, requires_quote, assign_to_commercial,
                 order_index, assigned_at, adjustment_id)
              VALUES ($1, $2, $3, $4, $5, $6, $7, 'new', 0, $8, $9, $10, $11)
            `,
            args: [
              projectId,
              t.template_id ?? null,
              t.title,
              t.area_id ?? null,
              assignedTo,
              status,
              t.task_type ?? "execution",
              t.assign_to_commercial ?? 0,
              i,             // order_index = position in the final list
              assignedAt,
              adjustment.id,
            ],
          });
        }
        await transaction.commit();
      } catch (err) {
        await transaction.rollback();
        throw err;
      }
    }

    await recalculateProjectProgress(projectId);

    return NextResponse.json(adjustment, { status: 201 });
  } catch (error) {
    console.error("Error al crear ajuste:", error);
    return NextResponse.json({ error: "Error interno al crear ajuste" }, { status: 500 });
  }
}

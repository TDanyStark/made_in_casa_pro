import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { validateApiRole, validateHttpMethod } from "@/lib/services/api-auth";
import { UserRole } from "@/lib/definitions";
import { getProjectById } from "@/lib/queries/projects";
import { createProjectAdjustment, getAdjustmentsByProject } from "@/lib/queries/adjustments";
import {
  instantiateTasksFromTemplates,
  createProjectTask,
  resolveProjectTaskAssignment,
} from "@/lib/queries/projectTasks";
import { recalculateProjectProgress } from "@/lib/queries/projects";
import { createSubFolder } from "@/lib/services/googleDrive";
import { getAdminAndDirectivoEmails } from "@/lib/queries/users";
import { decrypt } from "@/lib/session";
import { cookies } from "next/headers";
import { db } from "@/lib/db";

const taskOverrideSchema = z.object({
  template_id: z.number().int().positive(),
  title: z.string().optional(),
  assigned_user_id: z.number().int().positive().optional().nullable(),
  assign_to_commercial: z.number().int().min(0).max(1).optional(),
  order_index: z.number().int().min(0),
});

const extraTaskSchema = z.object({
  title: z.string().min(1),
  assigned_user_id: z.number().int().positive().optional().nullable(),
  assign_to_commercial: z.number().int().min(0).max(1).optional(),
  area_id: z.number().int().positive().optional().nullable(),
  task_type: z.enum(["execution", "validation"]).optional().default("execution"),
  order_index: z.number().int().min(0),
});

const bodySchema = z.object({
  notes: z.string().optional().nullable(),
  task_overrides: z.array(taskOverrideSchema).optional().default([]),
  extra_tasks: z.array(extraTaskSchema).optional().default([]),
  removed_template_ids: z.array(z.number().int().positive()).optional().default([]),
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

    // Parse body
    const rawBody = await request.json().catch(() => ({}));
    const parsed = bodySchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json({ error: "Datos inválidos", details: parsed.error.format() }, { status: 400 });
    }
    const { notes, task_overrides, extra_tasks, removed_template_ids } = parsed.data;

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

    // Create adjustment record
    const adjustment = await createProjectAdjustment({
      project_id: projectId,
      drive_folder_id: adjustmentFolderId,
      drive_folder_url: adjustmentFolderUrl,
      notes: notes ?? null,
    });

    // If product has templates, instantiate them, applying overrides and removals
    if (project.product_id) {
      await instantiateTasksFromTemplates(
        projectId,
        project.product_id,
        project.created_by,
        adjustment.id
      );

      // Apply removals — delete tasks that came from removed templates
      if (removed_template_ids.length > 0) {
        for (const templateId of removed_template_ids) {
          await db.execute({
            sql: `DELETE FROM project_tasks WHERE project_id = $1 AND adjustment_id = $2 AND template_id = $3`,
            args: [projectId, adjustment.id, templateId],
          });
        }
      }

      // After removals, find the first remaining task of this adjustment (by order_index)
      // so we can keep its status as not_started
      const firstTaskResult = await db.execute({
        sql: `SELECT id, template_id, order_index FROM project_tasks WHERE project_id = $1 AND adjustment_id = $2 ORDER BY order_index ASC LIMIT 1`,
        args: [projectId, adjustment.id],
      });
      const firstTaskId = firstTaskResult.rows.length > 0
        ? Number((firstTaskResult.rows[0] as unknown as { id: number }).id)
        : null;

      // Apply overrides — update title / assignee for template tasks
      if (task_overrides.length > 0) {
        for (const override of task_overrides) {
          const updates: string[] = [];
          const args: unknown[] = [];

          if (override.title !== undefined) {
            args.push(override.title);
            updates.push(`title = $${args.length}`);
          }
          if (override.assigned_user_id !== undefined) {
            // If assign_to_commercial is being set to 1, resolve the actual user
            const resolvedUserId = (override.assign_to_commercial === 1 && !override.assigned_user_id)
              ? (project.created_by ?? null)
              : override.assigned_user_id;
            args.push(resolvedUserId);
            updates.push(`assigned_user_id = $${args.length}`);
          } else if (override.assign_to_commercial === 1 && project.created_by) {
            // assign_to_commercial=1 without explicit user_id — resolve to created_by
            args.push(project.created_by);
            updates.push(`assigned_user_id = $${args.length}`);
          }
          if (override.assign_to_commercial !== undefined) {
            args.push(override.assign_to_commercial);
            updates.push(`assign_to_commercial = $${args.length}`);
          }
          if (override.order_index !== undefined) {
            args.push(override.order_index);
            updates.push(`order_index = $${args.length}`);
          }

          if (updates.length > 0) {
            args.push(projectId, adjustment.id, override.template_id);
            await db.execute({
              sql: `UPDATE project_tasks SET ${updates.join(", ")} WHERE project_id = $${args.length - 2} AND adjustment_id = $${args.length - 1} AND template_id = $${args.length}`,
              args,
            });
          }
        }
      }

      // After all overrides, re-check the first task:
      // Its status must be not_started and assigned_at must reflect the final assigned user.
      // Re-query to get the actual first task after potential order overrides.
      const firstTaskFinalResult = await db.execute({
        sql: `SELECT id, assigned_user_id FROM project_tasks WHERE project_id = $1 AND adjustment_id = $2 ORDER BY order_index ASC LIMIT 1`,
        args: [projectId, adjustment.id],
      });
      if (firstTaskFinalResult.rows.length > 0) {
        const ft = firstTaskFinalResult.rows[0] as unknown as { id: number; assigned_user_id: number | null };
        // Only set assigned_at if someone is assigned
        await db.execute({
          sql: `UPDATE project_tasks SET status = 'not_started', assigned_at = CASE WHEN assigned_user_id IS NOT NULL THEN CURRENT_TIMESTAMP ELSE NULL END WHERE id = $1`,
          args: [ft.id],
        });
        // All other tasks must be 'waiting' (reset in case overrides changed order)
        await db.execute({
          sql: `UPDATE project_tasks SET status = 'waiting' WHERE project_id = $1 AND adjustment_id = $2 AND id != $3 AND status = 'not_started'`,
          args: [projectId, adjustment.id, ft.id],
        });
      }
      // Suppress unused variable warning
      void firstTaskId;
    }

    // Create extra (non-template) tasks
    if (extra_tasks.length > 0) {
      for (const extra of extra_tasks) {
        const resolvedUserId = await resolveProjectTaskAssignment(projectId, {
          assigned_user_id: extra.assigned_user_id,
          area_id: extra.area_id,
          assign_to_commercial: extra.assign_to_commercial,
        });
        await createProjectTask({
          project_id: projectId,
          title: extra.title,
          area_id: extra.area_id ?? null,
          assigned_user_id: resolvedUserId,
          task_type: extra.task_type ?? "execution",
          task_flag: "new",
          requires_quote: 0,
          assign_to_commercial: extra.assign_to_commercial ?? 0,
          order_index: extra.order_index,
          adjustment_id: adjustment.id,
        });
      }
    }

    await recalculateProjectProgress(projectId);

    return NextResponse.json(adjustment, { status: 201 });
  } catch (error) {
    console.error("Error al crear ajuste:", error);
    return NextResponse.json({ error: "Error interno al crear ajuste" }, { status: 500 });
  }
}

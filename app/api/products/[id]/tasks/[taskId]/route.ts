import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  getTaskTemplateById,
  updateTaskTemplate,
  deleteTaskTemplate,
  setTemplateQuoters,
  getTemplateQuoters,
} from "@/lib/queries/productTaskTemplates";
import { validateApiRole, validateHttpMethod } from "@/lib/services/api-auth";
import { OPERATIONS_ROLES } from "@/lib/role-groups";

const updateSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional().nullable(),
  area_id: z.coerce.number().int().positive().optional().nullable(),
  assigned_user_id: z.coerce.number().int().positive().optional().nullable(),
  task_type: z.enum(["execution", "validation"]).optional(),
  requires_quote: z.coerce.number().int().min(0).max(1).optional(),
  assign_to_commercial: z.coerce.number().int().min(0).max(1).optional(),
  quoter_ids: z.array(z.coerce.number().int().positive()).optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; taskId: string }> }
) {
  const methodValidation = validateHttpMethod(request, ["PATCH"]);
  if (!methodValidation.isValidMethod) return methodValidation.response;

  const roleValidation = await validateApiRole(request, OPERATIONS_ROLES);
  if (!roleValidation.isAuthorized) return roleValidation.response;

  try {
    const { taskId } = await params;
    const body = await request.json();

    const validation = updateSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: "Datos inválidos", details: validation.error.format() },
        { status: 400 }
      );
    }

    const existing = await getTaskTemplateById(Number(taskId));
    if (!existing) {
      return NextResponse.json({ error: "Tarea no encontrada" }, { status: 404 });
    }

    const { quoter_ids, ...templateData } = validation.data;
    const updated = await updateTaskTemplate(Number(taskId), templateData);

    // Sync quoters: always replace if quoter_ids was explicitly sent
    if (quoter_ids !== undefined) {
      const requiresQuote = templateData.requires_quote ?? existing.requires_quote;
      await setTemplateQuoters(Number(taskId), requiresQuote === 1 ? quoter_ids : []);
    }

    const quoters = await getTemplateQuoters(Number(taskId));
    return NextResponse.json({ ...updated, quoters });
  } catch (error) {
    console.error("Error updating task template:", error);
    return NextResponse.json({ error: "Error al actualizar la tarea" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; taskId: string }> }
) {
  const methodValidation = validateHttpMethod(request, ["DELETE"]);
  if (!methodValidation.isValidMethod) return methodValidation.response;

  const roleValidation = await validateApiRole(request, OPERATIONS_ROLES);
  if (!roleValidation.isAuthorized) return roleValidation.response;

  try {
    const { taskId } = await params;
    const existing = await getTaskTemplateById(Number(taskId));
    if (!existing) {
      return NextResponse.json({ error: "Tarea no encontrada" }, { status: 404 });
    }

    await deleteTaskTemplate(Number(taskId));
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting task template:", error);
    return NextResponse.json({ error: "Error al eliminar la tarea" }, { status: 500 });
  }
}

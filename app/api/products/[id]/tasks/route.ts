import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getProductById } from "@/lib/queries/products";
import {
  getTaskTemplatesByProductId,
  createTaskTemplate,
  setTemplateQuoters,
  getTemplateQuoters,
} from "@/lib/queries/productTaskTemplates";
import { validateApiRole, validateHttpMethod } from "@/lib/services/api-auth";
import { UserRole } from "@/lib/definitions";

const taskSchema = z.object({
  title: z.string().min(1, "El título es requerido"),
  description: z.string().optional().nullable(),
  area_id: z.coerce.number().int().positive().optional().nullable(),
  assigned_user_id: z.coerce.number().int().positive().optional().nullable(),
  task_type: z.enum(["execution", "validation"]).optional().default("execution"),
  requires_quote: z.coerce.number().int().min(0).max(1).optional().default(0),
  assign_to_commercial: z.coerce.number().int().min(0).max(1).optional().default(0),
  quoter_ids: z.array(z.coerce.number().int().positive()).optional().default([]),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const methodValidation = validateHttpMethod(request, ["GET"]);
  if (!methodValidation.isValidMethod) return methodValidation.response;

  const roleValidation = await validateApiRole(request, [
    UserRole.ADMIN,
    UserRole.COMERCIAL,
    UserRole.DIRECTIVO,
    UserRole.COLABORADOR,
  ]);
  if (!roleValidation.isAuthorized) return roleValidation.response;

  try {
    const { id } = await params;
    const tasks = await getTaskTemplatesByProductId(Number(id));
    // Attach quoters to each template
    const tasksWithQuoters = await Promise.all(
      tasks.map(async (t) => ({
        ...t,
        quoters: t.requires_quote === 1 ? await getTemplateQuoters(t.id) : [],
      }))
    );
    return NextResponse.json(tasksWithQuoters);
  } catch (error) {
    console.error("Error fetching task templates:", error);
    return NextResponse.json({ error: "Error al obtener las tareas" }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const methodValidation = validateHttpMethod(request, ["POST"]);
  if (!methodValidation.isValidMethod) return methodValidation.response;

  const roleValidation = await validateApiRole(request, [
    UserRole.ADMIN,
    UserRole.COMERCIAL,
    UserRole.DIRECTIVO,
  ]);
  if (!roleValidation.isAuthorized) return roleValidation.response;

  try {
    const { id } = await params;
    const product = await getProductById(Number(id));
    if (!product) {
      return NextResponse.json({ error: "Producto no encontrado" }, { status: 404 });
    }

    const body = await request.json();
    const validation = taskSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: "Datos inválidos", details: validation.error.format() },
        { status: 400 }
      );
    }

    // Determine next order_index
    const existing = await getTaskTemplatesByProductId(Number(id));
    const order_index = existing.length;

    const { quoter_ids, ...templateData } = validation.data;

    const task = await createTaskTemplate({
      product_id: Number(id),
      order_index,
      ...templateData,
      task_type: templateData.task_type ?? "execution",
      requires_quote: templateData.requires_quote ?? 0,
      assign_to_commercial: templateData.assign_to_commercial ?? 0,
    });

    // Save pre-configured quoters if requires_quote
    if (templateData.requires_quote === 1 && quoter_ids && quoter_ids.length > 0) {
      await setTemplateQuoters(task.id, quoter_ids);
    }

    const quoters = await getTemplateQuoters(task.id);
    return NextResponse.json({ ...task, quoters }, { status: 201 });
  } catch (error) {
    console.error("Error creating task template:", error);
    return NextResponse.json({ error: "Error al crear la tarea" }, { status: 500 });
  }
}

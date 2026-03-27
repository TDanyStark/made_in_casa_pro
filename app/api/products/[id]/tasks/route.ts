import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getProductById } from "@/lib/queries/products";
import {
  getTaskTemplatesByProductId,
  createTaskTemplate,
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
    return NextResponse.json(tasks);
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

    const task = await createTaskTemplate({
      product_id: Number(id),
      order_index,
      ...validation.data,
      task_type: validation.data.task_type ?? "execution",
      requires_quote: validation.data.requires_quote ?? 0,
      assign_to_commercial: validation.data.assign_to_commercial ?? 0,
    });

    return NextResponse.json(task, { status: 201 });
  } catch (error) {
    console.error("Error creating task template:", error);
    return NextResponse.json({ error: "Error al crear la tarea" }, { status: 500 });
  }
}

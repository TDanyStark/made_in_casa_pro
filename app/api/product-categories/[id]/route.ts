import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  getProductCategoryById,
  updateProductCategory,
} from "@/lib/queries/productCategories";
import { validateApiRole, validateHttpMethod } from "@/lib/services/api-auth";
import { UserRole } from "@/lib/definitions";

const updateSchema = z.object({
  name: z.string().min(1, "El nombre es requerido"),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const methodValidation = validateHttpMethod(request, ["PATCH"]);
  if (!methodValidation.isValidMethod) return methodValidation.response;

  const roleValidation = await validateApiRole(request, [
    UserRole.ADMIN,
    UserRole.COMERCIAL,
    UserRole.DIRECTIVO,
  ]);
  if (!roleValidation.isAuthorized) return roleValidation.response;

  try {
    const { id } = await params;
    const body = await request.json();

    const validation = updateSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: "Datos inválidos", details: validation.error.format() },
        { status: 400 }
      );
    }

    const existing = await getProductCategoryById(Number(id));
    if (!existing) {
      return NextResponse.json({ error: "Categoría no encontrada" }, { status: 404 });
    }

    const updated = await updateProductCategory(Number(id), validation.data.name);
    return NextResponse.json(updated);
  } catch (error) {
    console.error("Error updating product category:", error);
    return NextResponse.json({ error: "Error al actualizar la categoría" }, { status: 500 });
  }
}

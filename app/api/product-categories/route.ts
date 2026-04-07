import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  getProductCategories,
  getProductCategoriesWithPagination,
  createProductCategory,
} from "@/lib/queries/productCategories";
import { ITEMS_PER_PAGE } from "@/config/constants";
import { validateApiRole, validateHttpMethod } from "@/lib/services/api-auth";
import { OPERATIONS_ROLES } from "@/lib/role-groups";

const categorySchema = z.object({
  name: z.string().min(1, "El nombre es requerido"),
});

export async function GET(request: NextRequest) {
  const methodValidation = validateHttpMethod(request, ["GET"]);
  if (!methodValidation.isValidMethod) return methodValidation.response;

  const roleValidation = await validateApiRole(request, OPERATIONS_ROLES);
  if (!roleValidation.isAuthorized) return roleValidation.response;

  try {
    const url = new URL(request.url);
    const all = url.searchParams.get("all");

    // Devuelve lista completa sin paginar (para selects/dropdowns)
    if (all === "true") {
      const categories = await getProductCategories();
      return NextResponse.json(categories);
    }

    const page = parseInt(url.searchParams.get("page") || "1");
    const limit = parseInt(url.searchParams.get("limit") || ITEMS_PER_PAGE.toString());
    const search = url.searchParams.get("search") || undefined;

    const { categories, total } = await getProductCategoriesWithPagination({ page, limit, search });
    const pageCount = Math.ceil(total / limit);

    return NextResponse.json({ data: categories, pageCount, currentPage: page, total });
  } catch (error) {
    console.error("Error fetching product categories:", error);
    return NextResponse.json({ error: "Error al obtener categorías" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const methodValidation = validateHttpMethod(request, ["POST"]);
  if (!methodValidation.isValidMethod) return methodValidation.response;

  const roleValidation = await validateApiRole(request, OPERATIONS_ROLES);
  if (!roleValidation.isAuthorized) return roleValidation.response;

  try {
    const body = await request.json();
    const validation = categorySchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: "Datos inválidos", details: validation.error.format() },
        { status: 400 }
      );
    }

    const category = await createProductCategory(validation.data.name);
    return NextResponse.json(category, { status: 201 });
  } catch (error) {
    console.error("Error creating product category:", error);
    return NextResponse.json({ error: "Error al crear la categoría" }, { status: 500 });
  }
}

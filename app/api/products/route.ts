import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createProduct, getProductsWithPagination } from "@/lib/queries/products";
import { ITEMS_PER_PAGE } from "@/config/constants";
import { validateApiRole, validateHttpMethod } from "@/lib/services/api-auth";
import { AUTHENTICATED_ROLES, OPERATIONS_ROLES } from "@/lib/role-groups";

const productSchema = z.object({
  name: z.string().min(1, "El nombre es requerido"),
  description: z.string().optional().nullable(),
  category_id: z.coerce.number().int().positive().optional().nullable(),
  is_active: z.coerce.number().int().min(0).max(1).optional(),
});

export async function GET(request: NextRequest) {
  const methodValidation = validateHttpMethod(request, ["GET"]);
  if (!methodValidation.isValidMethod) return methodValidation.response;

  const roleValidation = await validateApiRole(request, AUTHENTICATED_ROLES);
  if (!roleValidation.isAuthorized) return roleValidation.response;

  try {
    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get("page") || "1");
    const limit = parseInt(url.searchParams.get("limit") || ITEMS_PER_PAGE.toString());
    const search = url.searchParams.get("search") || undefined;
    const categoryIdParam = url.searchParams.get("category_id");
    const categoryId = categoryIdParam ? parseInt(categoryIdParam) : undefined;
    const isActiveParam = url.searchParams.get("is_active");
    const isActive = isActiveParam !== null ? parseInt(isActiveParam) : undefined;

    const { products, total } = await getProductsWithPagination({
      page,
      limit,
      search,
      categoryId,
      isActive,
    });

    const pageCount = Math.ceil(total / limit);
    return NextResponse.json({ data: products, pageCount, currentPage: page, total });
  } catch (error) {
    console.error("Error fetching products:", error);
    return NextResponse.json({ error: "Error al obtener productos" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const methodValidation = validateHttpMethod(request, ["POST"]);
  if (!methodValidation.isValidMethod) return methodValidation.response;

  const roleValidation = await validateApiRole(request, OPERATIONS_ROLES);
  if (!roleValidation.isAuthorized) return roleValidation.response;

  try {
    const body = await request.json();
    const validation = productSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: "Datos de producto inválidos", details: validation.error.format() },
        { status: 400 }
      );
    }

    const product = await createProduct(validation.data);
    return NextResponse.json(product, { status: 201 });
  } catch (error) {
    console.error("Error creating product:", error);
    return NextResponse.json({ error: "Error al crear el producto" }, { status: 500 });
  }
}

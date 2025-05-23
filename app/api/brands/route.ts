import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createBrand, getBrandById, getBrandsWithPagination } from "@/lib/queries/brands";
import { getManagerById } from "@/lib/queries/managers";
import { ITEMS_PER_PAGE } from "@/config/constants";
import { validateApiRole, validateHttpMethod } from "@/lib/services/api-auth";
import { UserRole } from "@/lib/definitions";

// Schema para validar los datos de una marca
const brandSchema = z.object({
  business_unit_id: z.number().int().positive().optional(),
  manager_id: z.number().int().positive(),
  name: z.string().min(1),
});

export async function POST(request: NextRequest) {
  // Validar método HTTP
  const methodValidation = validateHttpMethod(request, ['POST']);
  if (!methodValidation.isValidMethod) {
    return methodValidation.response;
  }

  // Validar rol del usuario (solo administradores y comerciales pueden crear marcas)
  const roleValidation = await validateApiRole(request, [
    UserRole.ADMIN, 
    UserRole.COMERCIAL, 
    UserRole.DIRECTIVO
  ]);
  if (!roleValidation.isAuthorized) {
    return roleValidation.response;
  }

  try {
    const body = await request.json();
    
    // Validación de los datos
    const validationResult = brandSchema.safeParse(body);
    
    if (!validationResult.success) {
      return NextResponse.json(
        { error: "Datos de marca inválidos", details: validationResult.error.format() },
        { status: 400 }
      );
    }
    
    const brandData = validationResult.data;
    
    // Verificar que el manager existe
    const manager = await getManagerById(brandData.manager_id.toString());
    if (!manager) {
      return NextResponse.json(
        { error: "El manager especificado no existe" },
        { status: 404 }
      );
    }
    
    // Crear la marca
    const newBrand = await createBrand(brandData);
    
    return NextResponse.json(newBrand, { status: 201 });
  } catch (error) {
    console.error("Error al crear la marca:", error);
    return NextResponse.json(
      { error: "Error al crear la marca" },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  // Validar método HTTP
  const methodValidation = validateHttpMethod(request, ['GET']);
  if (!methodValidation.isValidMethod) {
    return methodValidation.response;
  }

  // Validar rol del usuario (permitir a todos los usuarios autenticados ver marcas)
  const roleValidation = await validateApiRole(request, [
    UserRole.ADMIN, 
    UserRole.COMERCIAL, 
    UserRole.DIRECTIVO,
    UserRole.COLABORADOR
  ]);
  if (!roleValidation.isAuthorized) {
    return roleValidation.response;
  }

  try {
    const url = new URL(request.url);
    const managerId = url.searchParams.get("manager_id");
    const clientId = url.searchParams.get("client_id");
    const id = url.searchParams.get("id");
    const page = parseInt(url.searchParams.get("page") || "1");
    const limit = parseInt(url.searchParams.get("limit") || ITEMS_PER_PAGE.toString());
    const search = url.searchParams.get("search");
    
    // Si se solicita una marca específica por ID
    if (id) {
      const brand = await getBrandById(id);
      if (!brand) {
        return NextResponse.json(
          { error: "Marca no encontrada" },
          { status: 404 }
        );
      }
      return NextResponse.json(brand);
    } 
    else {// Si no hay ID específico, usar paginación
      // Get paginated results
      const { brands, total } = await getBrandsWithPagination({
        managerId: managerId || undefined,
        clientId: clientId || undefined,
        page,
        limit,
        search: search || undefined
      });
      
      // Calculate total pages
      const pageCount = Math.ceil(total / limit);
      
      return NextResponse.json({
        data: brands,
        pageCount,
        currentPage: page,
        total
      });
    }
  } catch (error) {
    console.error("Error al obtener marcas:", error);
    return NextResponse.json(
      { error: "Error al obtener marcas" },
      { status: 500 }
    );
  }
}
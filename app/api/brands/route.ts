import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createBrand, getBrandById, getBrandsWithPagination } from "@/lib/queries/brands";
import { getManagerById } from "@/lib/queries/managers";
import { ITEMS_PER_PAGE } from "@/config/constants";

// Schema para validar los datos de una marca
const brandSchema = z.object({
  manager_id: z.number().int().positive(),
  name: z.string().min(1),
});

export async function POST(request: NextRequest) {
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
  try {
    const url = new URL(request.url);
    const managerId = url.searchParams.get("manager_id");
    const clientId = url.searchParams.get("client_id");
    const id = url.searchParams.get("id");
    const page = parseInt(url.searchParams.get("page") || "1");
    const limit = ITEMS_PER_PAGE;
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
    // Si no hay ID específico, usar paginación
    else {
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
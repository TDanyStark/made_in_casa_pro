import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createBrand, getBrandById, getBrands, getBrandsByManagerId } from "@/lib/queries/brands";
import { getManagerById } from "@/lib/queries/managers";

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
    const id = url.searchParams.get("id");
    
    let brandsResponse;
    
    if (id) {
      // Obtener una marca específica por ID
      const brand = await getBrandById(id);
      if (!brand) {
        return NextResponse.json(
          { error: "Marca no encontrada" },
          { status: 404 }
        );
      }
      brandsResponse = brand;
    } else if (managerId) {
      // Obtener marcas por manager_id
      brandsResponse = await getBrandsByManagerId(managerId);
    } else {
      // Obtener todas las marcas
      brandsResponse = await getBrands();
    }
    
    return NextResponse.json(brandsResponse);
  } catch (error) {
    console.error("Error al obtener marcas:", error);
    return NextResponse.json(
      { error: "Error al obtener marcas" },
      { status: 500 }
    );
  }
}
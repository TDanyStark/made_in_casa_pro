import { NextRequest, NextResponse } from 'next/server';
import { z } from "zod";
import { 
  getAreas, 
  createArea,
  getAreaById,
  getAreasWithPagination
} from '@/lib/queries/areas';
import { AreaType, UserRole } from '@/lib/definitions';
import { validateApiRole, validateHttpMethod } from "@/lib/services/api-auth";
import { ITEMS_PER_PAGE } from "@/config/constants";

// Schema para validar los datos de un área
const areaSchema = z.object({
  name: z.string().min(1)
});

export async function GET(request: NextRequest) {
  // Validar método HTTP
  const methodValidation = validateHttpMethod(request, ['GET']);
  if (!methodValidation.isValidMethod) {
    return methodValidation.response;
  }

  // Validar rol del usuario (permitir a todos los usuarios autenticados ver áreas)
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
    const id = url.searchParams.get("id");
    const page = parseInt(url.searchParams.get("page") || "1");
    const limit = parseInt(url.searchParams.get("limit") || ITEMS_PER_PAGE.toString());
    const search = url.searchParams.get("search");
    
    // Si se solicita un área específica por ID
    if (id) {
      const area = await getAreaById(id);
      if (!area) {
        return NextResponse.json(
          { error: "Área no encontrada" },
          { status: 404 }
        );
      }
      return NextResponse.json(area);
    } 
    else if (search || page > 1) {
      // Si hay búsqueda o paginación, usar getAreasWithPagination
      const { areas, total } = await getAreasWithPagination({
        page,
        limit,
        search: search || undefined
      });
      
      // Calculate total pages
      const pageCount = Math.ceil(total / limit);
      
      return NextResponse.json({
        data: areas,
        pageCount,
        currentPage: page,
        total
      });
    }
    else {
      // Get all areas
      const areas = await getAreas();
      
      return NextResponse.json(
        { data: areas },
        { status: 200 }
      );
    }
  } catch (error) {
    console.error('Error al obtener áreas:', error);
    return NextResponse.json(
      { error: 'Error al obtener áreas' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  // Validar método HTTP
  const methodValidation = validateHttpMethod(request, ['POST']);
  if (!methodValidation.isValidMethod) {
    return methodValidation.response;
  }

  // Validar rol del usuario (solo administradores y directivos pueden crear áreas)
  const roleValidation = await validateApiRole(request, [
    UserRole.ADMIN, 
    UserRole.DIRECTIVO
  ]);
  if (!roleValidation.isAuthorized) {
    return roleValidation.response;
  }

  try {
    // Parse request body
    const body = await request.json();
    
    // Validación de los datos
    const validationResult = areaSchema.safeParse(body);
    
    if (!validationResult.success) {
      return NextResponse.json(
        { error: "Datos de área inválidos", details: validationResult.error.format() },
        { status: 400 }
      );
    }
    
    // Create area data object
    const areaData: Omit<AreaType, "id"> = {
      name: validationResult.data.name.trim()
    };
    
    // Create new area
    const newArea = await createArea(areaData);

    return NextResponse.json(newArea, { status: 201 });
  } catch (error) {
    console.error('Error al crear área:', error);
    return NextResponse.json(
      { error: 'Error al crear área' },
      { status: 500 }
    );
  }
}

import { createClient, getClientsWithPagination } from '@/lib/queries/clients';
import { revalidatePath } from 'next/cache';
import { NextRequest, NextResponse } from 'next/server';
import { ITEMS_PER_PAGE } from '@/config/constants';
import { validateApiRole, validateHttpMethod } from '@/lib/services/api-auth';
import { UserRole } from '@/lib/definitions';
import { z } from 'zod';

// Schema para validar los datos del cliente
const clientSchema = z.object({
  name: z.string().min(1, "El nombre es obligatorio"),
  country_id: z.number().int().positive("El ID del país debe ser un número positivo")
});

export async function GET(request: NextRequest) {
  // Validar método HTTP
  const methodValidation = validateHttpMethod(request, ['GET']);
  if (!methodValidation.isValidMethod) {
    return methodValidation.response;
  }

  // Validar rol del usuario (permitir a todos los usuarios autenticados ver clientes)
  const roleValidation = validateApiRole(request, [
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
    const page = parseInt(url.searchParams.get("page") || "1");
    const limit = ITEMS_PER_PAGE;
    const search = url.searchParams.get("search");
    
    // Get paginated results
    const { clients, total } = await getClientsWithPagination({
      page,
      limit,
      search: search || undefined
    });
    
    // Calculate total pages
    const pageCount = Math.ceil(total / limit);
    
    return NextResponse.json({
      data: clients,
      pageCount,
      currentPage: page,
      total
    });
  } catch (error) {
    console.error("Error fetching clients:", error);
    return NextResponse.json({ error: "Error al obtener los clientes" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  // Validar método HTTP
  const methodValidation = validateHttpMethod(request, ['POST']);
  if (!methodValidation.isValidMethod) {
    return methodValidation.response;
  }

  // Validar rol del usuario (solo administradores y comerciales pueden crear clientes)
  const roleValidation = validateApiRole(request, [
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
    const validationResult = clientSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json({ 
        error: "Datos de cliente inválidos", 
        details: validationResult.error.format() 
      }, { status: 400 });
    }
    
    const { name, country_id } = validationResult.data;
    
    await createClient(name, country_id);
    
    revalidatePath('/clients');
    
    return NextResponse.json({
      message: 'Cliente creado exitosamente',
    }, { status: 201 });
  } catch (error) {
    console.error("Error creating client:", error);
    return NextResponse.json({
      message: 'Error al crear el cliente: ' + String(error),
    }, { status: 500 });
  }
}
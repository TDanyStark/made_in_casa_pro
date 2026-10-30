import { createClient, getClientById, getClientsWithPagination } from '@/lib/queries/clients';
import { revalidatePath } from 'next/cache';
import { NextRequest, NextResponse } from 'next/server';
import { ITEMS_PER_PAGE } from '@/config/constants';
import { validateApiRole, validateHttpMethod } from '@/lib/services/api-auth';
import { AUTHENTICATED_ROLES, OPERATIONS_ROLES } from '@/lib/role-groups';
import { z } from 'zod';

const MAX_CLIENTS_LIMIT = 500;

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
  const roleValidation = await validateApiRole(request, AUTHENTICATED_ROLES);
  if (!roleValidation.isAuthorized) {
    return roleValidation.response;
  }

  try {
    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get("page") || "1");
    // `limit` opcional para selects que necesitan la lista completa
    // (p. ej. el filtro de cliente en /projects); por defecto se pagina igual.
    const requestedLimit = parseInt(url.searchParams.get("limit") || "");
    const limit =
      Number.isFinite(requestedLimit) && requestedLimit > 0
        ? Math.min(requestedLimit, MAX_CLIENTS_LIMIT)
        : ITEMS_PER_PAGE;
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
  const roleValidation = await validateApiRole(request, OPERATIONS_ROLES);
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
    
    const result = await createClient(name, country_id);
    const newId = Number(result.rows[0]?.id);

    revalidatePath('/clients');

    // Devolvemos el cliente creado (con id y país) para que los flujos de
    // creación inline (ClientSelect) puedan autoseleccionarlo.
    const newClient = await getClientById(String(newId));

    return NextResponse.json(newClient ?? { id: newId, name, country_id }, { status: 201 });
  } catch (error) {
    console.error("Error creating client:", error);
    return NextResponse.json({
      message: 'Error al crear el cliente: ' + String(error),
    }, { status: 500 });
  }
}

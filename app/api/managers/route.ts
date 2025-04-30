import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createManager, getManagerByEmail, getManagersWithPagination } from "@/lib/queries/managers";
import { getClientById } from "@/lib/queries/clients";
import { ITEMS_PER_PAGE } from "@/config/constants";
import { validateApiRole, validateHttpMethod } from "@/lib/services/api-auth";
import { UserRole } from "@/lib/definitions";

// Schema for validating manager data
const managerSchema = z.object({
  client_id: z.number().int().positive(),
  name: z.string().min(1),
  email: z.string().email(),
  phone: z.string().min(1),
  biography: z.string(),
});

export async function POST(request: NextRequest) {
  // Validar método HTTP
  const methodValidation = validateHttpMethod(request, ['POST']);
  if (!methodValidation.isValidMethod) {
    return methodValidation.response;
  }

  // Validar rol del usuario (solo administradores y comerciales pueden crear gerentes)
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

    // Validate the data against our schema
    const validationResult = managerSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json({ error: validationResult.error.errors }, { status: 400 });
    }

    const { client_id, name, email, phone, biography } = validationResult.data;

    // Check if the client exists
    const existingClient = await getClientById(client_id.toString());
    if (!existingClient) {
      return NextResponse.json({ error: "El cliente no existe" }, { status: 404 });
    }

    // Check if the email already exists
    const existEmailManager = await getManagerByEmail(email);
    if (existEmailManager) {
      return NextResponse.json({ error: "El correo electrónico ya está en uso" }, { status: 409 });
    }

    // Create the manager using the query function
    const newManager = await createManager({
      client_id,
      name,
      email,
      phone,
      biography
    });

    return NextResponse.json(newManager, { status: 201 });
  } catch (error) {
    console.error("Error creating manager:", error);
    return NextResponse.json({ error: "Error al crear el gerente "+ error }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  // Validar método HTTP
  const methodValidation = validateHttpMethod(request, ['GET']);
  if (!methodValidation.isValidMethod) {
    return methodValidation.response;
  }

  // Validar rol del usuario (permitir a todos los usuarios autenticados ver gerentes)
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
    const clientId = url.searchParams.get("client_id");
    const page = parseInt(url.searchParams.get("page") || "1");
    const limit = ITEMS_PER_PAGE;
    const search = url.searchParams.get("search");
    
    // Get paginated results
    const { managers, total } = await getManagersWithPagination({
      clientId: clientId || undefined,
      page,
      limit,
      search: search || undefined
    });
    
    // Calculate total pages
    const pageCount = Math.ceil(total / limit);
    
    return NextResponse.json({
      data: managers,
      pageCount,
      currentPage: page,
      total
    });
  } catch (error) {
    console.error("Error fetching managers:", error);
    return NextResponse.json({ error: "Error al obtener los gerentes" }, { status: 500 });
  }
}
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getClientById, updateClient } from "@/lib/queries/clients";
import { validateApiRole, validateHttpMethod } from "@/lib/services/api-auth";
import { UserRole } from "@/lib/definitions";

// Schema para validar los datos de actualización del cliente
const clientUpdateSchema = z.object({
  name: z.string().min(1).optional(),
  country_id: z.coerce.number().int().positive().optional(),
  accept_business_units: z.boolean().optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Validar método HTTP
  const methodValidation = validateHttpMethod(request, ["PATCH"]);
  if (!methodValidation.isValidMethod) {
    return methodValidation.response;
  }

  // Validar rol del usuario
  const roleValidation = await validateApiRole(request, [
    UserRole.ADMIN, 
    UserRole.COMERCIAL, 
    UserRole.DIRECTIVO
  ]);
  if (!roleValidation.isAuthorized) {
    return roleValidation.response;
  }
  
  try {
    // Obtener el ID del cliente de los parámetros
    const { id } = await params;
    const body = await request.json();

    // Validar los datos recibidos
    const validationResult = clientUpdateSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        { error: validationResult.error.errors },
        { status: 400 }
      );
    }

    const { name, country_id, accept_business_units } = validationResult.data;

    // Verificar si el cliente existe
    const existingClient = await getClientById(id);
    if (!existingClient) {
      return NextResponse.json(
        { error: "El cliente no existe" },
        { status: 404 }
      );
    }

    // Si no hay campos para actualizar, devolver el cliente existente
    if (name === undefined && country_id === undefined && accept_business_units === undefined) {
      return NextResponse.json(existingClient);
    }

    // Utilizar la función del modelo para actualizar el cliente
    const updatedClient = await updateClient(id, { name, country_id, accept_business_units });

    return NextResponse.json(updatedClient);
  } catch (error) {
    console.error("Error updating client:", error);
    return NextResponse.json(
      { error: "Error al actualizar el cliente: " + error },
      { status: 500 }
    );
  }
}
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createManager, getManagerByEmail, getManagers, getManagersByClientId } from "@/lib/queries/managers";
import { getClientById } from "@/lib/queries/clients";

// Schema for validating manager data
const managerSchema = z.object({
  client_id: z.number().int().positive(),
  name: z.string().min(1),
  email: z.string().email(),
  phone: z.string().min(1),
  biography: z.string().min(1),
});

export async function POST(request: NextRequest) {
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
    return NextResponse.json({ error: "Error al crear el gerente" }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const clientId = url.searchParams.get("client_id");
    
    let managers;
    
    if (clientId) {
      managers = await getManagersByClientId(clientId);
    } else {
      managers = await getManagers();
    }
    
    return NextResponse.json(managers);
  } catch (error) {
    console.error("Error fetching managers:", error);
    return NextResponse.json({ error: "Error al obtener los gerentes" }, { status: 500 });
  }
}
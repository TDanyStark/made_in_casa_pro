import { createClient, fetchFilteredClients } from '@/lib/queries/clients';
import { revalidatePath } from 'next/cache';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const clients = await fetchFilteredClients();
    return NextResponse.json(clients);
  } catch (error) {
    console.error("Error fetching clients:", error);
    return NextResponse.json({ error: "Error al obtener los clientes" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const body = await request.json();
  const {name, country_id} = body;

  try{
    await createClient(name, country_id);
  } catch (error) {
    return Response.json({
      message: 'Error creating client!' + String(error),
    }, {
      status: 500,
    });
  }

  revalidatePath('/clients');

  return Response.json({
    message: 'Client created!',
  }, {
    status: 201,
  });
}
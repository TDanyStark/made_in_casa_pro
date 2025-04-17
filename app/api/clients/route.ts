import { createClient, getClientsWithPagination } from '@/lib/queries/clients';
import { revalidatePath } from 'next/cache';
import { NextRequest, NextResponse } from 'next/server';
import { ITEMS_PER_PAGE } from '@/config/constants';

export async function GET(request: NextRequest) {
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
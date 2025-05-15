import { NextResponse } from "next/server";
import { getRoles, createRole } from "@/lib/queries/roles";

export async function GET() {
  try {
    const result = await getRoles();
    return NextResponse.json(result.rows);
  } catch (error) {
    console.error('Error en GET /api/roles:', error);
    return NextResponse.json(
      { error: 'Error al obtener los roles' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const { role } = await request.json();
    
    if (!role) {
      return NextResponse.json(
        { message: 'El nombre del rol es obligatorio' },
        { status: 400 }
      );
    }
    
    const result = await createRole(role);
    
    return NextResponse.json({
      message: 'Rol creado exitosamente',
      id: result.lastInsertRowid
    }, { status: 201 });
    
  } catch (error) {
    console.error('Error en POST /api/roles:', error);
    return NextResponse.json(
      { message: 'Error al crear el rol' },
      { status: 500 }
    );
  }
}

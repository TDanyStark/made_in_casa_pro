import { NextResponse } from "next/server";
import { createUser, getUsers } from "@/lib/queries/users";
import { hashPassword } from "@/lib/utils";

export async function GET() {
  try {
    const result = await getUsers();
    
    // Filtrar la información sensible como contraseñas
    const users = result.rows.map(user => ({
      id: user.id,
      name: user.name,
      email: user.email,
      rol_id: user.rol_id
    }));
    
    return NextResponse.json(users);
  } catch (error) {
    console.error('Error en GET /api/users:', error);
    return NextResponse.json(
      { error: 'Error al obtener los usuarios' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const { name, email, password, rol_id } = await request.json();
    
    // Validaciones
    if (!name || !email || !password || !rol_id) {
      return NextResponse.json(
        { message: 'Todos los campos son obligatorios' },
        { status: 400 }
      );
    }
    
    // Hash de la contraseña antes de guardar
    const hashedPassword = await hashPassword(password);
    
    // Crear usuario
    const result = await createUser(name, email, hashedPassword, rol_id);
    
    return NextResponse.json({ 
      message: 'Usuario creado exitosamente',
      id: result.lastInsertRowid
    }, { status: 201 });

  } catch (error: Error | unknown) {
    console.error('Error en POST /api/users:', error);
    
    // Verificar si es un error de duplicado de email
    if (error instanceof Error && error.message.includes('UNIQUE constraint failed')) {
      return NextResponse.json(
        { message: 'Ya existe un usuario con ese email' },
        { status: 409 }
      );
    }
    
    return NextResponse.json(
      { message: 'Error al crear el usuario' },
      { status: 500 }
    );
  }
}

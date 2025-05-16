import { NextRequest, NextResponse } from "next/server";
import { createUser, getUsersWithPagination } from "@/lib/queries/users";
import bcrypt from "bcrypt";
import { ITEMS_PER_PAGE } from "@/config/constants";
import { validateApiRole, validateHttpMethod } from "@/lib/services/api-auth";
import { UserRole } from "@/lib/definitions";

export async function GET(request: NextRequest) {
  // Validar método HTTP
  const methodValidation = validateHttpMethod(request, ['GET']);
  if (!methodValidation.isValidMethod) {
    return methodValidation.response;
  }

  // Validar rol del usuario (permitir a todos los usuarios autenticados ver usuarios)
  const roleValidation = await validateApiRole(request, [
    UserRole.ADMIN
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
    const { users, total } = await getUsersWithPagination({
      page,
      limit,
      search: search || undefined
    });
    
    
    // Calculate total pages
    const pageCount = Math.ceil(total / limit);

    return NextResponse.json({
      data: users,
      pageCount,
      currentPage: page,
      total
    });
  } catch (error) {
    console.error('Error fetching users:', error);
    return NextResponse.json(
      { error: 'Error al obtener los usuarios' },
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

  // Validar rol del usuario (solo administradores pueden crear usuarios)
  const roleValidation = await validateApiRole(request, [
    UserRole.ADMIN
  ]);
  if (!roleValidation.isAuthorized) {
    return roleValidation.response;
  }
  
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
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Crear usuario
    const result = await createUser(name, email, hashedPassword, rol_id);
    
    return NextResponse.json({ 
      message: 'Usuario creado exitosamente',
      id: Number(result.lastInsertRowid),
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

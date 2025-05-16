import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getUserById, getUserByEmail, updateUser } from "@/lib/queries/users";
import { revalidatePath } from "next/cache";
import { validateApiRole, validateHttpMethod } from "@/lib/services/api-auth";
import { UserRole } from "@/lib/definitions";
import bcrypt from "bcrypt";

interface UserUpdate {
  email: string;
  name: string;
  password: string;
  is_active: boolean;
  rol_id: number;
  must_change_password: boolean;
}

// Schema para validar los datos de actualización de usuario
const userUpdateSchema = z.object({
  email: z.string().email().optional(),
  name: z.string().min(1).optional(),
  password: z.string().min(6).optional(),
  is_active: z.boolean().optional(),
  rol_id: z.number().int().positive().optional(),
  must_change_password: z.boolean().optional(),
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

  // Validar rol del usuario (solo administradores pueden actualizar usuarios)
  const roleValidation = await validateApiRole(request, [UserRole.ADMIN]);

  if (!roleValidation.isAuthorized) {
    return roleValidation.response;
  }

  try {
    // Obtener el ID del usuario a actualizar
    const { id } = await params;
    const body = await request.json();

    // Validar los datos contra nuestro schema
    const validationResult = userUpdateSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        { error: validationResult.error.errors },
        { status: 400 }
      );
    }

    const { email, name, password, is_active, rol_id, must_change_password } =
      validationResult.data;

    // Comprobar si el usuario existe
    const userResult = await getUserById(Number(id));
    if (!userResult.rows || userResult.rows.length === 0) {
      return NextResponse.json(
        { error: "El usuario no existe" },
        { status: 404 }
      );
    }

    const existingUser = userResult.rows[0];

    // Si se está actualizando el email, verificar que no esté en uso por otro usuario
    if (email && email !== existingUser.email) {
      const existingUserWithEmail = await getUserByEmail(email);
      if (
        existingUserWithEmail.length > 0 &&
        existingUserWithEmail[0].id !== Number(id)
      ) {
        return NextResponse.json(
          { error: "El correo electrónico ya está en uso" },
          { status: 409 }
        );
      }
    }

    // Si no hay campos para actualizar, devolver el usuario existente
    if (
      !email &&
      !name &&
      password === undefined &&
      is_active === undefined &&
      rol_id === undefined &&
      must_change_password === undefined
    ) {
      return NextResponse.json(existingUser);
    }    // Preparar los datos de actualización
    const updateData: Partial<UserUpdate> = {};
    if (email) updateData.email = email;
    if (name) updateData.name = name;
    if (password) updateData.password = await bcrypt.hash(password, 10);
    if (is_active !== undefined) updateData.is_active = is_active;
    if (rol_id) updateData.rol_id = rol_id;
    if (must_change_password !== undefined)
      updateData.must_change_password = must_change_password;

    // Actualizar usuario
    const updatedUser = await updateUser(id, updateData);

    // Revalidar rutas
    revalidatePath(`/admin/users/${id}`);
    revalidatePath(`/admin/users`);

    return NextResponse.json(updatedUser);
  } catch (error) {
    console.error("Error actualizando usuario:", error);
    return NextResponse.json(
      { error: "Error al actualizar el usuario: " + error },
      { status: 500 }
    );
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Validar método HTTP
  const methodValidation = validateHttpMethod(request, ["GET"]);
  if (!methodValidation.isValidMethod) {
    return methodValidation.response;
  }

  // Validar rol del usuario (solo administradores pueden ver detalles de usuarios)
  const roleValidation = await validateApiRole(request, [UserRole.ADMIN]);
  if (!roleValidation.isAuthorized) {
    return roleValidation.response;
  }

  try {
    // Obtener el ID del usuario
    const { id } = await params;

    // Obtener usuario por ID
    const userResult = await getUserById(Number(id));
    if (!userResult.rows || userResult.rows.length === 0) {
      return NextResponse.json(
        { error: "El usuario no existe" },
        { status: 404 }
      );
    }

    // Eliminar el campo de contraseña antes de devolver el usuario
    const user = userResult.rows[0];
    delete user.password;

    return NextResponse.json(user);
  } catch (error) {
    console.error("Error obteniendo usuario:", error);
    return NextResponse.json(
      { error: "Error al obtener el usuario: " + error },
      { status: 500 }
    );
  }
}

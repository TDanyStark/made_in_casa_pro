import { NextRequest, NextResponse } from "next/server";
import { validateApiRole, validateHttpMethod } from "@/lib/services/api-auth";
import { UserRole } from "@/lib/definitions";
import { getUsersWithPagination } from "@/lib/queries/users";

export async function GET(request: NextRequest) {
  const methodValidation = validateHttpMethod(request, ["GET"]);
  if (!methodValidation.isValidMethod) return methodValidation.response;

  const roleValidation = await validateApiRole(request, [
    UserRole.ADMIN,
    UserRole.DIRECTIVO,
    UserRole.COMERCIAL,
    UserRole.COLABORADOR,
  ]);
  if (!roleValidation.isAuthorized) return roleValidation.response;

  try {
    const { users } = await getUsersWithPagination({
      rolId: [UserRole.ADMIN, UserRole.DIRECTIVO, UserRole.COMERCIAL, UserRole.COLABORADOR],
      limit: 1000,
    });

    return NextResponse.json({ data: users });
  } catch (error) {
    console.error("Error fetching assignable users:", error);
    return NextResponse.json({ error: "Error al obtener usuarios asignables" }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { getUsersWithPagination } from "@/lib/queries/users";
import { validateApiRole, validateHttpMethod } from "@/lib/services/api-auth";
import { UserRole } from "@/lib/definitions";

export async function GET(request: NextRequest) {
  const methodValidation = validateHttpMethod(request, ["GET"]);
  if (!methodValidation.isValidMethod) return methodValidation.response;

  const roleValidation = await validateApiRole(request, [
    UserRole.ADMIN, UserRole.DIRECTIVO, UserRole.COMERCIAL, UserRole.COLABORADOR,
  ]);
  if (!roleValidation.isAuthorized) return roleValidation.response;

  try {
    const { users } = await getUsersWithPagination({
      rolId: [UserRole.COMERCIAL, UserRole.DIRECTIVO, UserRole.ADMIN], // Include Directivos and Admins too if needed, but definitely Directivos as requested
      limit: 1000,
    });

    return NextResponse.json({ data: users });
  } catch (error) {
    console.error("Error fetching commercials:", error);
    return NextResponse.json({ error: "Error al obtener comerciales" }, { status: 500 });
  }
}

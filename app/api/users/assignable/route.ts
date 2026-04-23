import { NextRequest, NextResponse } from "next/server";
import { validateApiRole, validateHttpMethod } from "@/lib/services/api-auth";
import { getUsersWithPagination } from "@/lib/queries/users";
import { AUTHENTICATED_ROLES } from "@/lib/role-groups";

export async function GET(request: NextRequest) {
  const methodValidation = validateHttpMethod(request, ["GET"]);
  if (!methodValidation.isValidMethod) return methodValidation.response;

  const roleValidation = await validateApiRole(request, AUTHENTICATED_ROLES);
  if (!roleValidation.isAuthorized) return roleValidation.response;

  try {
    const { users } = await getUsersWithPagination({
      rolId: [...AUTHENTICATED_ROLES],
      limit: 1000,
      withTaskCount: true,
    });

    return NextResponse.json({ data: users });
  } catch (error) {
    console.error("Error fetching assignable users:", error);
    return NextResponse.json({ error: "Error al obtener usuarios asignables" }, { status: 500 });
  }
}

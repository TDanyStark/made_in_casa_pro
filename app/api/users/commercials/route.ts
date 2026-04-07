import { NextRequest, NextResponse } from "next/server";
import { getUsersWithPagination } from "@/lib/queries/users";
import { validateApiRole, validateHttpMethod } from "@/lib/services/api-auth";
import { AUTHENTICATED_ROLES, CREATOR_FILTER_ROLES } from "@/lib/role-groups";

export async function GET(request: NextRequest) {
  const methodValidation = validateHttpMethod(request, ["GET"]);
  if (!methodValidation.isValidMethod) return methodValidation.response;

  const roleValidation = await validateApiRole(request, AUTHENTICATED_ROLES);
  if (!roleValidation.isAuthorized) return roleValidation.response;

  try {
    const { users } = await getUsersWithPagination({
      rolId: [...CREATOR_FILTER_ROLES],
      limit: 1000,
    });

    return NextResponse.json({ data: users });
  } catch (error) {
    console.error("Error fetching commercials:", error);
    return NextResponse.json({ error: "Error al obtener comerciales" }, { status: 500 });
  }
}

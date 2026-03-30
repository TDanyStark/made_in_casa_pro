import { NextRequest, NextResponse } from "next/server";
import { validateApiRole, validateHttpMethod } from "@/lib/services/api-auth";
import { UserRole } from "@/lib/definitions";
import { getTrafficWithPagination } from "@/lib/queries/traffic";
import { ITEMS_PER_PAGE } from "@/config/constants";
import { decrypt, SessionData } from "@/lib/session";
import { cookies } from "next/headers";

export async function GET(request: NextRequest) {
  const methodValidation = validateHttpMethod(request, ["GET"]);
  if (!methodValidation.isValidMethod) return methodValidation.response;

  const roleValidation = await validateApiRole(request, [
    UserRole.ADMIN, UserRole.DIRECTIVO, UserRole.COMERCIAL, UserRole.COLABORADOR,
  ]);
  if (!roleValidation.isAuthorized) return roleValidation.response;

  try {
    const cookie = (await cookies()).get("session")?.value;
    const session = cookie ? (await decrypt(cookie)) as SessionData : null;
    if (!session) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get("page") || "1");
    const limit = parseInt(url.searchParams.get("limit") || ITEMS_PER_PAGE.toString());
    const search = url.searchParams.get("search") || undefined;
    const brandId = url.searchParams.get("brand_id") ? parseInt(url.searchParams.get("brand_id")!) : undefined;
    const commercialId = url.searchParams.get("commercial_id") ? parseInt(url.searchParams.get("commercial_id")!) : undefined;

    const { data, total } = await getTrafficWithPagination({
      page,
      limit,
      search,
      brandId,
      commercialId,
      userId: session.id,
      userRole: session.rol_id,
    });

    const pageCount = Math.ceil(total / limit);
    return NextResponse.json({ data, pageCount, currentPage: page, total });
  } catch (error) {
    console.error("Error fetching traffic:", error);
    return NextResponse.json({ error: "Error al obtener datos de tráfico" }, { status: 500 });
  }
}

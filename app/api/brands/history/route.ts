import { UserRole } from "@/lib/definitions";
import { getBrandManagerHistory } from "@/lib/queries/brands";
import { validateApiRole, validateHttpMethod } from "@/lib/services/api-auth";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  // Validar método HTTP
  const methodValidation = validateHttpMethod(request, ["GET"]);
  if (!methodValidation.isValidMethod) {
    return methodValidation.response;
  }

  const roleValidation = await validateApiRole(request, [
    UserRole.ADMIN,
    UserRole.COMERCIAL,
    UserRole.DIRECTIVO,
  ]);
  if (!roleValidation.isAuthorized) {
    return roleValidation.response;
  }
  try {
    // Extract brand ID from search params
    const searchParams = request.nextUrl.searchParams;
    const brandId = searchParams.get("brandId");

    if (!brandId) {
      return NextResponse.json(
        { error: "Brand ID is required" },
        { status: 400 }
      );
    }

    const history = await getBrandManagerHistory(brandId);
    return NextResponse.json({ history });
  } catch (error) {
    console.error("Error fetching brand manager history:", error);
    return NextResponse.json(
      { error: "Failed to fetch brand history" },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { decrypt } from "@/lib/session";
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
    const cookie = (await cookies()).get("session")?.value;
    if (!cookie) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

    const session = await decrypt(cookie);
    if (!session) return NextResponse.json({ error: "Sesión inválida" }, { status: 401 });

    return NextResponse.json({ 
      id: session.id,
      email: session.email,
      name: session.name, // jose payload includes name if it was encrypted there
      rol_id: session.rol_id
    });
  } catch (error) {
    console.error("Error in /api/me:", error);
    return NextResponse.json({ error: "Error de servidor" }, { status: 500 });
  }
}

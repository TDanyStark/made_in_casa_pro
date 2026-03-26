import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { validateApiRole, validateHttpMethod } from "@/lib/services/api-auth";
import { UserRole } from "@/lib/definitions";
import { createProjectFolders } from "@/lib/services/googleDrive";

const schema = z.object({
  clientName: z.string().min(1),
  brandName: z.string().min(1),
  projectTitle: z.string().min(1),
  productNames: z.array(z.string().min(1)).default([]),
});

export async function POST(request: NextRequest) {
  const methodValidation = validateHttpMethod(request, ["POST"]);
  if (!methodValidation.isValidMethod) return methodValidation.response;

  const roleValidation = await validateApiRole(request, [
    UserRole.ADMIN, UserRole.DIRECTIVO, UserRole.COMERCIAL,
  ]);
  if (!roleValidation.isAuthorized) return roleValidation.response;

  try {
    const body = await request.json();
    const validation = schema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: "Datos inválidos", details: validation.error.format() },
        { status: 400 }
      );
    }

    const result = await createProjectFolders(validation.data);
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error("Error creating Drive folders:", error);
    const message = error instanceof Error ? error.message : "Error desconocido";
    return NextResponse.json(
      { error: "Error al crear carpetas en Drive", detail: message },
      { status: 500 }
    );
  }
}

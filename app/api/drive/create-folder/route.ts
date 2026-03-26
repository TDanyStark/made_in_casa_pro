import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { validateApiRole, validateHttpMethod } from "@/lib/services/api-auth";
import { UserRole } from "@/lib/definitions";
import { createProjectFolders } from "@/lib/services/googleDrive";
import { getAdminAndDirectivoEmails } from "@/lib/queries/users";
import { decrypt } from "@/lib/session";
import { cookies } from "next/headers";

const schema = z.object({
  clientName: z.string().min(1),
  brandName: z.string().min(1),
  projectTitle: z.string().min(1),
  productNames: z.array(z.string().min(1)).default([]),
  /** Emails adicionales a compartir (manager, co-managers). */
  shareEmails: z.array(z.string().email()).default([]),
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

    const { shareEmails, ...folderData } = validation.data;

    // Get the email of the user creating the project
    const cookie = (await cookies()).get("session")?.value;
    const session = cookie ? await decrypt(cookie) : null;
    const creatorEmail = session?.email ?? null;

    // Collect admin/directivo emails from DB
    const adminEmails = await getAdminAndDirectivoEmails();

    // Merge all emails: admins + creator + manager + co-managers
    const allEmails = [
      ...adminEmails,
      ...(creatorEmail ? [creatorEmail] : []),
      ...shareEmails,
    ];

    const result = await createProjectFolders({
      ...folderData,
      shareEmails: allEmails,
    });

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

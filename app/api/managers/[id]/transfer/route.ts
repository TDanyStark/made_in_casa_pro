import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { cookies } from "next/headers";
import { decrypt } from "@/lib/session";
import { transferManager } from "@/lib/queries/managers";
import { validateApiRole, validateHttpMethod } from "@/lib/services/api-auth";
import { domainErrorResponse } from "@/lib/services/api-errors";
import { OPERATIONS_ROLES } from "@/lib/role-groups";

const reassignmentSchema = z.object({
  brand_id: z.coerce.number().int().positive(),
  new_manager_id: z.coerce.number().int().positive(),
});

const projectReassignmentSchema = z.object({
  project_id: z.coerce.number().int().positive(),
  new_manager_id: z.coerce.number().int().positive(),
});

const transferSchema = z.object({
  target_client_id: z.coerce.number().int().positive(),
  email: z.string().email().optional().nullable(),
  phone: z.string().min(1).optional().nullable(),
  /** Fecha de inicio en el cliente destino; se usa como changed_at */
  started_at: z.string().datetime({ offset: true }).optional().nullable(),
  reason: z.string().max(1000).optional().nullable(),
  brand_reassignments: z.array(reassignmentSchema).optional().default([]),
  project_reassignments: z
    .array(projectReassignmentSchema)
    .optional()
    .default([]),
});

type Params = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  const methodValidation = validateHttpMethod(request, ["POST"]);
  if (!methodValidation.isValidMethod) return methodValidation.response;

  const roleValidation = await validateApiRole(request, OPERATIONS_ROLES);
  if (!roleValidation.isAuthorized) return roleValidation.response;

  try {
    const { id } = await params;
    const managerId = parseInt(id);
    if (Number.isNaN(managerId)) {
      return NextResponse.json({ error: "Gerente inválido" }, { status: 400 });
    }

    const body = await request.json();
    const validation = transferSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: "Datos inválidos", details: validation.error.format() },
        { status: 400 }
      );
    }

    const cookie = (await cookies()).get("session")?.value;
    const session = cookie ? await decrypt(cookie) : null;

    const result = await transferManager({
      managerId,
      targetClientId: validation.data.target_client_id,
      email: validation.data.email,
      phone: validation.data.phone,
      startedAt: validation.data.started_at,
      reason: validation.data.reason,
      changedBy: session?.id ?? null,
      brandReassignments: validation.data.brand_reassignments,
      projectReassignments: validation.data.project_reassignments,
    });

    return NextResponse.json(result);
  } catch (error) {
    const domain = domainErrorResponse(error);
    if (domain) return domain;
    console.error("Error transferring manager:", error);
    return NextResponse.json(
      { error: "Error al trasladar el gerente" },
      { status: 500 }
    );
  }
}

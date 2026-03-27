import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { validateApiRole, validateHttpMethod } from "@/lib/services/api-auth";
import { UserRole } from "@/lib/definitions";
import { submitQuote } from "@/lib/queries/taskQuotes";
import { decrypt } from "@/lib/session";
import { cookies } from "next/headers";

const bodySchema = z.object({
  price: z.coerce.number().positive().optional().nullable(),
  delivery_days: z.coerce.number().int().positive().optional().nullable(),
  delivery_hours: z.coerce.number().int().positive().optional().nullable(),
  notes: z.string().optional().nullable(),
});

type Params = { params: Promise<{ id: string; tid: string }> };

/**
 * POST /api/projects/[id]/tasks/[tid]/quotes/submit
 * External collaborator submits their quote for a task.
 * Only allowed if the user is in task_quote_invitations for this task.
 */
export async function POST(request: NextRequest, { params }: Params) {
  const methodValidation = validateHttpMethod(request, ["POST"]);
  if (!methodValidation.isValidMethod) return methodValidation.response;

  const roleValidation = await validateApiRole(request, [
    UserRole.ADMIN, UserRole.DIRECTIVO, UserRole.COMERCIAL, UserRole.COLABORADOR,
  ]);
  if (!roleValidation.isAuthorized) return roleValidation.response;

  try {
    const { tid } = await params;
    const taskId = parseInt(tid);

    const cookie = (await cookies()).get("session")?.value;
    const session = cookie ? await decrypt(cookie) : null;
    if (!session?.id) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const body = await request.json();
    const validation = bodySchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json({ error: "Datos inválidos", details: validation.error.format() }, { status: 400 });
    }

    const quote = await submitQuote({
      task_id: taskId,
      user_id: session.id,
      ...validation.data,
    });

    return NextResponse.json(quote, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error al enviar cotización";
    console.error("Error submitting quote:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { validateApiRole, validateHttpMethod } from "@/lib/services/api-auth";
import { UserRole } from "@/lib/definitions";
import { acceptQuote, rejectQuote } from "@/lib/queries/taskQuotes";
import { recalculateProjectProgress } from "@/lib/queries/projects";
import { decrypt } from "@/lib/session";
import { cookies } from "next/headers";

const bodySchema = z.object({
  action: z.enum(["accept", "reject"]),
});

type Params = { params: Promise<{ id: string; tid: string; qid: string }> };

/**
 * PATCH /api/projects/[id]/tasks/[tid]/quotes/[qid]
 * Accept or reject a quote.
 * - accept: assigns the user to the task, activates it, rejects all other quotes
 * - reject: marks the quote as rejected
 * Only ADMIN, DIRECTIVO, COMERCIAL can accept/reject quotes.
 */
export async function PATCH(request: NextRequest, { params }: Params) {
  const methodValidation = validateHttpMethod(request, ["PATCH"]);
  if (!methodValidation.isValidMethod) return methodValidation.response;

  const roleValidation = await validateApiRole(request, [
    UserRole.ADMIN, UserRole.DIRECTIVO, UserRole.COMERCIAL,
  ]);
  if (!roleValidation.isAuthorized) return roleValidation.response;

  try {
    const { id, qid } = await params;
    const projectId = parseInt(id);
    const quoteId = parseInt(qid);

    const cookie = (await cookies()).get("session")?.value;
    const session = cookie ? await decrypt(cookie) : null;
    if (!session?.id) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const body = await request.json();
    const validation = bodySchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
    }

    if (validation.data.action === "accept") {
      await acceptQuote(quoteId, session.id);
      await recalculateProjectProgress(projectId);
      return NextResponse.json({ success: true, action: "accepted" });
    } else {
      await rejectQuote(quoteId);
      return NextResponse.json({ success: true, action: "rejected" });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error al procesar cotización";
    console.error("Error processing quote:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

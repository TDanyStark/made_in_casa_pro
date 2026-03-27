import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { validateApiRole, validateHttpMethod } from "@/lib/services/api-auth";
import { UserRole } from "@/lib/definitions";
import {
  getTaskQuotes,
  getTaskQuoteInvitations,
  inviteExternalToQuote,
  removeQuoteInvitation,
} from "@/lib/queries/taskQuotes";
import { decrypt } from "@/lib/session";
import { cookies } from "next/headers";

const inviteSchema = z.object({
  user_id: z.coerce.number().int().positive(),
});

const removeInviteSchema = z.object({
  user_id: z.coerce.number().int().positive(),
});

type Params = { params: Promise<{ id: string; tid: string }> };

/**
 * GET /api/projects/[id]/tasks/[tid]/quotes
 * Returns quotes and invitations for a task.
 * ADMIN, DIRECTIVO, COMERCIAL can see all; COLABORADOR sees only their own.
 */
export async function GET(request: NextRequest, { params }: Params) {
  const methodValidation = validateHttpMethod(request, ["GET"]);
  if (!methodValidation.isValidMethod) return methodValidation.response;

  const roleValidation = await validateApiRole(request, [
    UserRole.ADMIN, UserRole.DIRECTIVO, UserRole.COMERCIAL, UserRole.COLABORADOR,
  ]);
  if (!roleValidation.isAuthorized) return roleValidation.response;

  try {
    const { tid } = await params;
    const taskId = parseInt(tid);

    const [quotes, invitations] = await Promise.all([
      getTaskQuotes(taskId),
      getTaskQuoteInvitations(taskId),
    ]);

    return NextResponse.json({ quotes, invitations });
  } catch (error) {
    console.error("Error fetching quotes:", error);
    return NextResponse.json({ error: "Error al obtener cotizaciones" }, { status: 500 });
  }
}

/**
 * POST /api/projects/[id]/tasks/[tid]/quotes
 * Invite an external collaborator to submit a quote for this task.
 * Only ADMIN, DIRECTIVO, COMERCIAL can invite.
 */
export async function POST(request: NextRequest, { params }: Params) {
  const methodValidation = validateHttpMethod(request, ["POST"]);
  if (!methodValidation.isValidMethod) return methodValidation.response;

  const roleValidation = await validateApiRole(request, [
    UserRole.ADMIN, UserRole.DIRECTIVO, UserRole.COMERCIAL,
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
    const validation = inviteSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
    }

    await inviteExternalToQuote(taskId, validation.data.user_id, session.id);

    const invitations = await getTaskQuoteInvitations(taskId);
    return NextResponse.json({ invitations }, { status: 201 });
  } catch (error) {
    console.error("Error inviting external:", error);
    return NextResponse.json({ error: "Error al invitar colaborador" }, { status: 500 });
  }
}

/**
 * DELETE /api/projects/[id]/tasks/[tid]/quotes
 * Remove an invitation. Body: { user_id }
 */
export async function DELETE(request: NextRequest, { params }: Params) {
  const methodValidation = validateHttpMethod(request, ["DELETE"]);
  if (!methodValidation.isValidMethod) return methodValidation.response;

  const roleValidation = await validateApiRole(request, [
    UserRole.ADMIN, UserRole.DIRECTIVO, UserRole.COMERCIAL,
  ]);
  if (!roleValidation.isAuthorized) return roleValidation.response;

  try {
    const { tid } = await params;
    const taskId = parseInt(tid);

    const body = await request.json();
    const validation = removeInviteSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
    }

    await removeQuoteInvitation(taskId, validation.data.user_id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error removing invitation:", error);
    return NextResponse.json({ error: "Error al quitar invitación" }, { status: 500 });
  }
}

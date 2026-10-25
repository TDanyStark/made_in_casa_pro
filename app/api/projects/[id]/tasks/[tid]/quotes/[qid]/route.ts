import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { validateApiRole, validateHttpMethod } from "@/lib/services/api-auth";
import { OPERATIONS_ROLES } from "@/lib/role-groups";
import { acceptQuote, rejectQuote } from "@/lib/queries/taskQuotes";
import { getTaskQuotes } from "@/lib/queries/taskQuotes";
import { getProjectTaskById } from "@/lib/queries/projectTasks";
import { decrypt } from "@/lib/session";
import { cookies } from "next/headers";
import {
  dispatchNotification,
  NOTIFICATION_EVENTS,
  recalculateProgressAndNotify,
} from "@/lib/services/notificationEngine";
import { syncProjectDriveAccess } from "@/lib/services/projectDriveAccess";
import { taskRuleErrorResponse } from "../../taskStateChange";

const bodySchema = z.object({
  action: z.enum(["accept", "reject"]),
});

type Params = { params: Promise<{ id: string; tid: string; qid: string }> };

/**
 * PATCH /api/projects/[id]/tasks/[tid]/quotes/[qid]
 * Accept or reject a quote.
 * - accept: assigns the user to the task, activates it, rejects all other quotes
 * - reject: marks the quote as rejected
 * The quote must belong to the URL task and project (404); accepting needs a
 * pending quote of a blocked, unassigned task without an accepted quote (409).
 * Only ADMIN, DIRECTIVO, COMERCIAL can accept/reject quotes.
 */
export async function PATCH(request: NextRequest, { params }: Params) {
  const methodValidation = validateHttpMethod(request, ["PATCH"]);
  if (!methodValidation.isValidMethod) return methodValidation.response;

  const roleValidation = await validateApiRole(request, OPERATIONS_ROLES);
  if (!roleValidation.isAuthorized) return roleValidation.response;

  try {
    const { id, tid, qid } = await params;
    const projectId = parseInt(id);
    const taskId = parseInt(tid);
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

    const scope = { projectId, taskId };
    if (validation.data.action === "accept") {
      const quote = (await getTaskQuotes(taskId)).find((q) => q.id === quoteId);
      if (!quote) {
        return NextResponse.json({ error: "Cotización no encontrada" }, { status: 404 });
      }
      await acceptQuote(quoteId, session.id, scope);
      const driveWarning = await syncProjectDriveAccess(projectId);
      await recalculateProgressAndNotify(projectId, session.id);
      await dispatchNotification({
        eventType: NOTIFICATION_EVENTS.QUOTE_ACCEPTED,
        actorUserId: session.id,
        projectId,
        taskId,
        quoteId,
        metadata: {
          price: quote.price ?? 0,
          delivery_days: quote.delivery_days ?? 0,
        },
      });

      // acceptQuote activates the task; notify only if it really ended up 'not_started'.
      const acceptedTask = await getProjectTaskById(taskId);
      if (acceptedTask && acceptedTask.status === "not_started" && acceptedTask.assigned_user_id) {
        await dispatchNotification({
          eventType: NOTIFICATION_EVENTS.TASK_READY,
          actorUserId: session.id,
          projectId,
          taskId,
        });
      }
      return NextResponse.json({
        success: true,
        action: "accepted",
        ...(driveWarning ? { driveWarning } : {}),
      });
    } else {
      await rejectQuote(quoteId, scope);
      return NextResponse.json({ success: true, action: "rejected" });
    }
  } catch (error) {
    const ruleResponse = taskRuleErrorResponse(error);
    if (ruleResponse) return ruleResponse;
    console.error("Error processing quote:", error);
    return NextResponse.json({ error: "Error al procesar cotización" }, { status: 500 });
  }
}

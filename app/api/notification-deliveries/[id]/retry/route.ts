import { NextRequest, NextResponse } from "next/server";
import { validateApiRole, validateHttpMethod } from "@/lib/services/api-auth";
import { ADMIN_ONLY_ROLES } from "@/lib/role-groups";
import {
  getDeliveryById,
  MAX_RETRY_COUNT,
  resetDeliveryForRetry,
} from "@/lib/queries/notificationDeliveries";
import { getNotificationEventById } from "@/lib/queries/notificationEvents";
import { dispatchNotification, type DispatchInput, type NotificationEventType } from "@/lib/services/notificationEngine";
import { notifLog } from "@/lib/services/notificationLogger";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const methodValidation = validateHttpMethod(request, ["POST"]);
  if (!methodValidation.isValidMethod) return methodValidation.response;

  const roleValidation = await validateApiRole(request, ADMIN_ONLY_ROLES);
  if (!roleValidation.isAuthorized) return roleValidation.response;

  const { id } = await params;
  const deliveryId = Number(id);
  if (isNaN(deliveryId)) {
    return NextResponse.json({ error: "ID de delivery inválido" }, { status: 400 });
  }

  try {
    const delivery = await getDeliveryById(deliveryId);

    if (!delivery) {
      return NextResponse.json({ error: "Delivery no encontrado" }, { status: 404 });
    }

    if (delivery.status !== "failed") {
      return NextResponse.json(
        { error: `Solo se pueden reintentar deliveries fallidos (estado actual: ${delivery.status})` },
        { status: 409 }
      );
    }

    if (delivery.retry_count >= MAX_RETRY_COUNT) {
      return NextResponse.json(
        { error: `Se alcanzó el límite máximo de reintentos (${MAX_RETRY_COUNT})` },
        { status: 422 }
      );
    }

    // Load the original event to reconstruct the dispatch input
    const event = await getNotificationEventById(delivery.event_id);
    if (!event) {
      return NextResponse.json({ error: "Evento de notificación no encontrado" }, { status: 404 });
    }

    // Reset the delivery to pending so it can be picked up by a fresh send
    await resetDeliveryForRetry(deliveryId);

    // Re-dispatch the original notification. dispatchNotification creates a new event
    // row but that is intentional for full audit trail of retries.
    const input = buildDispatchInput(event);
    if (!input) {
      return NextResponse.json(
        { error: `Tipo de evento '${event.event_type}' no soporta reintento automático` },
        { status: 422 }
      );
    }

    notifLog.info("retry", `Retrying delivery=${deliveryId} event_type=${event.event_type} attempt=${delivery.retry_count + 1}`);

    // Fire and forget — dispatchNotification is designed to not throw
    dispatchNotification(input).catch((err: unknown) => {
      const msg = err instanceof Error ? err.message : String(err);
      notifLog.error("retry", `Re-dispatch failed for delivery=${deliveryId}: ${msg}`);
    });

    return NextResponse.json({ ok: true, retrying: true, attempt: delivery.retry_count + 1 });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    notifLog.error("retry-route", `Unexpected error for delivery=${deliveryId}: ${msg}`);
    return NextResponse.json(
      { error: "Error al reintentar el envío" },
      { status: 500 }
    );
  }
}

// ---------------------------------------------------------------------------
// Reconstruct a DispatchInput from a stored notification_events row.
// Returns null for event types that cannot be automatically retried (because
// the original dynamic context — e.g. quote price — is not stored in the DB row).
// ---------------------------------------------------------------------------
function buildDispatchInput(event: {
  event_type: string;
  actor_user_id: number | null;
  project_id: number | null;
  task_id: number | null;
  adjustment_id: number | null;
  metadata: Record<string, unknown> | null;
}): DispatchInput | null {
  const actorUserId = event.actor_user_id ?? 0;
  const meta = event.metadata ?? {};

  switch (event.event_type as NotificationEventType) {
    case "task.assigned":
      if (!event.task_id || !event.project_id) return null;
      return { eventType: "task.assigned", actorUserId, taskId: event.task_id, projectId: event.project_id };

    case "task.reassigned":
      if (!event.task_id || !event.project_id) return null;
      return {
        eventType: "task.reassigned",
        actorUserId,
        taskId: event.task_id,
        projectId: event.project_id,
        previousUserId: Number(meta.previous_user_id ?? 0),
        newUserId: meta.new_user_id ? Number(meta.new_user_id) : null,
      };

    case "task.completed":
      if (!event.task_id || !event.project_id) return null;
      return { eventType: "task.completed", actorUserId, taskId: event.task_id, projectId: event.project_id };

    case "quote.requested":
      if (!event.task_id || !event.project_id || !meta.invitee_user_id) return null;
      return {
        eventType: "quote.requested",
        actorUserId,
        taskId: event.task_id,
        projectId: event.project_id,
        inviteeUserId: Number(meta.invitee_user_id),
      };

    case "quote.received":
      if (!event.task_id || !event.project_id) return null;
      return {
        eventType: "quote.received",
        actorUserId,
        taskId: event.task_id,
        projectId: event.project_id,
        price: Number(meta.price ?? 0),
        deliveryDays: Number(meta.delivery_days ?? 0),
        notes: meta.notes ? String(meta.notes) : null,
      };

    case "quote.accepted":
      if (!event.task_id || !event.project_id || !meta.quote_id) return null;
      return {
        eventType: "quote.accepted",
        actorUserId,
        taskId: event.task_id,
        projectId: event.project_id,
        quoteId: Number(meta.quote_id),
        metadata: meta,
      };

    case "project.adjustment.created":
      if (!event.project_id || !event.adjustment_id) return null;
      return {
        eventType: "project.adjustment.created",
        actorUserId,
        projectId: event.project_id,
        adjustmentId: event.adjustment_id,
        versionNumber: Number(meta.version_number ?? 2),
        notes: meta.notes ? String(meta.notes) : null,
        taskCount: meta.task_count ? Number(meta.task_count) : undefined,
      };

    case "project.completed":
      if (!event.project_id) return null;
      return { eventType: "project.completed", actorUserId, projectId: event.project_id };

    default:
      return null;
  }
}

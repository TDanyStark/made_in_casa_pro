// ---------------------------------------------------------------------------
// Helpers para resolver los destinatarios de notificaciones por evento.
// Cada función devuelve un array de {userId, email, name} de las personas
// que deben recibir el correo para ese evento.
// ---------------------------------------------------------------------------

import { db } from "../db";

export interface NotificationRecipient {
  userId: number;
  email: string;
  name: string;
}

// ── Proyecto ────────────────────────────────────────────────────────────────

/**
 * Devuelve el creador del proyecto + usuarios internos asignados como tareas.
 * Usado para: project.completed, project.adjustment.created
 */
export async function getProjectStakeholders(
  projectId: number,
  excludeUserId?: number | null
): Promise<NotificationRecipient[]> {
  const result = await db.execute({
    sql: `
      SELECT DISTINCT u.id AS "userId", u.email, u.name
      FROM users u
      WHERE u.id IN (
        -- creador del proyecto
        SELECT created_by FROM projects WHERE id = $1 AND created_by IS NOT NULL
        UNION
        -- usuarios asignados a tareas del proyecto (solo internos)
        SELECT pt.assigned_user_id FROM project_tasks pt
        WHERE pt.project_id = $1 AND pt.assigned_user_id IS NOT NULL
      )
      AND u.email IS NOT NULL
      AND u.is_active = 1
      ${excludeUserId != null ? "AND u.id != $2" : ""}
      ORDER BY u.name
    `,
    args: excludeUserId != null ? [projectId, excludeUserId] : [projectId],
  });
  return result.rows as unknown as NotificationRecipient[];
}

// ── Tarea ───────────────────────────────────────────────────────────────────

/**
 * Devuelve el usuario asignado a la tarea.
 * Usado para: task.assigned
 */
export async function getTaskAssignee(
  taskId: number
): Promise<NotificationRecipient | null> {
  const result = await db.execute({
    sql: `
      SELECT u.id AS "userId", u.email, u.name
      FROM project_tasks pt
      JOIN users u ON u.id = pt.assigned_user_id
      WHERE pt.id = $1
        AND pt.assigned_user_id IS NOT NULL
        AND u.email IS NOT NULL
        AND u.is_active = 1
    `,
    args: [taskId],
  });
  if (result.rows.length === 0) return null;
  return result.rows[0] as unknown as NotificationRecipient;
}

/**
 * Devuelve el creador del proyecto al que pertenece la tarea.
 * Usado para: task.completed (avisa al creador)
 */
export async function getTaskProjectCreator(
  taskId: number
): Promise<NotificationRecipient | null> {
  const result = await db.execute({
    sql: `
      SELECT u.id AS "userId", u.email, u.name
      FROM project_tasks pt
      JOIN projects p ON p.id = pt.project_id
      JOIN users u ON u.id = p.created_by
      WHERE pt.id = $1
        AND p.created_by IS NOT NULL
        AND u.email IS NOT NULL
        AND u.is_active = 1
    `,
    args: [taskId],
  });
  if (result.rows.length === 0) return null;
  return result.rows[0] as unknown as NotificationRecipient;
}

// ── Cotizaciones ────────────────────────────────────────────────────────────

/**
 * Devuelve el colaborador invitado a cotizar.
 * Usado para: quote.requested
 */
export async function getQuoteInvitee(
  taskId: number,
  userId: number
): Promise<NotificationRecipient | null> {
  const result = await db.execute({
    sql: `
      SELECT u.id AS "userId", u.email, u.name
      FROM users u
      WHERE u.id = $1
        AND u.email IS NOT NULL
        AND u.is_active = 1
        AND EXISTS (
          SELECT 1 FROM task_quote_invitations tqi
          WHERE tqi.task_id = $2 AND tqi.user_id = $1
        )
    `,
    args: [userId, taskId],
  });
  if (result.rows.length === 0) return null;
  return result.rows[0] as unknown as NotificationRecipient;
}

/**
 * Devuelve el creador del proyecto al que pertenece la tarea que recibió cotización.
 * Usado para: quote.received
 */
export async function getQuoteReceivedRecipient(
  taskId: number
): Promise<NotificationRecipient | null> {
  const result = await db.execute({
    sql: `
      SELECT u.id AS "userId", u.email, u.name
      FROM project_tasks pt
      JOIN projects p ON p.id = pt.project_id
      JOIN users u ON u.id = p.created_by
      WHERE pt.id = $1
        AND p.created_by IS NOT NULL
        AND u.email IS NOT NULL
        AND u.is_active = 1
    `,
    args: [taskId],
  });
  if (result.rows.length === 0) return null;
  return result.rows[0] as unknown as NotificationRecipient;
}

/**
 * Devuelve el colaborador cuya cotización fue aceptada.
 * Usado para: quote.accepted
 */
/**
 * Devuelve el nombre del usuario actor (quien dispara el evento).
 * Usado cuando no hay otro contexto disponible para obtener el nombre.
 */
export async function getActorName(userId: number): Promise<string> {
  const result = await db.execute({
    sql: `SELECT name FROM users WHERE id = $1`,
    args: [userId],
  });
  return (result.rows[0] as unknown as { name: string })?.name ?? "El equipo";
}

export async function getAcceptedQuoteCollaborator(
  quoteId: number
): Promise<NotificationRecipient | null> {
  const result = await db.execute({
    sql: `
      SELECT u.id AS "userId", u.email, u.name
      FROM task_quotes tq
      JOIN users u ON u.id = tq.user_id
      WHERE tq.id = $1
        AND u.email IS NOT NULL
        AND u.is_active = 1
    `,
    args: [quoteId],
  });
  if (result.rows.length === 0) return null;
  return result.rows[0] as unknown as NotificationRecipient;
}

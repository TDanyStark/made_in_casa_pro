import { db } from "../db";
import { revalidatePath } from "next/cache";
import { TaskQuoteType, TaskQuoteInvitationType } from "../definitions";
import { dhmToMinutes } from "../utils/time";
import { TaskRuleError } from "./projectTasks";

const QUOTE_NOT_FOUND = "Cotización no encontrada";
const TASK_CLOSED_FOR_QUOTES = "Esta tarea ya no recibe cotizaciones";

const OPEN_QUOTE_TASK_FILTER = `
  pt.requires_quote = 1
  AND pt.status = 'blocked'
  AND pt.assigned_user_id IS NULL
  AND NOT EXISTS (
    SELECT 1
    FROM task_quotes tq2
    WHERE tq2.task_id = pt.id
      AND tq2.status = 'accepted'
  )
`;

/**
 * Normalizes rich-text HTML input, converting empty/invalid HTML to null.
 * Handles outputs from Tiptap and similar rich-text editors.
 */
function normalizeHtmlContent(html: string | null | undefined): string | null {
  if (!html) return null;
  // Strip tags and check if empty after trimming
  const stripped = html.replace(/<[^>]*>/g, "").trim();
  return stripped.length > 0 ? html : null;
}

// ─── Invitations ──────────────────────────────────────────────────────────────

export async function getTaskQuoteInvitations(taskId: number): Promise<TaskQuoteInvitationType[]> {
  try {
    const result = await db.execute({
      sql: `
        SELECT
          tqi.id,
          tqi.task_id,
          tqi.user_id,
          u.name          AS user_name,
          tqi.invited_by,
          ib.name         AS invited_by_name,
          tqi.invited_at,
          tq.status       AS quote_status
        FROM task_quote_invitations tqi
        JOIN users u  ON tqi.user_id    = u.id
        LEFT JOIN users ib ON tqi.invited_by = ib.id
        LEFT JOIN task_quotes tq ON tq.task_id = tqi.task_id AND tq.user_id = tqi.user_id
        WHERE tqi.task_id = $1
        ORDER BY tqi.invited_at ASC
      `,
      args: [taskId],
    });
    return result.rows as unknown as TaskQuoteInvitationType[];
  } catch (error) {
    console.error("Error fetching task quote invitations:", error);
    return [];
  }
}

export async function inviteExternalToQuote(
  taskId: number,
  userId: number,
  invitedBy: number
): Promise<void> {
  try {
    await db.execute({
      sql: `
        INSERT INTO task_quote_invitations (task_id, user_id, invited_by)
        VALUES ($1, $2, $3)
        ON CONFLICT (task_id, user_id) DO NOTHING
      `,
      args: [taskId, userId, invitedBy],
    });
  } catch (error) {
    console.error("Error inviting external to quote:", error);
    throw error;
  }
}

export async function removeQuoteInvitation(taskId: number, userId: number): Promise<void> {
  try {
    await db.execute({
      sql: `DELETE FROM task_quote_invitations WHERE task_id = $1 AND user_id = $2`,
      args: [taskId, userId],
    });
  } catch (error) {
    console.error("Error removing quote invitation:", error);
    throw error;
  }
}

// ─── Quotes ───────────────────────────────────────────────────────────────────

export async function getTaskQuotes(taskId: number): Promise<TaskQuoteType[]> {
  try {
    const result = await db.execute({
      sql: `
        SELECT
          tq.id,
          tq.task_id,
          pt.title        AS task_title,
          pt.project_id,
          tq.user_id,
          u.name          AS user_name,
          tq.price,
          tq.delivery_days,
          tq.delivery_hours,
          tq.delivery_minutes,
          tq.notes,
          tq.status,
          tq.created_at,
          tq.updated_at
        FROM task_quotes tq
        JOIN users u         ON tq.user_id = u.id
        JOIN project_tasks pt ON tq.task_id = pt.id
        WHERE tq.task_id = $1
        ORDER BY tq.created_at ASC
      `,
      args: [taskId],
    });
    return result.rows as unknown as TaskQuoteType[];
  } catch (error) {
    console.error("Error fetching task quotes:", error);
    return [];
  }
}

/**
 * Returns all quotes for tasks that are pending and visible to a user.
 * Used for the external collaborator's "My Quotes" view.
 */
export async function getMyQuotes(userId: number): Promise<TaskQuoteType[]> {
  try {
    const result = await db.execute({
      sql: `
        SELECT
          tq.id,
          tq.task_id,
          pt.title        AS task_title,
          pt.project_id,
          tq.user_id,
          u.name          AS user_name,
          tq.price,
          tq.delivery_days,
          tq.delivery_hours,
          tq.delivery_minutes,
          tq.notes,
          tq.status,
          tq.created_at,
          tq.updated_at
        FROM task_quotes tq
        JOIN users u          ON tq.user_id  = u.id
        JOIN project_tasks pt  ON tq.task_id  = pt.id
        WHERE tq.user_id = $1
        ORDER BY tq.updated_at DESC
      `,
      args: [userId],
    });
    return result.rows as unknown as TaskQuoteType[];
  } catch (error) {
    console.error("Error fetching my quotes:", error);
    return [];
  }
}

/**
 * Returns all pending quote invitations for a user (tasks they haven't quoted yet).
 * Used for external collaborator dashboard.
 * Excludes invitations where the user has already submitted a quote.
 */
export async function getPendingQuoteInvitations(userId: number): Promise<TaskQuoteInvitationType[]> {
  try {
    const result = await db.execute({
      sql: `
        SELECT
          tqi.id,
          tqi.task_id,
          pt.title        AS task_title,
          pt.project_id,
          p.title         AS project_name,
          tqi.user_id,
          u.name          AS user_name,
          tqi.invited_by,
          ib.name         AS invited_by_name,
          tqi.invited_at,
          tq.status       AS quote_status
        FROM task_quote_invitations tqi
        JOIN users u   ON tqi.user_id    = u.id
        JOIN project_tasks pt ON tqi.task_id = pt.id
        JOIN projects p ON pt.project_id = p.id
        LEFT JOIN users ib  ON tqi.invited_by = ib.id
        LEFT JOIN task_quotes tq ON tq.task_id = tqi.task_id AND tq.user_id = tqi.user_id
        WHERE tqi.user_id = $1
          AND tq.id IS NULL
          AND ${OPEN_QUOTE_TASK_FILTER}
        ORDER BY tqi.invited_at DESC
      `,
      args: [userId],
    });
    return result.rows as unknown as TaskQuoteInvitationType[];
  } catch (error) {
    console.error("Error fetching pending quote invitations:", error);
    return [];
  }
}

/**
 * Returns the count of pending quote invitations for a user (tasks they haven't quoted yet).
 * Used for sidebar notification badge.
 */
export async function getPendingQuoteInvitationsCount(userId: number): Promise<number> {
  try {
    const result = await db.execute({
      sql: `
        SELECT COUNT(*) AS count
        FROM task_quote_invitations tqi
        JOIN project_tasks pt ON tqi.task_id = pt.id
        LEFT JOIN task_quotes tq ON tq.task_id = tqi.task_id AND tq.user_id = tqi.user_id
        WHERE tqi.user_id = $1
          AND tq.id IS NULL
          AND ${OPEN_QUOTE_TASK_FILTER}
      `,
      args: [userId],
    });
    const row = result.rows[0] as unknown as { count: number };
    return Number(row?.count ?? 0);
  } catch (error) {
    console.error("Error fetching pending quote invitations count:", error);
    return 0;
  }
}

/**
 * Submit a quote for a task. Only allowed if the user is invited and the task
 * still accepts quotes (blocked, unassigned, no accepted quote). The task row is
 * locked like acceptQuote does, so a submission never races an acceptance and
 * an accepted quote is never turned back into a pending one.
 */
export async function submitQuote(data: {
  task_id: number;
  user_id: number;
  price?: number | null;
  delivery_days?: number | null;
  delivery_hours?: number | null;
  delivery_minutes?: number | null;
  notes?: string | null;
}): Promise<TaskQuoteType> {
  const totalMinutes = dhmToMinutes({
    days: data.delivery_days || 0,
    hours: data.delivery_hours || 0,
    minutes: data.delivery_minutes || 0,
  });

  // Normalize HTML notes content
  const normalizedNotes = normalizeHtmlContent(data.notes ?? null);

  let id: number;
  const transaction = await db.transaction("write");
  try {
    // Verify invitation
    const invCheck = await transaction.execute({
      sql: `SELECT id FROM task_quote_invitations WHERE task_id = $1 AND user_id = $2`,
      args: [data.task_id, data.user_id],
    });
    if (invCheck.rows.length === 0) {
      throw new Error("No tienes invitación para cotizar esta tarea");
    }

    const openTask = await transaction.execute({
      sql: `SELECT pt.id FROM project_tasks pt
            WHERE pt.id = $1 AND ${OPEN_QUOTE_TASK_FILTER}
            FOR UPDATE`,
      args: [data.task_id],
    });
    if (openTask.rows.length === 0) {
      throw new TaskRuleError(TASK_CLOSED_FOR_QUOTES, 409);
    }

    const result = await transaction.execute({
      sql: `
        INSERT INTO task_quotes (task_id, user_id, price, delivery_days, delivery_hours, delivery_minutes, notes, status)
        VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending')
        ON CONFLICT (task_id, user_id) DO UPDATE SET
          price           = EXCLUDED.price,
          delivery_days   = EXCLUDED.delivery_days,
          delivery_hours  = EXCLUDED.delivery_hours,
          delivery_minutes = EXCLUDED.delivery_minutes,
          notes           = EXCLUDED.notes,
          status          = 'pending',
          updated_at      = CURRENT_TIMESTAMP
        WHERE task_quotes.status <> 'accepted'
        RETURNING id
      `,
      args: [
        data.task_id,
        data.user_id,
        data.price ?? null,
        data.delivery_days ?? null,
        data.delivery_hours ?? null,
        totalMinutes,
        normalizedNotes,
      ],
    });
    if (result.rows.length === 0) {
      throw new TaskRuleError(TASK_CLOSED_FOR_QUOTES, 409);
    }
    id = Number(result.rows[0]?.id);

    await transaction.commit();
  } catch (error) {
    await transaction.rollback();
    console.error("Error submitting quote:", error);
    throw error;
  }

  const quotes = await getTaskQuotes(data.task_id);
  const quote = quotes.find((q) => q.id === id);
  return quote!;
}

/**
 * Accept a quote: assigns the user to the task and activates it ('not_started').
 * Rejects all other quotes for the same task.
 *
 * Everything is read inside the transaction with the task row locked (task
 * before quotes, same order as submitQuote). Only a pending quote of `scope`'s
 * task can be accepted, and only while that task is blocked, unassigned and
 * without an accepted quote. Throws TaskRuleError 404 (missing / other task or
 * project) or 409 (state no longer allows it).
 */
export async function acceptQuote(
  quoteId: number,
  acceptedBy: number,
  scope: { projectId: number; taskId: number }
): Promise<void> {
  const transaction = await db.transaction("write");
  let projectId: number;
  try {
    const quoteResult = await transaction.execute({
      sql: `SELECT id, task_id, user_id FROM task_quotes WHERE id = $1`,
      args: [quoteId],
    });
    const quote = quoteResult.rows[0] as unknown as { id: number; task_id: number; user_id: number } | undefined;
    if (!quote || Number(quote.task_id) !== scope.taskId) {
      throw new TaskRuleError(QUOTE_NOT_FOUND, 404);
    }

    const taskResult = await transaction.execute({
      sql: `SELECT id, project_id, status, task_flag, assigned_user_id FROM project_tasks WHERE id = $1 FOR UPDATE`,
      args: [quote.task_id],
    });
    const task = taskResult.rows[0] as unknown as
      | { id: number; project_id: number; status: string; task_flag: string; assigned_user_id: number | null }
      | undefined;
    if (!task || Number(task.project_id) !== scope.projectId) {
      throw new TaskRuleError("Tarea no encontrada", 404);
    }
    projectId = Number(task.project_id);

    const quotesResult = await transaction.execute({
      sql: `SELECT id, status FROM task_quotes WHERE task_id = $1 FOR UPDATE`,
      args: [quote.task_id],
    });
    const taskQuotes = quotesResult.rows as unknown as Array<{ id: number; status: string }>;
    const current = taskQuotes.find((q) => Number(q.id) === quoteId);
    if (current?.status !== "pending") {
      throw new TaskRuleError("La cotización ya no está pendiente", 409);
    }
    if (taskQuotes.some((q) => q.status === "accepted")) {
      throw new TaskRuleError("La tarea ya tiene una cotización aceptada", 409);
    }
    if (task.status !== "blocked" || task.assigned_user_id) {
      throw new TaskRuleError("La tarea ya no está esperando cotización", 409);
    }

    // 1. Accept this quote
    await transaction.execute({
      sql: `UPDATE task_quotes SET status = 'accepted', updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
      args: [quoteId],
    });

    // 2. Reject all other quotes for this task
    await transaction.execute({
      sql: `UPDATE task_quotes SET status = 'rejected', updated_at = CURRENT_TIMESTAMP WHERE task_id = $1 AND id != $2`,
      args: [quote.task_id, quoteId],
    });

    // 3. Assign user to task and activate it
    await transaction.execute({
      sql: `
        UPDATE project_tasks
        SET assigned_user_id = $1, status = 'not_started', updated_at = CURRENT_TIMESTAMP, assigned_at = CURRENT_TIMESTAMP
        WHERE id = $2
      `,
      args: [quote.user_id, quote.task_id],
    });

    // 4. Log transition
    await transaction.execute({
      sql: `
        INSERT INTO task_transitions (task_id, project_id, from_status, to_status, from_flag, to_flag, moved_by, notes)
        VALUES ($1, $2, $3, 'not_started', $4, $4, $5, 'Cotización aceptada, colaborador externo asignado')
      `,
      args: [quote.task_id, task.project_id, task.status, task.task_flag, acceptedBy],
    });

    await transaction.commit();
  } catch (error) {
    await transaction.rollback();
    console.error("Error accepting quote:", error);
    throw error;
  }
  revalidatePath(`/projects/${projectId}`);
}

/**
 * Reject a specific quote (without accepting another). The quote must belong to
 * `scope`'s task and project, otherwise TaskRuleError 404.
 */
export async function rejectQuote(
  quoteId: number,
  scope: { projectId: number; taskId: number }
): Promise<void> {
  try {
    const found = await db.execute({
      sql: `SELECT tq.id FROM task_quotes tq
            JOIN project_tasks pt ON pt.id = tq.task_id
            WHERE tq.id = $1 AND tq.task_id = $2 AND pt.project_id = $3`,
      args: [quoteId, scope.taskId, scope.projectId],
    });
    if (found.rows.length === 0) throw new TaskRuleError(QUOTE_NOT_FOUND, 404);

    await db.execute({
      sql: `UPDATE task_quotes SET status = 'rejected', updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
      args: [quoteId],
    });
  } catch (error) {
    console.error("Error rejecting quote:", error);
    throw error;
  }
  revalidatePath(`/projects/${scope.projectId}`);
}

/**
 * Returns all quotes submitted by a user for tasks in a specific project.
 */
export async function getTaskQuotesForCollaborator(projectId: number, userId: number): Promise<TaskQuoteType[]> {
  try {
    const result = await db.execute({
      sql: `
        SELECT
          tq.id,
          tq.task_id,
          pt.title        AS task_title,
          pt.project_id,
          tq.user_id,
          u.name          AS user_name,
          tq.price,
          tq.delivery_days,
          tq.delivery_hours,
          tq.delivery_minutes,
          tq.notes,
          tq.status,
          tq.created_at,
          tq.updated_at
        FROM task_quotes tq
        JOIN users u         ON tq.user_id = u.id
        JOIN project_tasks pt ON tq.task_id = pt.id
        WHERE pt.project_id = $1 AND tq.user_id = $2
        ORDER BY tq.created_at ASC
      `,
      args: [projectId, userId],
    });
    return result.rows as unknown as TaskQuoteType[];
  } catch (error) {
    console.error("Error fetching collaborator quotes for project:", error);
    return [];
  }
}

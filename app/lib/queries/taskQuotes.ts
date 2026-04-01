import { db } from "../db";
import { revalidatePath } from "next/cache";
import { TaskQuoteType, TaskQuoteInvitationType } from "../definitions";
import { dhmToMinutes } from "../utils/time";

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
 * Submit a quote for a task. Only allowed if the user is invited.
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
  try {
    // Verify invitation
    const invCheck = await db.execute({
      sql: `SELECT id FROM task_quote_invitations WHERE task_id = $1 AND user_id = $2`,
      args: [data.task_id, data.user_id],
    });
    if (invCheck.rows.length === 0) {
      throw new Error("No tienes invitación para cotizar esta tarea");
    }

    const totalMinutes = dhmToMinutes({
      days: data.delivery_days || 0,
      hours: data.delivery_hours || 0,
      minutes: data.delivery_minutes || 0,
    });

    const result = await db.execute({
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
        RETURNING id
      `,
      args: [
        data.task_id,
        data.user_id,
        data.price ?? null,
        data.delivery_days ?? null,
        data.delivery_hours ?? null,
        totalMinutes,
        data.notes ?? null,
      ],
    });

    const id = Number(result.rows[0]?.id);
    const quotes = await getTaskQuotes(data.task_id);
    const quote = quotes.find((q) => q.id === id);
    return quote!;
  } catch (error) {
    console.error("Error submitting quote:", error);
    throw error;
  }
}

/**
 * Accept a quote: assigns the user to the task and activates it (in_progress).
 * Rejects all other quotes for the same task.
 */
export async function acceptQuote(
  quoteId: number,
  acceptedBy: number
): Promise<void> {
  const quoteResult = await db.execute({
    sql: `SELECT id, task_id, user_id FROM task_quotes WHERE id = $1`,
    args: [quoteId],
  });
  if (quoteResult.rows.length === 0) throw new Error("Cotización no encontrada");

  const quote = quoteResult.rows[0] as unknown as { id: number; task_id: number; user_id: number };

  // Get current task for project_id and status
  const taskResult = await db.execute({
    sql: `SELECT id, project_id, status, task_flag FROM project_tasks WHERE id = $1`,
    args: [quote.task_id],
  });
  const task = taskResult.rows[0] as unknown as { id: number; project_id: number; status: string; task_flag: string };

  const transaction = await db.transaction("write");
  try {
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
        SET assigned_user_id = $1, status = 'in_progress', updated_at = CURRENT_TIMESTAMP
        WHERE id = $2
      `,
      args: [quote.user_id, quote.task_id],
    });

    // 4. Log transition
    await transaction.execute({
      sql: `
        INSERT INTO task_transitions (task_id, project_id, from_status, to_status, from_flag, to_flag, moved_by, notes)
        VALUES ($1, $2, $3, 'in_progress', $4, $4, $5, 'Cotización aceptada, colaborador externo asignado')
      `,
      args: [quote.task_id, task.project_id, task.status, task.task_flag, acceptedBy],
    });

    await transaction.commit();
    revalidatePath(`/projects/${task.project_id}`);
  } catch (error) {
    await transaction.rollback();
    console.error("Error accepting quote:", error);
    throw error;
  }
}

/**
 * Reject a specific quote (without accepting another).
 */
export async function rejectQuote(quoteId: number): Promise<void> {
  try {
    await db.execute({
      sql: `UPDATE task_quotes SET status = 'rejected', updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
      args: [quoteId],
    });
  } catch (error) {
    console.error("Error rejecting quote:", error);
    throw error;
  }
}

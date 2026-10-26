import { db } from "@/lib/db";
import { UserRole } from "@/lib/definitions";
import type { SessionData } from "@/lib/session";

export type SessionUserState = {
  is_active: boolean;
  rol_id: UserRole;
};

/**
 * Lee de la BD el estado actual del usuario de la sesión.
 *
 * El JWT dura 7 días: un usuario desactivado o con el rol cambiado seguiría
 * entrando con los datos viejos del token. `validateApiRole` usa esta función
 * en cada llamada para que `is_active` y `rol_id` salgan siempre de la BD.
 *
 * @returns null si el usuario ya no existe.
 */
export async function getSessionUserState(
  session: Pick<SessionData, "id" | "rol_id">
): Promise<SessionUserState | null> {
  const result = await db.execute({
    sql: `SELECT is_active, rol_id FROM users WHERE id = $1`,
    args: [session.id],
  });
  const row = result.rows[0];
  if (!row) return null;
  return {
    is_active: Boolean(row.is_active),
    rol_id: Number(row.rol_id) as UserRole,
  };
}

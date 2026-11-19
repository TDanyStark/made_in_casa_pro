import { NextResponse } from "next/server";
import { z } from "zod";
import { cookies } from "next/headers";
import { decrypt } from "@/lib/session";
import { userCanAccessProject } from "@/lib/queries/projects";
import { UserRole } from "@/lib/definitions";
import { INVALID_COP_AMOUNT_MESSAGE, parseCopAmount } from "@/lib/utils/cop-amount";

// Spec: odd/tasks/project-costs.md — S2, S5, S6. Shared by the cost routes.

export const COST_AMOUNT_POSITIVE_MESSAGE = "El monto debe ser mayor que 0";
export const INVALID_BODY_MESSAGE = "Datos inválidos";
const MAX_AMOUNT = 1_000_000_000_000; // NUMERIC(14,2)

/** Id of the session user (creator/editor of the cost), or null. */
export async function getSessionUserId(): Promise<number | null> {
  const cookie = (await cookies()).get("session")?.value;
  const session = cookie ? await decrypt(cookie) : null;
  return session?.id ?? null;
}

/**
 * Comerciales solo acceden a proyectos que crearon; el resto de roles permitidos, a todos.
 * Misma regla que /api/projects/[id]/financials (precio de venta).
 */
export async function forbidUnlessAllowed(projectId: number, userRole: UserRole) {
  if (userRole !== UserRole.COMERCIAL) return null;
  const userId = await getSessionUserId();
  const allowed = userId ? await userCanAccessProject(projectId, userId, userRole) : false;
  return allowed
    ? null
    : NextResponse.json({ error: "No tienes acceso a este proyecto" }, { status: 403 });
}

export function parsePositiveId(id: string) {
  const value = Number(id);
  return /^[1-9]\d*$/.test(id) && Number.isSafeInteger(value) ? value : null;
}

const positiveId = (message: string) =>
  z.number({ required_error: message, invalid_type_error: message }).int(message).positive(message);

/** Number or COP string ("1.500.000"), > 0 and within NUMERIC(14,2). */
const amountSchema = z
  .union([z.number(), z.string()], {
    errorMap: () => ({ message: INVALID_COP_AMOUNT_MESSAGE }),
  })
  .transform((value, ctx) => {
    const amount = typeof value === "number" ? value : parseCopAmount(value);
    if (amount === null || amount === undefined || !Number.isFinite(amount) || amount >= MAX_AMOUNT) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: INVALID_COP_AMOUNT_MESSAGE });
      return z.NEVER;
    }
    if (amount <= 0) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: COST_AMOUNT_POSITIVE_MESSAGE });
      return z.NEVER;
    }
    return Math.round(amount * 100) / 100;
  });

/** YYYY-MM-DD of an existing calendar day. */
const dateSchema = z
  .string({ invalid_type_error: "Fecha inválida" })
  .refine((value) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const date = new Date(`${value}T00:00:00Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
  }, "Fecha inválida");

const descriptionSchema = z
  .string({ invalid_type_error: "Descripción inválida" })
  .trim()
  .max(2000, "La descripción es demasiado larga")
  .transform((value) => (value === "" ? null : value))
  .nullable();

const fields = {
  category_id: positiveId("Selecciona una categoría"),
  amount: amountSchema,
  description: descriptionSchema.optional(),
  incurred_at: dateSchema.nullable().optional(),
  task_id: positiveId("Tarea inválida").nullable().optional(),
};

export const createCostSchema = z.object({
  ...fields,
  adjustment_id: positiveId("Versión inválida").nullable().optional(),
});

export const updateCostSchema = z
  .object({
    ...fields,
    category_id: fields.category_id.optional(),
    amount: amountSchema.optional(),
    incurred_at: dateSchema.optional(),
    adjustment_id: positiveId("Versión inválida").optional(),
  })
  .refine((data) => Object.values(data).some((v) => v !== undefined), "No hay cambios para guardar");

/** Parses the JSON body with the schema; returns the data or a 400 response with the first error. */
export async function parseBody<T extends z.ZodTypeAny>(
  request: Request,
  schema: T
): Promise<{ data: z.output<T> } | { response: NextResponse }> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return { response: NextResponse.json({ error: INVALID_BODY_MESSAGE }, { status: 400 }) };
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    // A body that is not an object (null, array, number) is not a field error.
    const message =
      !issue || (issue.code === z.ZodIssueCode.invalid_type && issue.path.length === 0)
        ? INVALID_BODY_MESSAGE
        : issue.message;
    return { response: NextResponse.json({ error: message }, { status: 400 }) };
  }
  return { data: parsed.data };
}

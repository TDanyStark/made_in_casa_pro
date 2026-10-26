import { NextResponse } from "next/server";
import { z } from "zod";
import { ITEMS_PER_PAGE } from "@/config/constants";

/** Default upper bound for `limit` on list endpoints. */
export const MAX_PAGE_LIMIT = 100;

export const PAGINATION_ERROR = "Parámetros de paginación inválidos";

export type PaginationResult =
  | { success: true; page: number; limit: number }
  | { success: false; response: NextResponse };

/**
 * Validates `page` and `limit` query params for paginated list endpoints.
 *
 * - page: integer >= 1, default 1
 * - limit: integer between 1 and `maxLimit` (default MAX_PAGE_LIMIT), default ITEMS_PER_PAGE
 * - empty values are treated as missing
 *
 * On invalid input returns a ready 400 `{ error }` response so the handler can
 * return it before touching the database.
 */
export function parsePagination(
  searchParams: URLSearchParams,
  options?: { maxLimit?: number }
): PaginationResult {
  const maxLimit = options?.maxLimit ?? MAX_PAGE_LIMIT;
  const schema = z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(maxLimit).default(ITEMS_PER_PAGE),
  });

  const parsed = schema.safeParse({
    page: searchParams.get("page") || undefined,
    limit: searchParams.get("limit") || undefined,
  });

  if (!parsed.success) {
    return {
      success: false,
      response: NextResponse.json({ error: PAGINATION_ERROR }, { status: 400 }),
    };
  }

  return { success: true, page: parsed.data.page, limit: parsed.data.limit };
}

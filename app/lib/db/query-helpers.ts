/**
 * Shared SQL query building helpers.
 * Reusable by any module (products, projects, tasks, etc.)
 */

/**
 * Parses a COUNT(*) result row to a number.
 */
export function parseTotal(rows: Record<string, unknown>[]): number {
  return Number(rows[0]?.count ?? 0);
}

/**
 * Builds WHERE clause + args array from a list of conditions.
 * Each condition is { sql: string, value: unknown } and is only included if value is defined.
 *
 * Returns { whereSQL, args } where whereSQL is "" or " WHERE cond1 AND cond2 ..."
 * and args is the accumulated args array with $1, $2, ... placeholders.
 *
 * Example:
 *   const { whereSQL, args } = buildWhereClause([
 *     { sql: 'name ILIKE $', value: search ? `%${search}%` : undefined },
 *     { sql: 'category_id = $', value: categoryId },
 *   ]);
 *   // whereSQL = " WHERE name ILIKE $1 AND category_id = $2"
 *   // args     = ['%foo%', 3]
 */
export function buildWhereClause(
  conditions: Array<{ sql: string; value: unknown }>
): { whereSQL: string; args: unknown[] } {
  const args: unknown[] = [];
  const clauses: string[] = [];

  for (const cond of conditions) {
    if (cond.value === undefined || cond.value === null) continue;
    args.push(cond.value);
    clauses.push(cond.sql.replace('$', `$${args.length}`));
  }

  const whereSQL = clauses.length > 0 ? ' WHERE ' + clauses.join(' AND ') : '';
  return { whereSQL, args };
}

/**
 * Appends LIMIT and OFFSET placeholders to an existing args array.
 * Returns the placeholders as strings so the caller can append them to the SQL.
 *
 * Example:
 *   const { limitPH, offsetPH, paginationArgs } = buildPaginationArgs(args, page, limit);
 *   sql += ` ORDER BY name ASC LIMIT ${limitPH} OFFSET ${offsetPH}`;
 *   const finalArgs = [...args, ...paginationArgs];
 */
export function buildPaginationArgs(
  existingArgs: unknown[],
  page: number,
  limit: number
): { limitPH: string; offsetPH: string; paginationArgs: [number, number] } {
  const offset = (page - 1) * limit;
  const limitPH = `$${existingArgs.length + 1}`;
  const offsetPH = `$${existingArgs.length + 2}`;
  return { limitPH, offsetPH, paginationArgs: [limit, offset] };
}

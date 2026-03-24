import { Pool, neonConfig } from "@neondatabase/serverless";
import type { DbAdapter, DbResult, DbTransaction } from "./types";

// In Node.js environments (local dev / non-edge), WebSocket is not available
// globally before Node 22. Install `ws` as a dependency if you see WebSocket
// errors: `pnpm add ws` and `pnpm add -D @types/ws`
if (typeof globalThis.WebSocket === "undefined") {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    neonConfig.webSocketConstructor = require("ws");
  } catch {
    // ws not installed — will work fine on Vercel/edge where WebSocket is native
  }
}

/**
 * Converts a libSQL-style query ({ sql, args } with ? placeholders) into a
 * pg-compatible query ({ text, values } with $1, $2, … placeholders).
 *
 * Also auto-appends `RETURNING id` to INSERT statements so that
 * `result.lastInsertRowid` works like it did with libSQL/SQLite.
 */
function convertQuery(
  query: string | { sql: string; args?: unknown[] }
): { text: string; values: unknown[] } {
  const rawSql = typeof query === "string" ? query : query.sql;
  const args = typeof query === "string" ? [] : (query.args ?? []);

  // Replace ? positional params with $1, $2, …
  let idx = 0;
  let text = rawSql.replace(/\?/g, () => `$${++idx}`);

  // Auto-add RETURNING id to INSERT statements so lastInsertRowid is populated
  const trimmed = text.trimEnd();
  if (/^\s*INSERT\s/i.test(trimmed) && !/RETURNING/i.test(trimmed)) {
    text = trimmed + " RETURNING id";
  }

  return { text, values: args };
}

export class NeonAdapter implements DbAdapter {
  private pool: Pool;

  constructor(connectionString: string) {
    this.pool = new Pool({ connectionString });
  }

  async execute(
    query: string | { sql: string; args?: unknown[] }
  ): Promise<DbResult> {
    const { text, values } = convertQuery(query);
    const result = await this.pool.query(text, values as unknown[]);
    return {
      rows: result.rows,
      lastInsertRowid: (result.rows[0]?.id as number | bigint) ?? undefined,
    };
  }

  async transaction(_mode?: "read" | "write"): Promise<DbTransaction> {
    const client = await this.pool.connect();
    await client.query("BEGIN");

    return {
      async execute(
        query: string | { sql: string; args?: unknown[] }
      ): Promise<DbResult> {
        const { text, values } = convertQuery(query);
        const result = await client.query(text, values as unknown[]);
        return {
          rows: result.rows,
          lastInsertRowid:
            (result.rows[0]?.id as number | bigint) ?? undefined,
        };
      },
      async commit() {
        await client.query("COMMIT");
        client.release();
      },
      async rollback() {
        await client.query("ROLLBACK");
        client.release();
      },
    };
  }
}

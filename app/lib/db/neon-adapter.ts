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

export class NeonAdapter implements DbAdapter {
  private pool: Pool;

  constructor(connectionString: string) {
    this.pool = new Pool({ connectionString });
  }

  async execute(
    query: string | { sql: string; args?: unknown[] }
  ): Promise<DbResult> {
    const sql = typeof query === "string" ? query : query.sql;
    const args = typeof query === "string" ? [] : (query.args ?? []);
    const result = await this.pool.query(sql, args as unknown[]);
    return {
      rows: result.rows,
      lastInsertRowid: (result.rows[0]?.id as number | bigint) ?? undefined,
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async transaction(_mode?: "read" | "write"): Promise<DbTransaction> {
    const client = await this.pool.connect();
    await client.query("BEGIN");

    return {
      async execute(
        query: string | { sql: string; args?: unknown[] }
      ): Promise<DbResult> {
        const sql = typeof query === "string" ? query : query.sql;
        const args = typeof query === "string" ? [] : (query.args ?? []);
        const result = await client.query(sql, args as unknown[]);
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

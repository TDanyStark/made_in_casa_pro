import { Pool } from "pg";
import type { DbAdapter, DbResult, DbTransaction } from "./types";

/**
 * PostgreSQL adapter for local development.
 * In production, use NeonAdapter instead.
 *
 * Requires: npm install pg
 */
export class PostgresAdapter implements DbAdapter {
  private pool: Pool;

  constructor(connectionString: string) {
    this.pool = new Pool({ connectionString });
  }

  async execute(
    query: string | { sql: string; args?: unknown[] }
  ): Promise<DbResult> {
    const sql = typeof query === "string" ? query : query.sql;
    const args = typeof query === "string" ? [] : query.args ?? [];

    const result = await this.pool.query(sql, args);

    return {
      rows: result.rows as DbResult["rows"],
      lastInsertRowid: (result.rows[0]?.id as number | bigint) ?? undefined,
    };
  }

  async transaction(mode?: "read" | "write"): Promise<DbTransaction> {
    const client = await this.pool.connect();

    try {
      if (mode === "read") {
        await client.query("BEGIN READ ONLY");
      } else {
        await client.query("BEGIN");
      }

      const transaction: DbTransaction = {
        async execute(
          query: string | { sql: string; args?: unknown[] }
        ): Promise<DbResult> {
          const sql = typeof query === "string" ? query : query.sql;
          const args = typeof query === "string" ? [] : query.args ?? [];

          const result = await client.query(sql, args);

          return {
            rows: result.rows as DbResult["rows"],
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

      return transaction;
    } catch (error) {
      client.release();
      throw error;
    }
  }
}

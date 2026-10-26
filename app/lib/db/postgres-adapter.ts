import { Pool } from "pg";
import type { DbAdapter, DbResult, DbTransaction } from "./types";

/**
 * PostgreSQL adapter for local development.
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

      // The connection goes back to the pool exactly once. Once the transaction
      // finished (committed, rolled back, or failed while doing so), a later
      // commit/rollback is a no-op, so a catch block that rolls back after a
      // successful commit cannot release the connection twice.
      let finished = false;
      const finish = async (statement: "COMMIT" | "ROLLBACK") => {
        if (finished) return;
        finished = true;
        try {
          await client.query(statement);
        } finally {
          client.release();
        }
      };

      const transaction: DbTransaction = {
        async execute(
          query: string | { sql: string; args?: unknown[] }
        ): Promise<DbResult> {
          const sql = typeof query === "string" ? query : query.sql;
          const args = typeof query === "string" ? [] : query.args ?? [];

          const result = await client.query(sql, args);

          return {
            rows: result.rows as DbResult["rows"],
          };
        },
        async commit() {
          await finish("COMMIT");
        },
        async rollback() {
          await finish("ROLLBACK");
        },
      };

      return transaction;
    } catch (error) {
      client.release();
      throw error;
    }
  }
}

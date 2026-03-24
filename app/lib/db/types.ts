export interface DbRow {
  [key: string]: unknown;
}

export interface DbResult {
  rows: DbRow[];
  lastInsertRowid?: number | bigint;
}

export interface DbTransaction {
  execute(query: string | { sql: string; args?: unknown[] }): Promise<DbResult>;
  commit(): Promise<void>;
  rollback(): Promise<void>;
}

export interface DbAdapter {
  execute(query: string | { sql: string; args?: unknown[] }): Promise<DbResult>;
  transaction(mode?: "read" | "write"): Promise<DbTransaction>;
}

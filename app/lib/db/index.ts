import type { DbAdapter } from "./types";
import { PostgresAdapter } from "./postgres-adapter";

// ---------------------------------------------------------------------------
// Single PostgreSQL provider for all environments.
//
// Resolution order:
// - Development: DATABASE_LOCAL_URL, then DATABASE_URL
// - Production: DATABASE_URL
// ---------------------------------------------------------------------------

const connectionString =
  process.env.NODE_ENV === "production"
    ? process.env.DATABASE_URL
    : process.env.DATABASE_LOCAL_URL ||
      process.env.DATABASE_URL ||
      "postgresql://localhost/made_in_casa";

if (!connectionString) {
  throw new Error(
    "Database URL is required. Use DATABASE_LOCAL_URL (local) or DATABASE_URL (production)."
  );
}

const db: DbAdapter = new PostgresAdapter(connectionString);

export { db };

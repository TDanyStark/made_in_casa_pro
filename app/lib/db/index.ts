import type { DbAdapter } from "./types";
import { NeonAdapter } from "./neon-adapter";
import { PostgresAdapter } from "./postgres-adapter";

// ---------------------------------------------------------------------------
// Database provider selection based on environment:
// - Development (NODE_ENV !== 'production'): Uses PostgreSQL locally
// - Production: Uses Neon
//
// For local development, requires DATABASE_LOCAL_URL pointing to PostgreSQL
// For production, requires DATABASE_URL pointing to Neon
// ---------------------------------------------------------------------------

let db: DbAdapter;

if (process.env.NODE_ENV === "production") {
  if (!process.env.DATABASE_URL) {
    throw new Error(
      "DATABASE_URL environment variable is required in production."
    );
  }
  db = new NeonAdapter(process.env.DATABASE_URL);
} else {
  // Development: use local PostgreSQL
  const localUrl =
    process.env.DATABASE_LOCAL_URL || "postgresql://localhost/made_in_casa";
  db = new PostgresAdapter(localUrl);
}

export { db };

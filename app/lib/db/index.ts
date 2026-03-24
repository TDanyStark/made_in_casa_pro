import type { DbAdapter } from "./types";
import { NeonAdapter } from "./neon-adapter";

// ---------------------------------------------------------------------------
// To swap the database provider, replace NeonAdapter with any class that
// implements the DbAdapter interface (see types.ts).
//
// Example for a future migration to another provider:
//   import { PlanetScaleAdapter } from "./planetscale-adapter";
//   export const db: DbAdapter = new PlanetScaleAdapter(process.env.DATABASE_URL!);
// ---------------------------------------------------------------------------

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL environment variable is not set.");
}

export const db: DbAdapter = new NeonAdapter(process.env.DATABASE_URL);

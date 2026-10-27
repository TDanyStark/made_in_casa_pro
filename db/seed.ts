/**
 * Database seeder
 *
 * Usage:
 *   npx tsx db/seed.ts           — apply new seeds (skips already applied)
 *   npx tsx db/seed.ts --reset   — truncate all seed tables, clear tracker, then re-seed
 *
 * Reads all .sql files from db/seeds/ sorted by filename, tracks applied
 * seeds in a _seeds table, and skips already-applied ones.
 * All seed files use ON CONFLICT DO NOTHING so they are safe to re-run.
 * With NODE_ENV=production it refuses to run unless CONFIRM_PRODUCTION=1.
 */

import { readdir, readFile } from "fs/promises";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { Pool } from "pg";
import { loadEnvFiles } from "./load-env";
import { assertProductionConfirmed } from "./production-guard";

// Load .env.local, then .env for whatever it does not define
loadEnvFiles();

const __dirname = dirname(fileURLToPath(import.meta.url));
const RESET = process.argv.includes("--reset");

// Tables populated by seeds, in dependency order (leaf → root).
// RESTART IDENTITY resets auto-increment sequences.
const SEED_TABLES = [
  "product_task_templates",
  "user_skills",
  "products",
  "product_categories",
  "brands",
  "managers",
  "clients",
  "users",
  "business_units",
  "skills",
  "areas",
  "countries",
  "roles",
].join(", ");

async function seed() {
  assertProductionConfirmed(RESET ? "db:seed:reset" : "db:seed");

  const url =
    process.env.NODE_ENV === "production"
      ? process.env.DATABASE_URL
      : process.env.DATABASE_LOCAL_URL || "postgresql://localhost/made_in_casa";
  if (!url) {
    throw new Error(
      "Missing database URL. Use DATABASE_LOCAL_URL in local or DATABASE_URL in production."
    );
  }

  const pool = new Pool({ connectionString: url });

  // Ensure seeds tracking table exists
  await pool.query(`
    CREATE TABLE IF NOT EXISTS _seeds (
      id         SERIAL PRIMARY KEY,
      name       TEXT        NOT NULL UNIQUE,
      applied_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    )
  `);

  if (RESET) {
    console.log("⚠️  --reset: truncating all seed tables…");
    await pool.query(
      `TRUNCATE ${SEED_TABLES} RESTART IDENTITY CASCADE`
    );
    await pool.query("DELETE FROM _seeds");
    console.log("✓  Tables cleared. Re-seeding…\n");
  }

  const seedsDir = join(__dirname, "seeds");
  const files = (await readdir(seedsDir))
    .filter((f) => f.endsWith(".sql"))
    .sort();

  const { rows } = await pool.query<{ name: string }>(
    "SELECT name FROM _seeds"
  );
  const applied = new Set(rows.map((r) => r.name));

  let ran = 0;
  for (const file of files) {
    if (applied.has(file)) {
      console.log(`  skip  ${file}`);
      continue;
    }

    const sql = await readFile(join(seedsDir, file), "utf8");
    console.log(`  run   ${file}`);

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(sql);
      await client.query("INSERT INTO _seeds (name) VALUES ($1)", [file]);
      await client.query("COMMIT");
      ran++;
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  }

  await pool.end();
  console.log(`\nDone — ${ran} seed file(s) applied.`);
}

seed().catch((err) => {
  console.error("Seeding failed:", err);
  process.exit(1);
});

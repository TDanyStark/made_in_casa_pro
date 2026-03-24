/**
 * Database seeder
 *
 * Usage: npx tsx db/seed.ts
 *
 * Reads all .sql files from db/seeds/ sorted by filename, tracks applied
 * seeds in a _seeds table, and skips already-applied ones.
 * All seed files use ON CONFLICT DO NOTHING so they are safe to re-run.
 */

import { readdir, readFile } from "fs/promises";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { Pool, neonConfig } from "@neondatabase/serverless";

// Load .env.local / .env for local development
for (const envFile of [".env.local", ".env"]) {
  try {
    process.loadEnvFile(envFile);
    break;
  } catch {
    // File not found — try next
  }
}

// WebSocket support for Node.js
if (typeof globalThis.WebSocket === "undefined") {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    neonConfig.webSocketConstructor = require("ws");
  } catch {
    // ws not installed — fine in environments with native WebSocket
  }
}

const __dirname = dirname(fileURLToPath(import.meta.url));

async function seed() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set.");

  const pool = new Pool({ connectionString: url });

  // Ensure seeds tracking table exists
  await pool.query(`
    CREATE TABLE IF NOT EXISTS _seeds (
      id         SERIAL PRIMARY KEY,
      name       TEXT        NOT NULL UNIQUE,
      applied_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    )
  `);

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

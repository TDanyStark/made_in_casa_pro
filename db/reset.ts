/**
 * Database reset
 *
 * Usage:  npm run db:reset
 *
 * Drops the entire public schema (all tables, indexes, sequences, extensions),
 * recreates it, then runs migrations and seeds from scratch.
 *
 * ⚠️  ALL DATA WILL BE LOST. Local development only.
 */

import { execSync } from "child_process";
import { Pool } from "pg";

for (const envFile of [".env.local", ".env"]) {
  try {
    process.loadEnvFile(envFile);
    break;
  } catch {
    // File not found — try next
  }
}

const red    = (s: string) => `\x1b[31m${s}\x1b[0m`;
const green  = (s: string) => `\x1b[32m${s}\x1b[0m`;
const yellow = (s: string) => `\x1b[33m${s}\x1b[0m`;
const bold   = (s: string) => `\x1b[1m${s}\x1b[0m`;

async function reset() {
  const url =
    process.env.NODE_ENV === "production"
      ? process.env.DATABASE_URL
      : process.env.DATABASE_LOCAL_URL || "postgresql://localhost/made_in_casa";

  if (!url) {
    console.error(red("✖  Falta URL de base de datos."));
    process.exit(1);
  }

  console.log(`\n${bold(yellow("⚠️  RESET — se eliminará toda la base de datos"))}\n`);

  const pool = new Pool({ connectionString: url });

  try {
    console.log("  Dropping schema public…");
    await pool.query("DROP SCHEMA public CASCADE");
    await pool.query("CREATE SCHEMA public");
    console.log(`  ${green("✔")}  Schema recreado\n`);
  } finally {
    await pool.end();
  }

  console.log("  Corriendo migraciones…\n");
  execSync("npm run db:migrate", { stdio: "inherit" });

  console.log("\n  Corriendo seeds…\n");
  execSync("npm run db:seed", { stdio: "inherit" });

  console.log(`\n${green("✔")}  Reset completo — base de datos lista.\n`);
}

reset().catch((err) => {
  console.error(red("Error inesperado:"), err);
  process.exit(1);
});

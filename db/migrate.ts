/**
 * Database migration runner
 *
 * Usage:  pnpm db:migrate
 *
 * - Crea la tabla _migrations si no existe.
 * - Lee todos los .sql de db/migrations/ ordenados alfabéticamente.
 * - Salta los que ya fueron aplicados.
 * - Cada migración corre en su propia transacción: si falla, hace rollback
 *   y detiene el proceso mostrando exactamente qué archivo falló.
 */

import { readdir, readFile } from "fs/promises";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { Pool, neonConfig } from "@neondatabase/serverless";

// ── Cargar variables de entorno ──────────────────────────────────────────────
for (const envFile of [".env.local", ".env"]) {
  try {
    process.loadEnvFile(envFile);
    break;
  } catch {
    // Archivo no encontrado — continúa con el siguiente
  }
}

// ── WebSocket para entornos Node.js (no necesario en Vercel / edge) ──────────
if (typeof globalThis.WebSocket === "undefined") {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    neonConfig.webSocketConstructor = require("ws");
  } catch {
    // ws no instalado — funciona en entornos con WebSocket nativo
  }
}

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Helpers de output ────────────────────────────────────────────────────────
const green  = (s: string) => `\x1b[32m${s}\x1b[0m`;
const yellow = (s: string) => `\x1b[33m${s}\x1b[0m`;
const red    = (s: string) => `\x1b[31m${s}\x1b[0m`;
const dim    = (s: string) => `\x1b[2m${s}\x1b[0m`;

async function migrate() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error(red("✖  DATABASE_URL no está definida."));
    process.exit(1);
  }

  const pool = new Pool({ connectionString: url });

  // ── Tabla de control ──────────────────────────────────────────────────────
  await pool.query(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id         SERIAL      PRIMARY KEY,
      name       TEXT        NOT NULL UNIQUE,
      applied_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // ── Leer archivos ─────────────────────────────────────────────────────────
  const migrationsDir = join(__dirname, "migrations");
  const files = (await readdir(migrationsDir))
    .filter((f) => f.endsWith(".sql"))
    .sort(); // orden alfabético = orden numérico por el prefijo NNN_

  const { rows } = await pool.query<{ name: string }>(
    "SELECT name FROM _migrations ORDER BY applied_at"
  );
  const applied = new Set(rows.map((r) => r.name));

  console.log(`\n${dim("─────────────────────────────────────────")}`);
  console.log(`  Migraciones pendientes: ${files.filter((f) => !applied.has(f)).length} / ${files.length}`);
  console.log(dim("─────────────────────────────────────────\n"));

  let ran = 0;

  for (const file of files) {
    if (applied.has(file)) {
      console.log(`  ${dim("skip")}  ${dim(file)}`);
      continue;
    }

    const sql = await readFile(join(migrationsDir, file), "utf8");

    // Archivos que solo contienen comentarios se registran sin ejecutar nada
    const hasStatements = sql
      .split("\n")
      .some((line) => line.trim() && !line.trim().startsWith("--"));

    if (!hasStatements) {
      await pool.query("INSERT INTO _migrations (name) VALUES ($1)", [file]);
      console.log(`  ${yellow("noop")}  ${file}`);
      ran++;
      continue;
    }

    process.stdout.write(`  ${yellow("run ")}  ${file} … `);

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(sql);
      await client.query("INSERT INTO _migrations (name) VALUES ($1)", [file]);
      await client.query("COMMIT");
      console.log(green("✔"));
      ran++;
    } catch (err) {
      await client.query("ROLLBACK");
      console.log(red("✖"));
      console.error(`\n${red("Error en")} ${file}:`);
      console.error(err instanceof Error ? err.message : err);
      console.error(
        `\n${yellow("La migración fue revertida. Corrije el error y vuelve a correr pnpm db:migrate.")}`
      );
      await pool.end();
      process.exit(1);
    } finally {
      client.release();
    }
  }

  await pool.end();

  console.log(`\n${green("✔")} ${ran} migración(es) aplicada(s).\n`);
}

migrate().catch((err) => {
  console.error(red("Error inesperado:"), err);
  process.exit(1);
});

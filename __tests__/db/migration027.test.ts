/**
 * @jest-environment node
 */
// Spec: odd/tasks/brand-sourced-project-manager.md — S4
// La migración NO se ejecuta aquí: se verifica solo la forma del SQL
// (se elimina projects.manager_id y su índice; nada más).
import { existsSync, readFileSync } from "fs";
import { join } from "path";

const FILE = join(process.cwd(), "db/migrations/027_drop_project_manager_id.sql");

/** Sentencias SQL sin comentarios de línea, con espacios normalizados. */
function statements(): string[] {
  return readFileSync(FILE, "utf8")
    .split("\n")
    .filter((line) => !line.trim().startsWith("--"))
    .join("\n")
    .replace(/\s+/g, " ")
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean);
}

describe("027_drop_project_manager_id.sql", () => {
  it("existe y explica en el encabezado qué hace, el orden de despliegue y el rollback", () => {
    expect(existsSync(FILE)).toBe(true);
    const source = readFileSync(FILE, "utf8");
    const header = source.split("\n").slice(0, 5).join("\n");
    expect(header).toMatch(/^-- /);
    expect(header).toContain("027");
    expect(source).toContain("026");
    expect(source).toMatch(/[Rr]ollback/);
  });

  it("S4: elimina solo el índice y la columna projects.manager_id, de forma idempotente", () => {
    expect(statements()).toEqual([
      "DROP INDEX IF EXISTS idx_projects_manager_id",
      "ALTER TABLE projects DROP COLUMN IF EXISTS manager_id",
    ]);
  });

  it("conserva created_manager_id, client_id y los historiales", () => {
    const sql = statements().join(";");
    expect(sql).not.toMatch(/created_manager_id|client_id|_history|CASCADE/);
  });
});

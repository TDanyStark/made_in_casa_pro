/**
 * @jest-environment node
 */
// Spec: odd/tasks/brand-owned-project-manager.md — S7
// La migración NO se ejecuta aquí: se verifica solo la forma del SQL
// (columna, backfill desde el historial con fallback y NOT NULL al final).
import { readFileSync } from "fs";
import { join } from "path";

const FILE = join(process.cwd(), "db/migrations/025_project_created_manager.sql");

/** SQL sin comentarios de línea, con espacios normalizados. */
function statements(): string[] {
  const sql = readFileSync(FILE, "utf8")
    .split("\n")
    .filter((line) => !line.trim().startsWith("--"))
    .join("\n")
    .replace(/\s+/g, " ");
  return sql
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean);
}

describe("025_project_created_manager.sql", () => {
  it("explica en el encabezado qué hace", () => {
    const header = readFileSync(FILE, "utf8").split("\n").slice(0, 5).join("\n");
    expect(header).toMatch(/^-- /);
    expect(header).toContain("025");
  });

  it("agrega la columna, rellena, la vuelve NOT NULL e indexa, en ese orden", () => {
    const [addColumn, backfill, notNull, index, ...rest] = statements();
    expect(rest).toEqual([]);

    expect(addColumn).toBe(
      "ALTER TABLE projects ADD COLUMN IF NOT EXISTS created_manager_id INTEGER REFERENCES managers(id) ON DELETE RESTRICT"
    );

    // Gerente al crearse = previous_manager_id de la fila MÁS ANTIGUA del
    // historial (changed_at, desempate por id); si no hay o es NULL, el actual.
    expect(backfill).toBe(
      "UPDATE projects p SET created_manager_id = COALESCE( ( SELECT pmh.previous_manager_id FROM project_manager_history pmh WHERE pmh.project_id = p.id ORDER BY pmh.changed_at ASC, pmh.id ASC LIMIT 1 ), p.manager_id ) WHERE p.created_manager_id IS NULL"
    );

    expect(notNull).toBe("ALTER TABLE projects ALTER COLUMN created_manager_id SET NOT NULL");
    expect(index).toBe(
      "CREATE INDEX IF NOT EXISTS idx_projects_created_manager_id ON projects (created_manager_id)"
    );
  });

  it("no toca updated_at, manager_id ni client_id", () => {
    for (const stmt of statements()) {
      expect(stmt).not.toMatch(/updated_at/);
      expect(stmt).not.toMatch(/SET manager_id|client_id/);
    }
  });
});

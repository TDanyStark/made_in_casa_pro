/**
 * @jest-environment node
 */
// Spec: odd/tasks/brand-owned-project-manager.md — S6
// La migración reescribe datos de producción y NO se ejecuta aquí: se verifica
// solo la forma del SQL (historial antes del UPDATE, guarda idempotente).
import { readFileSync } from "fs";
import { join } from "path";

const FILE = join(
  process.cwd(),
  "db/migrations/024_align_project_manager_with_brand.sql"
);

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

describe("024_align_project_manager_with_brand.sql", () => {
  it("explica en el encabezado qué hace y por qué", () => {
    const header = readFileSync(FILE, "utf8").split("\n").slice(0, 5).join("\n");
    expect(header).toMatch(/^-- /);
    expect(header).toContain("024");
  });

  it("registra el historial y luego alinea, en ese orden y solo esas dos sentencias", () => {
    const [history, update, ...rest] = statements();
    expect(rest).toEqual([]);

    expect(history).toMatch(
      /^INSERT INTO project_manager_history \(project_id, previous_manager_id, new_manager_id, changed_by, reason\) SELECT p\.id, p\.manager_id, b\.manager_id, NULL, 'Alineación con el gerente de la marca principal \(migración 024\)' FROM projects p JOIN brands b ON b\.id = p\.brand_id WHERE b\.manager_id IS NOT NULL AND p\.manager_id IS DISTINCT FROM b\.manager_id$/
    );

    expect(update).toMatch(
      /^UPDATE projects p SET manager_id = b\.manager_id FROM brands b WHERE b\.id = p\.brand_id AND b\.manager_id IS NOT NULL AND p\.manager_id IS DISTINCT FROM b\.manager_id$/
    );
  });

  it("es idempotente: ambas sentencias usan la misma guarda, sin estado ni client_id", () => {
    for (const stmt of statements()) {
      expect(stmt).toContain("b.manager_id IS NOT NULL AND p.manager_id IS DISTINCT FROM b.manager_id");
      expect(stmt).not.toMatch(/status/);
      expect(stmt).not.toMatch(/client_id/);
    }
  });
});

/**
 * @jest-environment node
 */
// Spec: odd/tasks/brand-sourced-project-manager.md — S4, S5
// La migración NO se ejecuta aquí: se verifica solo la forma del SQL
// (projects.manager_id opcional, brands.manager_id NOT NULL con guarda y FKs
// a managers con ON DELETE RESTRICT).
import { existsSync, readFileSync } from "fs";
import { join } from "path";

const FILE = join(
  process.cwd(),
  "db/migrations/026_brand_sourced_project_manager.sql"
);

/** SQL sin comentarios de línea, con espacios normalizados. */
function body(): string {
  return readFileSync(FILE, "utf8")
    .split("\n")
    .filter((line) => !line.trim().startsWith("--"))
    .join("\n")
    .replace(/\s+/g, " ")
    .trim();
}

/** Posición de `fragment` en el SQL; falla si no aparece. */
function at(fragment: string): number {
  const index = body().indexOf(fragment);
  expect(index).toBeGreaterThanOrEqual(0);
  return index;
}

describe("026_brand_sourced_project_manager.sql", () => {
  it("existe y explica en el encabezado qué hace, el historial que se conserva y el rollback", () => {
    expect(existsSync(FILE)).toBe(true);
    const source = readFileSync(FILE, "utf8");
    const header = source.split("\n").slice(0, 5).join("\n");
    expect(header).toMatch(/^-- /);
    expect(header).toContain("026");
    expect(source).toContain("project_manager_history");
    expect(source).toContain("024");
    expect(source).toContain("027");
  });

  it("S4: projects.manager_id deja de ser obligatorio (el código viejo aún puede escribirlo)", () => {
    expect(body()).toContain("ALTER TABLE projects ALTER COLUMN manager_id DROP NOT NULL;");
    expect(body()).not.toMatch(/DROP COLUMN/);
  });

  it("S5: aborta si alguna marca no tiene gerente y luego vuelve brands.manager_id NOT NULL", () => {
    const guard = at("DO $$");
    expect(body()).toMatch(
      /SELECT COUNT\(\*\) INTO \w+ FROM brands WHERE manager_id IS NULL;/
    );
    expect(body()).toMatch(/RAISE EXCEPTION '[^']*%[^']*', \w+;/);
    const notNull = at("ALTER TABLE brands ALTER COLUMN manager_id SET NOT NULL;");
    expect(guard).toBeLessThan(notNull);
  });

  it("S5: borra TODA FK previa hacia managers de esas columnas, tenga el nombre que tenga", () => {
    // Una FK con nombre no estándar en producción no debe sobrevivir junto a
    // la nueva (seguiría borrando en cascada): se buscan en el catálogo.
    const drop = at("FROM pg_constraint");
    expect(body()).toContain("contype = 'f'");
    expect(body()).toContain("confrelid = 'managers'::regclass");
    expect(body()).toMatch(/EXECUTE format\('ALTER TABLE %I DROP CONSTRAINT %I'/);
    for (const [table, column] of [
      ["brands", "manager_id"],
      ["brand_manager_history", "previous_manager_id"],
      ["brand_manager_history", "new_manager_id"],
    ]) {
      expect(body()).toContain(`('${table}', '${column}')`);
    }
    expect(drop).toBeLessThan(at("ADD CONSTRAINT"));
    expect(body()).not.toContain("DROP CONSTRAINT IF EXISTS");
  });

  it.each([
    ["brands", "brands_manager_id_fkey", "manager_id"],
    ["brand_manager_history", "brand_manager_history_previous_manager_id_fkey", "previous_manager_id"],
    ["brand_manager_history", "brand_manager_history_new_manager_id_fkey", "new_manager_id"],
  ])("S5: %s crea %s con ON DELETE RESTRICT", (table, constraint, column) => {
    at(
      `ALTER TABLE ${table} ADD CONSTRAINT ${constraint} FOREIGN KEY (${column}) REFERENCES managers(id) ON DELETE RESTRICT;`
    );
  });

  it("no reescribe datos: sin UPDATE, INSERT ni DELETE de filas", () => {
    expect(body()).not.toMatch(/\bUPDATE \w+ SET\b/);
    expect(body()).not.toMatch(/\bINSERT INTO\b/);
    expect(body()).not.toMatch(/\bDELETE FROM\b/);
    expect(body()).not.toMatch(/CASCADE/);
  });
});

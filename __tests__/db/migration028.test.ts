/**
 * @jest-environment node
 */
// Spec: odd/tasks/project-costs.md — S2, S3, S5, S6
// La migración NO se ejecuta aquí: se verifica solo la forma del SQL.
import { existsSync, readFileSync } from "fs";
import { join } from "path";

const FILE = join(process.cwd(), "db/migrations/028_project_costs.sql");

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

const find = (re: RegExp) => statements().find((s) => re.test(s));

describe("028_project_costs.sql", () => {
  it("existe y explica en el encabezado qué hace y la spec", () => {
    expect(existsSync(FILE)).toBe(true);
    const header = readFileSync(FILE, "utf8").split("\n").slice(0, 5).join("\n");
    expect(header).toMatch(/^-- /);
    expect(header).toContain("028");
    expect(header).toContain("odd/tasks/project-costs.md");
  });

  it("es idempotente: tablas e índices con IF NOT EXISTS", () => {
    const ddl = statements().filter((s) => /^CREATE /.test(s));
    expect(ddl.length).toBeGreaterThanOrEqual(5);
    for (const s of ddl) expect(s).toMatch(/IF NOT EXISTS/);
  });

  it("S6: crea las categorías con nombre único sin distinguir mayúsculas y recortado", () => {
    const table = find(/CREATE TABLE IF NOT EXISTS project_cost_categories/)!;
    expect(table).toMatch(/id SERIAL PRIMARY KEY/);
    expect(table).toMatch(/name TEXT NOT NULL/);
    expect(table).toMatch(/CHECK \(name = btrim\(name\) AND name <> ''\)/);
    expect(table).toMatch(/created_by INTEGER REFERENCES users\(id\) ON DELETE SET NULL/);
    expect(table).toMatch(/created_at TIMESTAMPTZ/);
    expect(find(/CREATE UNIQUE INDEX IF NOT EXISTS \w+ ON project_cost_categories \(\(?lower\(name\)\)?\)/)).toBeDefined();
  });

  it("S6: siembra las categorías por defecto sin duplicar", () => {
    const seed = find(/INSERT INTO project_cost_categories/)!;
    for (const name of ["Pago comercial", "Tarea comercial", "Herramientas y créditos", "Otro"]) {
      expect(seed).toContain(`('${name}')`);
    }
    expect(seed).toMatch(/ON CONFLICT .*DO NOTHING$/);
  });

  it("S2, S3, S5: crea project_costs ligado a proyecto, versión, categoría y tarea opcional, con auditoría", () => {
    const table = find(/CREATE TABLE IF NOT EXISTS project_costs /)!;
    expect(table).toMatch(/project_id INTEGER NOT NULL REFERENCES projects\(id\) ON DELETE CASCADE/);
    // NO ACTION (no RESTRICT): borrar el proyecto borra en cascada versiones y costos en la misma sentencia.
    expect(table).toMatch(/adjustment_id INTEGER NOT NULL REFERENCES project_adjustments\(id\)( ON DELETE NO ACTION)?,/);
    expect(table).not.toMatch(/adjustment_id[^,]*(CASCADE|SET NULL|RESTRICT)/);
    expect(table).toMatch(/category_id INTEGER NOT NULL REFERENCES project_cost_categories\(id\)/);
    expect(table).toMatch(/description TEXT/);
    expect(table).toMatch(/amount NUMERIC\(14,2\) NOT NULL CHECK \(amount > 0\)/);
    expect(table).toMatch(/incurred_at DATE NOT NULL DEFAULT CURRENT_DATE/);
    expect(table).toMatch(/task_id INTEGER REFERENCES project_tasks\(id\) ON DELETE SET NULL/);
    expect(table).toMatch(/created_by INTEGER REFERENCES users\(id\) ON DELETE SET NULL/);
    expect(table).toMatch(/updated_by INTEGER REFERENCES users\(id\) ON DELETE SET NULL/);
    expect(table).toMatch(/created_at TIMESTAMPTZ/);
    expect(table).toMatch(/updated_at TIMESTAMPTZ/);
  });

  it("indexa project_costs por proyecto y por versión", () => {
    expect(find(/CREATE INDEX IF NOT EXISTS \w+ ON project_costs \(project_id\)/)).toBeDefined();
    expect(find(/CREATE INDEX IF NOT EXISTS \w+ ON project_costs \(adjustment_id\)/)).toBeDefined();
  });

  it("no toca tablas existentes", () => {
    expect(statements().join(";")).not.toMatch(/ALTER TABLE|DROP /);
  });
});

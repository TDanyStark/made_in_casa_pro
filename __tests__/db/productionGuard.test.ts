/**
 * @jest-environment node
 */
// db:reset, db:seed y db:seed:reset no corren en producción sin
// CONFIRM_PRODUCTION=1. Se ejecutan los scripts reales en un proceso hijo,
// desde un directorio temporal y con una URL inalcanzable (127.0.0.1:1): nunca
// tocan una base de datos real.
import { spawnSync } from "child_process";
import { mkdtempSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";

const ROOT = process.cwd();
const TSX = join(ROOT, "node_modules/.bin/tsx");
const UNREACHABLE = "postgresql://nobody@127.0.0.1:1/none";
const GUARD = (command: string) =>
  `✖  ${command} no se ejecuta en producción sin confirmación. Si de verdad quieres hacerlo, vuelve a ejecutarlo con CONFIRM_PRODUCTION=1.`;

function run(dir: string, script: string, args: string[], env: Record<string, string>) {
  const result = spawnSync(TSX, [join(ROOT, script), ...args], {
    cwd: dir,
    env: { PATH: process.env.PATH ?? "", NODE_ENV: "test", ...env },
    encoding: "utf8",
    timeout: 30000,
  });
  return { status: result.status, stdout: result.stdout, stderr: result.stderr };
}

describe("protección de producción en db:reset y db:seed", () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "db-guard-"));
  });
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it.each([
    ["db:reset", "db/reset.ts", []],
    ["db:seed", "db/seed.ts", []],
    ["db:seed:reset", "db/seed.ts", ["--reset"]],
  ])("%s en producción sin confirmación sale con 1 antes de conectar", (command, script, args) => {
    const r = run(dir, script, args as string[], { NODE_ENV: "production", DATABASE_URL: UNREACHABLE });

    expect(r.status).toBe(1);
    expect(r.stderr).toContain(GUARD(command));
    expect(r.stdout).not.toContain("Dropping schema");
    expect(`${r.stdout}${r.stderr}`).not.toContain("ECONNREFUSED");
  });

  it.each([
    ["db:reset", "db/reset.ts", []],
    ["db:seed", "db/seed.ts", []],
  ])("%s en producción con CONFIRM_PRODUCTION=1 pasa la protección y lee DATABASE_URL de .env", (command, script, args) => {
    // .env.local existe sin DATABASE_URL: antes ocultaba la de .env
    writeFileSync(join(dir, ".env.local"), "OTHER=1\n");
    writeFileSync(join(dir, ".env"), `DATABASE_URL=${UNREACHABLE}\n`);

    const r = run(dir, script, args as string[], { NODE_ENV: "production", CONFIRM_PRODUCTION: "1" });

    expect(r.stderr).not.toContain(GUARD(command));
    expect(`${r.stdout}${r.stderr}`).not.toMatch(/Falta URL|Missing database URL/);
    expect(`${r.stdout}${r.stderr}`).toContain("ECONNREFUSED");
    expect(r.status).not.toBe(0);
  });

  it("fuera de producción no aplica la protección (comportamiento previo)", () => {
    const r = run(dir, "db/seed.ts", [], { DATABASE_LOCAL_URL: UNREACHABLE });

    expect(r.stderr).not.toContain("CONFIRM_PRODUCTION");
    expect(`${r.stdout}${r.stderr}`).toContain("ECONNREFUSED");
    expect(r.status).not.toBe(0);
  });
});

/**
 * @jest-environment node
 */
// db:migrate debe leer DATABASE_URL de .env aunque exista .env.local sin ella.
// `process.loadEnvFile` escribe en el entorno real del proceso (Jest aísla
// `process.env`), así que se prueba en un proceso hijo.
import { execFileSync } from "child_process";
import { mkdtempSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";

const LOADER = join(process.cwd(), "db/load-env.ts");
const TSX = join(process.cwd(), "node_modules/.bin/tsx");

/** Ejecuta loadEnvFiles en `dir` y devuelve las variables pedidas. */
function run(dir: string, files: string[], keys: string[], env: Record<string, string> = {}) {
  const script = `
    import { loadEnvFiles } from ${JSON.stringify(LOADER)};
    loadEnvFiles(${JSON.stringify(files)});
    console.log(JSON.stringify(Object.fromEntries(${JSON.stringify(keys)}.map((k) => [k, process.env[k] ?? null]))));
  `;
  const out = execFileSync(TSX, ["-e", script], {
    cwd: dir,
    env: { PATH: process.env.PATH ?? "", NODE_ENV: "test", ...env },
    encoding: "utf8",
  });
  return JSON.parse(out.trim().split("\n").pop()!);
}

describe("loadEnvFiles", () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "load-env-"));
  });
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("carga todos los archivos existentes: el primero gana y los siguientes completan lo que falta", () => {
    writeFileSync(join(dir, ".env.local"), "A=from_local\n");
    writeFileSync(join(dir, ".env"), "A=from_env\nDATABASE_URL=postgres://from_env\n");

    expect(run(dir, [".env.local", ".env"], ["A", "DATABASE_URL"])).toEqual({
      A: "from_local",
      DATABASE_URL: "postgres://from_env",
    });
  });

  it("ignora los archivos que no existen", () => {
    writeFileSync(join(dir, ".env"), "B=from_env\n");

    expect(run(dir, [".env.local", ".env"], ["B"])).toEqual({ B: "from_env" });
  });

  it("no sobrescribe variables ya definidas en el entorno", () => {
    writeFileSync(join(dir, ".env"), "C=from_env\n");

    expect(run(dir, [".env"], ["C"], { C: "from_shell" })).toEqual({ C: "from_shell" });
  });
});

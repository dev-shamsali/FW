/** Drives the interactive `create` prompts through a real pseudo-terminal (needs python3, not available on Windows). */
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterAll, describe, expect, it } from "vitest";

const root = resolve(import.meta.dirname, "../..");
const bin = join(root, "packages/cli/dist/bin.js");
const py = spawnSync("python3", ["--version"], { encoding: "utf8" });
const canRun = process.platform !== "win32" && py.status === 0 && existsSync(bin);
const work = mkdtempSync(join(tmpdir(), "rhea-pty-"));
afterAll(() => rmSync(work, { recursive: true, force: true }));

const drive = (name: string, ...steps: string[]) => {
  const r = spawnSync("python3", [join(root, "tests/e2e/pty-create.py"), work, bin, name, ...steps], { encoding: "utf8", timeout: 90_000 });
  const exit = Number(/EXIT=(-?\d+)/.exec(r.stdout)?.[1] ?? NaN);
  return { out: r.stdout.replace(new RegExp(String.fromCharCode(27) + "\\[[0-9;?]*[A-Za-z]", "g"), ""), exit };
};

describe.skipIf(!canRun)("interactive create", () => {
  it("asks language, module system, database and install, and honours arrow keys", () => {
    // JavaScript (down), CommonJS (down), MySQL (down, down), install: No (down)
    const { out, exit } = drive("promptapp", "Which language?=DE", "Which module system?=DE", "Which database?=DDE", "Install dependencies now?=DE");
    expect(exit, out).toBe(0);
    expect(out).toContain("Which language?");
    expect(out).toContain("Which module system?");
    expect(out).toContain("Which database?");
    expect(out).toContain("developed by Shams Ali Shaikh");
    expect(out).toContain("JavaScript, CommonJS, database MySQL");
    expect(JSON.parse(readFileSync(join(work, "promptapp/rhea.config.json"), "utf8"))).toEqual({ language: "js", module: "cjs", database: "mysql" });
    expect(out).toContain("docker run -d --name promptapp-mysql");
    expect(out).toContain("http://localhost:5000/api/rhea");
    expect(existsSync(join(work, "promptapp/node_modules"))).toBe(false); // chose not to install
  }, 120_000);

  it("Enter on every prompt picks TypeScript, ES Modules, no database", () => {
    const { out, exit } = drive("defaults", "Which language?=E", "Which module system?=E", "Which database?=E", "Install dependencies now?=DE");
    expect(exit, out).toBe(0);
    expect(JSON.parse(readFileSync(join(work, "defaults/rhea.config.json"), "utf8"))).toEqual({ language: "ts", module: "esm", database: "none" });
  }, 120_000);

  it("asks for the project name when none is given, and Ctrl+C aborts without writing files", () => {
    const named = drive("-", "Project name:=E", "Which language?=C");
    expect(named.out).toContain("Project name:");
    expect(named.exit).toBe(130);
    expect(existsSync(join(work, "my-api"))).toBe(false);
  }, 120_000);
});

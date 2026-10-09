/**
 * Other project flavours, installed and run for real: TypeScript+CommonJS+MongoDB, JavaScript+CommonJS+MySQL, JavaScript+ESM.
 * No database server is needed: tests do not start one, and the "database down" case is the point of the start check.
 * Slow (npm install x3). Run with: npm run test:e2e
 */
import { spawn, spawnSync, type SpawnSyncReturns } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const root = resolve(import.meta.dirname, "../..");
const win = process.platform === "win32";
const work = mkdtempSync(join(tmpdir(), "rhea-var-"));
const tgz = join(work, "tgz");
const node = process.execPath;
let env: NodeJS.ProcessEnv;

const sh = (cmd: string, args: string[], cwd: string, extra: NodeJS.ProcessEnv = {}): SpawnSyncReturns<string> =>
  spawnSync(cmd, args, { cwd, encoding: "utf8", shell: win && cmd === "npm", env: { ...process.env, ...extra }, maxBuffer: 64 * 1024 * 1024 });
const npm = (args: string[], cwd: string) => sh("npm", args, cwd);
const rhea = (args: string[], cwd: string) => sh(node, [join(root, "packages/cli/dist/bin.js"), ...args], cwd, env);
const show = (r: SpawnSyncReturns<string>) => `${r.stdout}\n${r.stderr}`;

beforeAll(() => {
  mkdirSync(tgz);
  expect(npm(["run", "build"], root).status).toBe(0);
  for (const w of ["@rheajs/core", "@rheajs/cli"]) expect(npm(["pack", "-w", w, "--pack-destination", tgz], root).status).toBe(0);
  const f = (p: string) =>
    "file:" +
    join(
      tgz,
      readdirSync(tgz).find((x) => x.startsWith(p))!,
    );
  env = { RHEA_CORE_SPEC: f("rheajs-core"), RHEA_CLI_SPEC: f("rheajs-cli") };
}, 300_000);
afterAll(() => rmSync(work, { recursive: true, force: true }));

const variants = [
  { name: "ts-cjs-mongodb", flags: ["--ts", "--cjs", "--db", "mongodb"], ts: true, db: "mongodb" },
  { name: "js-cjs-mysql", flags: ["--js", "--cjs", "--db", "mysql"], ts: false, db: "mysql" },
  { name: "js-esm-none", flags: ["--js", "--esm", "--db", "none"], ts: false, db: "none" },
] as const;

describe.each(variants)("$name", (v) => {
  const app = join(work, v.name);

  it("create --install", () => {
    const r = rhea(["create", v.name, ...v.flags, "--yes", "--install"], work);
    expect(r.status, show(r)).toBe(0);
    expect(existsSync(join(app, "node_modules/@rheajs/core"))).toBe(true);
  }, 300_000);

  it("lint, typecheck, test, generate a module, test again", () => {
    for (const script of v.ts ? ["lint", "typecheck", "test"] : ["lint", "test"]) {
      const r = npm(["run", script], app);
      expect(r.status, `${script}\n${show(r)}`).toBe(0);
    }
    const g = rhea(["generate", "module", "orders"], app);
    expect(g.status, show(g)).toBe(0);
    for (const script of v.ts ? ["lint", "typecheck", "test"] : ["lint", "test"]) {
      const r = npm(["run", script], app);
      expect(r.status, `after generate: ${script}\n${show(r)}`).toBe(0);
    }
    const doctor = rhea(["doctor"], app);
    expect(doctor.status, show(doctor)).toBe(0);
    expect(doctor.stdout).toContain("0 errors");
  }, 300_000);

  it("builds (TypeScript) and starts: serves the first API or fails clearly without a database", async () => {
    if (v.ts) {
      const b = rhea(["build"], app);
      expect(b.status, show(b)).toBe(0);
    }
    const entry = v.ts ? "dist/server.js" : "src/server.js";
    const dbDown = v.db === "mongodb" ? "mongodb://127.0.0.1:1/x" : v.db === "mysql" ? "mysql://root:x@127.0.0.1:1/x" : "";
    const child = spawn(node, [entry], { cwd: app, env: { ...process.env, NODE_ENV: "production", PORT: "0", ...(dbDown ? { DATABASE_URL: dbDown } : {}) } });
    let log = "";
    child.stdout.on("data", (d) => (log += d));
    child.stderr.on("data", (d) => (log += d));
    const exited = new Promise<number | null>((r) => child.once("exit", (c) => r(c)));

    if (v.db !== "none") {
      expect(await exited, log).toBe(1);
      expect(log).toContain("Could not connect to");
      expect(log).not.toContain("x@127"); // credentials from the URL never reach the log
      return;
    }
    const port = await new Promise<number>((res, rej) => {
      const t = setTimeout(() => rej(new Error("server did not start\n" + log)), 20_000);
      const iv = setInterval(() => {
        const m = /"port":(\d+)/.exec(log);
        if (m) {
          clearTimeout(t);
          clearInterval(iv);
          res(Number(m[1]));
        }
      }, 50);
      child.once("exit", () => rej(new Error("server exited early\n" + log)));
    });
    const res = await fetch(`http://127.0.0.1:${port}/api/rhea`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: { name: string; developedBy: string } };
    expect(body.data).toMatchObject({ name: "Rhea.js", developedBy: "Shams Ali Shaikh" });
    expect((await fetch(`http://127.0.0.1:${port}/health/ready`)).status).toBe(200);
    child.kill("SIGTERM");
    const code = await exited;
    if (!win) {
      expect(code).toBe(0);
      expect(log).toContain("shutdown complete");
    }
  }, 120_000);

  it("keeps the configuration the user chose", () => {
    const cfg = JSON.parse(readFileSync(join(app, "rhea.config.json"), "utf8"));
    expect(cfg).toEqual({ language: v.ts ? "ts" : "js", module: v.name.includes("cjs") ? "cjs" : "esm", database: v.db });
  });
});

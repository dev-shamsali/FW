/**
 * Real user journey: pack the packages, scaffold in a clean directory, install,
 * generate, test, lint, typecheck, build, start, shutdown, doctor, security.
 * Slow (npm install). Run with: npm run test:e2e
 */
import { spawn, spawnSync, type SpawnSyncReturns } from "node:child_process";
import { mkdtempSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const root = resolve(import.meta.dirname, "../..");
const win = process.platform === "win32";
const work = mkdtempSync(join(tmpdir(), "rhea-e2e-"));
const tgz = join(work, "tgz");
const app = join(work, "my-api");
const node = process.execPath;
let env: NodeJS.ProcessEnv;

const sh = (cmd: string, args: string[], cwd: string, extra: NodeJS.ProcessEnv = {}): SpawnSyncReturns<string> =>
  spawnSync(cmd, args, { cwd, encoding: "utf8", shell: win, env: { ...process.env, ...extra }, maxBuffer: 64 * 1024 * 1024 });
const npm = (args: string[], cwd: string, extra?: NodeJS.ProcessEnv) => sh("npm", args, cwd, extra);
const rhea = (args: string[], cwd = app) => sh(node, [join(root, "packages/cli/dist/bin.js"), ...args], cwd, env);
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

describe("generated project user journey", () => {
  it("create, install", () => {
    const r = sh(node, [join(root, "packages/create-rhea/dist/bin.js"), "my-api"], work, env);
    expect(r.status, show(r)).toBe(0);
    const i = npm(["install", "--no-audit", "--no-fund"], app);
    expect(i.status, show(i)).toBe(0);
  }, 300_000);

  it("generate module, test, typecheck, lint", () => {
    for (const name of ["users", "blog-posts", "categories", "class"]) {
      const g = rhea(["generate", "module", name]);
      expect(g.status, show(g)).toBe(0);
    }
    for (const [kind, name] of [
      ["controller", "alpha"],
      ["service", "beta"],
      ["route", "gamma"],
      ["validator", "delta"],
    ] as const)
      expect(rhea(["generate", kind, name]).status, kind).toBe(0);
    expect(rhea(["generate", "middleware", "auth"]).status).toBe(0);
    for (const script of ["test", "typecheck", "lint"]) {
      const r = npm(["run", script], app);
      expect(r.status, `${script}\n${show(r)}`).toBe(0);
    }
  }, 300_000);

  it("build, start, serve, graceful shutdown", async () => {
    const b = rhea(["build"]);
    expect(b.status, show(b)).toBe(0);
    const child = spawn(node, [join(root, "packages/cli/dist/bin.js"), "start"], {
      cwd: app,
      env: { ...process.env, ...env, NODE_ENV: "production", PORT: "0" },
    });
    let log = "";
    child.stdout.on("data", (d) => (log += d));
    child.stderr.on("data", (d) => (log += d));
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
    const health = await fetch(`http://127.0.0.1:${port}/health`);
    expect(health.status).toBe(200);
    expect(health.headers.get("x-content-type-options")).toBe("nosniff");
    const created = await fetch(`http://127.0.0.1:${port}/users`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "ada" }),
    });
    expect(created.status).toBe(201);
    const bad = await (await fetch(`http://127.0.0.1:${port}/users`, { method: "POST", headers: { "content-type": "application/json" }, body: "{" })).json();
    expect(bad.error.code).toBe("INVALID_JSON");
    expect(JSON.stringify(bad)).not.toContain("at "); // no stack frames

    const exited = new Promise<number | null>((r) => child.once("exit", (c) => r(c)));
    child.kill("SIGTERM");
    const code = await exited;
    if (!win) {
      expect(code).toBe(0);
      expect(log).toContain("shutdown complete");
    }
  }, 120_000);

  it("start refuses without a build", () => {
    const empty = join(work, "unbuilt");
    mkdirSync(empty);
    sh(node, [join(root, "packages/create-rhea/dist/bin.js"), "app2"], empty, env);
    const r = rhea(["start"], join(empty, "app2"));
    expect(r.status).toBe(1);
    expect(r.stderr).toContain("rhea build");
  });

  it("doctor, security, info", () => {
    const d = rhea(["doctor"]);
    expect(d.status, show(d)).toBe(0);
    expect(d.stdout).toContain("0 errors");
    const s = rhea(["security"]);
    expect(s.status, show(s)).toBe(0);
    expect(s.stdout).toContain("not a penetration test");
    expect(rhea(["info"]).stdout).toContain("Shams Ali Shaikh");
  });

  it("fails fast on invalid production env", () => {
    const code = `import("./dist/config/env.js")`;
    const r = sh(node, ["-e", code], app, { NODE_ENV: "production", PORT: "99999" });
    expect(r.status).toBe(1);
    expect(r.stderr).toContain("Rhea.js Environment Validation Failed");
    expect(r.stderr).toContain("Application startup aborted.");
  });
});

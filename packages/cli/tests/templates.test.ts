import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { run } from "../src/index.js";
import { projectFiles } from "../src/templates/project.js";
import type { Database, Language, ModuleSystem } from "../src/templates/options.js";
import { moduleFiles } from "../src/templates/parts.js";
import { parseName } from "../src/names.js";

const LANGS: Language[] = ["ts", "js"];
const MODULES: ModuleSystem[] = ["esm", "cjs"];
const DBS: Database[] = ["none", "mongodb", "mysql"];
const combos = LANGS.flatMap((language) => MODULES.flatMap((module) => DBS.map((database) => ({ language, module, database }))));
const gen = (c: (typeof combos)[number]) => projectFiles({ ...c, name: "demo-api", coreSpec: "^0.1.0-alpha.1", cliSpec: "^0.1.0-alpha.1" });

describe("project template matrix (12 combinations)", () => {
  it.each(combos)("%o has the expected shape", (c) => {
    const f = gen(c);
    const ext = c.language === "ts" ? "ts" : "js";
    const pkg = JSON.parse(f["package.json"]!);
    // scripts: nodemon for dev, plain node for start, vitest for tests
    expect(pkg.scripts.dev).toBe("nodemon");
    expect(pkg.scripts.start).toBe(c.language === "ts" ? "node dist/server.js" : "node src/server.js");
    expect(pkg.scripts.test).toBe("vitest run");
    expect(pkg.type).toBe(c.module === "esm" ? "module" : "commonjs");
    expect(pkg.engines.node).toBe(">=20.19.0");
    expect(pkg.devDependencies.nodemon).toBeTruthy();
    expect(Boolean(pkg.scripts.build)).toBe(c.language === "ts");
    // database dependency only when selected, never both
    expect(Boolean(pkg.dependencies.mongodb)).toBe(c.database === "mongodb");
    expect(Boolean(pkg.dependencies.mysql2)).toBe(c.database === "mysql");
    // config, branding, first API
    expect(JSON.parse(f["rhea.config.json"]!)).toEqual(c);
    expect(f[`src/modules/rhea/rhea.routes.${ext}`]).toContain("Shams Ali Shaikh");
    expect(f[`src/server.${ext}`]).toContain("developed by Shams Ali Shaikh");
    expect(f[`src/modules/index.${ext}`]).toContain("/api/rhea");
    expect(f[`src/modules/index.${ext}`]).toContain("// rhea:imports");
    expect(f[`src/modules/index.${ext}`]).toContain("  // rhea:modules");
    // database files and env
    expect(Boolean(f[`src/config/database.${ext}`])).toBe(c.database !== "none");
    expect(/^DATABASE_URL=/m.test(f[".env"]!)).toBe(c.database !== "none");
    expect(f[".env.example"]).not.toMatch(/:password@|=password$/m); // placeholders only
    expect(f[`src/config/env.${ext}`]).toContain(c.database === "none" ? "TRUST_PROXY" : "DATABASE_URL");
    // syntax matches the module system
    const sources = Object.entries(f)
      .filter(([p]) => /^src\/.*\.(ts|js)$/.test(p))
      .map(([, v]) => v);
    const all = sources.join("\n");
    if (c.language === "js" && c.module === "cjs") {
      expect(all).toContain("require(");
      expect(all).toContain("module.exports");
      expect(all).not.toMatch(/^import /m);
      expect(all).not.toMatch(/^export /m);
    } else {
      expect(all).toMatch(/^import /m);
      expect(all).not.toContain("module.exports");
      expect(all).not.toContain("require(");
    }
    if (c.language === "js") expect(all).not.toMatch(/: (string|Request|Response|Router|RheaApp)\b/); // no TypeScript leaked into JS
    if (c.language === "ts") expect(f["tsconfig.json"]).toBeTruthy();
    else expect(f["tsconfig.json"]).toBeUndefined();
    // test files: CommonJS JS projects use .mjs tests
    const testExt = c.language === "ts" ? "ts" : c.module === "cjs" ? "mjs" : "js";
    expect(f[`tests/integration/rhea.test.${testExt}`]).toContain("developedBy");
  });

  it("every generated JavaScript file is syntactically valid for its module system", () => {
    const dir = mkdtempSync(join(tmpdir(), "rhea-syntax-"));
    try {
      for (const c of combos.filter((x) => x.language === "js")) {
        const root = join(dir, `${c.module}-${c.database}`);
        for (const [p, content] of Object.entries(gen(c))) {
          if (!/\.(js|mjs)$/.test(p) || p.startsWith(".github")) continue;
          const target = join(root, p);
          mkdirSync(dirname(target), { recursive: true });
          writeFileSync(target, content);
        }
        writeFileSync(join(root, "package.json"), JSON.stringify({ type: c.module === "esm" ? "module" : "commonjs" }));
        for (const p of Object.keys(gen(c)).filter((x) => /\.(js|mjs)$/.test(x) && !x.startsWith(".github"))) {
          const r = spawnSync(process.execPath, ["--check", join(root, p)], { encoding: "utf8" });
          expect(r.status, `${c.module}/${c.database}/${p}\n${r.stderr}`).toBe(0);
        }
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }, 120_000);

  it("module generator output differs by flavour (no types file in JavaScript)", () => {
    const n = parseName("orders");
    const ts = moduleFiles(n, { language: "ts", module: "esm", database: "none" });
    const esm = moduleFiles(n, { language: "js", module: "esm", database: "none" });
    const cjs = moduleFiles(n, { language: "js", module: "cjs", database: "none" });
    expect(Object.keys(ts)).toContain("src/modules/orders/orders.types.ts");
    expect(Object.keys(esm).some((p) => p.endsWith(".types.js"))).toBe(false);
    expect(Object.keys(cjs)).toContain("tests/integration/orders.test.mjs");
    expect(cjs["src/modules/orders/orders.routes.js"]).toContain('require("./orders.controller")');
    expect(esm["src/modules/orders/orders.routes.js"]).toContain('from "./orders.controller.js"');
  });
});

describe("generate and create for JavaScript projects", () => {
  let dir: string;
  const cwd0 = process.cwd();
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "rhea-js-"));
    process.chdir(dir);
    vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    vi.spyOn(process.stderr, "write").mockImplementation(() => true);
  });
  afterEach(() => {
    process.chdir(cwd0);
    rmSync(dir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it("flags choose the flavour and generators follow rhea.config.json", async () => {
    expect(await run(["create", "app", "--js", "--cjs", "--db", "mysql", "--yes"])).toBe(0);
    const p = join(dir, "app");
    expect(JSON.parse(readFileSync(join(p, "rhea.config.json"), "utf8"))).toEqual({ language: "js", module: "cjs", database: "mysql" });
    expect(existsSync(join(p, "src/config/database.js"))).toBe(true);
    process.chdir(p);
    expect(await run(["generate", "module", "orders"])).toBe(0);
    const index = readFileSync(join(p, "src/modules/index.js"), "utf8");
    expect(index).toContain('const { ordersRouter } = require("./orders/orders.routes");');
    expect(index).toContain('{ path: "/orders", router: ordersRouter },');
    expect(existsSync(join(p, "src/modules/orders/orders.types.js"))).toBe(false);
    expect(existsSync(join(p, "tests/integration/orders.test.mjs"))).toBe(true);
    expect(await run(["generate", "service", "billing"])).toBe(0);
    expect(existsSync(join(p, "src/modules/billing/billing.repository.js"))).toBe(true);
    expect(await run(["generate", "module", "orders"])).toBe(1); // already registered
    expect(await run(["docker"])).toBe(0);
    expect(readFileSync(join(p, "docker-compose.yml"), "utf8")).toContain("mysql:8.4");
    expect(readFileSync(join(p, "Dockerfile"), "utf8")).toContain('"src/server.js"');
  });

  it("rejects contradictory or unknown flags with exit code 2", async () => {
    expect(await run(["create", "a", "--ts", "--js", "--yes"])).toBe(2);
    expect(await run(["create", "a", "--esm", "--cjs", "--yes"])).toBe(2);
    expect(await run(["create", "a", "--db", "oracle", "--yes"])).toBe(2);
    expect(existsSync(join(dir, "a"))).toBe(false);
  });

  it("JavaScript build is a no-op with a helpful message, TypeScript docker uses a build stage", async () => {
    await run(["create", "j", "--js", "--yes"]);
    process.chdir(join(dir, "j"));
    expect(await run(["build"])).toBe(0);
    await run(["docker"]);
    expect(readFileSync(join(dir, "j/Dockerfile"), "utf8")).not.toContain("npm run build");
    process.chdir(dir);
    await run(["create", "t", "--ts", "--db", "mongodb", "--yes"]);
    process.chdir(join(dir, "t"));
    await run(["docker"]);
    expect(readFileSync(join(dir, "t/Dockerfile"), "utf8")).toContain("npm run build");
    expect(readFileSync(join(dir, "t/docker-compose.yml"), "utf8")).toContain("mongo:7");
  });
});

afterAll(() => undefined);

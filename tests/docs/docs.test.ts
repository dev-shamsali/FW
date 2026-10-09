import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(import.meta.dirname, "../..");
const docsDir = join(root, "docs");
const nav = JSON.parse(readFileSync(join(docsDir, "nav.json"), "utf8")) as { section: string; pages: string[] }[];
const navPages = nav.flatMap((s) => s.pages);
const md = Object.fromEntries(navPages.map((n) => [n, readFileSync(join(docsDir, `${n}.md`), "utf8").replace(/\r\n/g, "\n")]));
const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/<[^>]+>/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

describe("docs structure", () => {
  it("covers the required topics and has no orphan files", () => {
    const required = [
      "introduction",
      "installation",
      "quick-start",
      "project-structure",
      "cli",
      "routing",
      "controllers",
      "services",
      "modules",
      "middleware",
      "validation",
      "configuration",
      "errors",
      "logging",
      "security",
      "testing",
      "databases",
      "plugins",
      "docker",
      "deployment",
      "api-reference",
      "migration-guides",
      "faq",
      "troubleshooting",
    ];
    expect(navPages.sort()).toEqual(required.sort());
    const files = readdirSync(docsDir)
      .filter((f) => f.endsWith(".md"))
      .map((f) => f.slice(0, -3));
    expect(files.sort()).toEqual(required.sort());
  });

  it("internal links point at existing pages and headings", () => {
    const bad: string[] = [];
    for (const [page, text] of Object.entries(md)) {
      for (const m of text.matchAll(/\]\(([a-z-]+)\.html(?:#([a-z0-9-]+))?\)/g)) {
        const target = m[1]!;
        if (!md[target]) bad.push(`${page} -> ${target}.html`);
        else if (m[2]) {
          const ids = [...md[target]!.matchAll(/^#{1,6} (.+)$/gm)].map((h) => slug(h[1]!));
          if (!ids.includes(m[2])) bad.push(`${page} -> ${target}.html#${m[2]}`);
        }
      }
    }
    expect(bad).toEqual([]);
  });
});

describe("docs accuracy", () => {
  it("every CLI command is documented and every documented rhea command exists", async () => {
    const { run } = await import("../../packages/cli/src/index.js");
    const cli = md["cli"]!;
    for (const c of ["create", "dev", "build", "start", "generate", "test", "doctor", "security", "docker", "info"]) expect(cli, c).toContain(`\`rhea ${c}`);
    const known = new Set(["create", "dev", "build", "start", "generate", "g", "test", "doctor", "security", "docker", "info", "help"]);
    for (const text of Object.values(md)) {
      for (const block of text.matchAll(/```bash\n([\s\S]*?)```/g)) {
        for (const line of block[1]!.split("\n")) {
          const m = /^(?:npx )?rhea (\S+)/.exec(line.trim());
          if (m && !m[1]!.startsWith("<")) expect(known.has(m[1]!), line).toBe(true);
        }
      }
    }
    expect(run).toBeTypeOf("function");
  });

  it("every core export appears in the API reference", async () => {
    const core = await import("../../packages/core/src/index.js");
    const ref = md["api-reference"]!;
    const typeNames = [
      "Plugin",
      "PluginContext",
      "HookName",
      "HookFn",
      "CorsConfig",
      "RateLimitConfig",
      "RheaApp",
      "RheaOptions",
      "ResponseFormatter",
      "SuccessBody",
      "ErrorBody",
      "ValidationSchemas",
      "Logger",
      "LoggerConfig",
      "LogLevel",
    ];
    const missing = [...Object.keys(core), ...typeNames].filter((n) => !new RegExp(`\\b${n}\\b`).test(ref));
    expect(missing).toEqual([]);
  });

  it("documented defaults match the code", () => {
    const cfg = md["configuration"]!;
    const app = readFileSync(join(root, "packages/core/src/app.ts"), "utf8");
    expect(app).toContain('options.bodyLimit ?? "100kb"');
    expect(cfg).toContain('`"100kb"`');
    expect(app).toContain("options.requestTimeoutMs ?? 30_000");
    expect(cfg).toContain("`30000`");
    expect(app).toContain("options.shutdownTimeoutMs ?? 10_000");
    expect(cfg).toContain("`10000`");
    const sec = readFileSync(join(root, "packages/core/src/security.ts"), "utf8");
    expect(sec).toContain("c.limit ?? 100");
    expect(sec).toContain("c.windowMs ?? 60_000");
  });
});

describe("docs examples", () => {
  it("every `ts verify` block type-checks against the real core build", () => {
    const dir = join(root, ".docs-verify");
    rmSync(dir, { recursive: true, force: true });
    mkdirSync(dir);
    let count = 0;
    for (const [page, text] of Object.entries(md)) {
      for (const m of text.matchAll(/```ts verify\n([\s\S]*?)```/g)) writeFileSync(join(dir, `${page}-${count++}.ts`), m[1]!);
    }
    expect(count).toBeGreaterThan(10);
    writeFileSync(
      join(dir, "tsconfig.json"),
      JSON.stringify({
        compilerOptions: {
          target: "ES2022",
          module: "NodeNext",
          moduleResolution: "NodeNext",
          strict: true,
          noUncheckedIndexedAccess: true,
          skipLibCheck: true,
          noEmit: true,
          types: ["node"],
        },
        include: ["*.ts"],
      }),
    );
    const tsc = join(root, "node_modules/typescript/bin/tsc");
    const r = spawnSync(process.execPath, [tsc, "-p", dir], { encoding: "utf8" });
    rmSync(dir, { recursive: true, force: true });
    expect(r.status, r.stdout + r.stderr).toBe(0);
  }, 60_000);
});

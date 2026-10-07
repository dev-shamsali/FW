import { mkdtempSync, readFileSync, rmSync, existsSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { run } from "../src/index.js";
import { parseArgs } from "../src/args.js";
import { parseName } from "../src/names.js";
import { scanProject } from "../src/commands/security.js";
import { runDoctorChecks } from "../src/commands/doctor.js";

let dir: string;
const cwd0 = process.cwd();
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "rhea-"));
  process.chdir(dir);
  vi.spyOn(process.stdout, "write").mockImplementation(() => true);
  vi.spyOn(process.stderr, "write").mockImplementation(() => true);
});
afterEach(() => {
  process.chdir(cwd0);
  rmSync(dir, { recursive: true, force: true });
  vi.restoreAllMocks();
});

describe("args and names", () => {
  it("parses flags", () => {
    expect(parseArgs(["a", "--x", "--k=v", "--s", "val"], ["s"])).toEqual({ positionals: ["a"], flags: { x: true, k: "v", s: "val" } });
  });
  it("derives names and rejects traversal", () => {
    expect(parseName("blog-posts")).toMatchObject({ pascal: "BlogPosts", camel: "blogPosts", singularPascal: "BlogPost", singularUpper: "BLOG_POST" });
    expect(parseName("categories").singularPascal).toBe("Category");
    for (const bad of ["../x", "A/b", "1abc", "", "a b"]) expect(() => parseName(bad || undefined)).toThrow();
    expect(() => parseName("../etc")).toThrow(/Invalid name/);
  });
});

describe("run", () => {
  it("exit codes", async () => {
    expect(await run(["--version"])).toBe(0);
    expect(await run(["help"])).toBe(0);
    expect(await run(["nope"])).toBe(2);
    expect(await run(["create"])).toBe(2);
    expect(await run(["generate", "module", "x"])).toBe(1); // no package.json
  });
});

describe("create + generate", () => {
  it("scaffolds a project and generates a registered module", async () => {
    expect(await run(["create", "demo", "--core-spec=file:x", "--cli-spec=file:y"])).toBe(0);
    const p = join(dir, "demo");
    for (const f of [
      "package.json",
      "src/app.ts",
      "src/server.ts",
      "src/config/env.ts",
      ".env",
      ".env.example",
      ".gitignore",
      "tsconfig.build.json",
      "tests/integration/health.test.ts",
    ])
      expect(existsSync(join(p, f)), f).toBe(true);
    expect(JSON.parse(readFileSync(join(p, "package.json"), "utf8")).dependencies["@rheajs/core"]).toBe("file:x");
    expect(await run(["create", "demo"])).toBe(1); // not empty

    process.chdir(p);
    expect(await run(["generate", "module", "blog-posts"])).toBe(0);
    const idx = readFileSync(join(p, "src/modules/index.ts"), "utf8");
    expect(idx).toContain('import { blogPostsRouter } from "./blog-posts/blog-posts.routes.js";');
    expect(idx).toContain('{ path: "/blog-posts", router: blogPostsRouter }');
    expect(readFileSync(join(p, "src/modules/blog-posts/blog-posts.service.ts"), "utf8")).toContain("BLOG_POST_NOT_FOUND");
    expect(await run(["generate", "module", "blog-posts"])).toBe(1); // exists, no --force
    expect(await run(["generate", "middleware", "auth"])).toBe(0);
    expect(existsSync(join(p, "src/middleware/auth.ts"))).toBe(true);
    expect(await run(["generate", "validator", "users"])).toBe(0);
    expect(await run(["docker"])).toBe(0);
    expect(readFileSync(join(p, "Dockerfile"), "utf8")).toContain("USER node");
  });
});

describe("security + doctor", () => {
  it("flags risky config without printing secret values", () => {
    mkdirSync(join(dir, "src"));
    writeFileSync(join(dir, "package.json"), '{"type":"module"}');
    writeFileSync(join(dir, ".env"), "CORS_ORIGIN=*\n");
    writeFileSync(
      join(dir, "src/a.ts"),
      'const apiKey = "supersecretvalue123";\ncreateApp({ cors: { origin: ["*"] }, bodyLimit: "50mb", rateLimit: { enabled: false } });\n',
    );
    const f = scanProject(dir);
    const msgs = f.map((x) => x.message).join("|");
    expect(msgs).toMatch(/credential/);
    expect(msgs).toMatch(/Wildcard CORS/);
    expect(msgs).toMatch(/Large body limit/);
    expect(msgs).toMatch(/Rate limiting disabled/);
    expect(msgs).toMatch(/\.env is not in \.gitignore|CORS_ORIGIN/);
    expect(JSON.stringify(f)).not.toContain("supersecretvalue123");
  });
  it("doctor reports errors for a non-project", () => {
    expect(runDoctorChecks(dir).some((c) => c.status === "error")).toBe(true);
  });
});

describe("info, doctor, security commands", () => {
  it("info prints and exits 0", async () => {
    expect(await run(["info"])).toBe(0);
  });
  it("doctor exits 1 outside a project and 0-or-1 inside one by errors", async () => {
    expect(await run(["doctor"])).toBe(1);
    await run(["create", "p"]);
    process.chdir(join(dir, "p"));
    expect(await run(["doctor"])).toBe(1); // dependencies not installed
  });
  it("security exits 1 on high findings, 0 when clean, --strict fails on medium", async () => {
    await run(["create", "q"]);
    process.chdir(join(dir, "q"));
    expect(await run(["security"])).toBe(0);
    writeFileSync(join(dir, "q/src/x.ts"), 'createApp({ bodyLimit: "20mb" });\n');
    expect(await run(["security"])).toBe(0);
    expect(await run(["security", "--strict"])).toBe(1);
    writeFileSync(join(dir, "q/src/y.ts"), 'const a = { origin: "*" };\n');
    expect(await run(["security"])).toBe(1);
  });
  it("build/start/test/dev fail clearly without project or install", async () => {
    for (const c of ["build", "start", "test", "dev"]) expect(await run([c]), c).toBe(1);
    await run(["create", "r"]);
    process.chdir(join(dir, "r"));
    expect(await run(["start"])).toBe(1);
    expect(await run(["build"])).toBe(1);
  });
});

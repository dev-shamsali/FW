/** git init, the first commit and the optional GitHub step of `create`. A fake `gh` is used: no test ever touches a real GitHub account. */
import { spawnSync } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FIRST_COMMIT_MESSAGE, createGithubRepo, githubCli, initGit } from "../src/git.js";
import { run } from "../src/index.js";

const win = process.platform === "win32";
const git = (cwd: string, ...args: string[]) => spawnSync("git", args, { cwd, encoding: "utf8" }).stdout.trim();

let root: string;
const saved: Record<string, string | undefined> = {};
const setEnv = (k: string, v: string | undefined) => {
  if (!(k in saved)) saved[k] = process.env[k];
  if (v === undefined) delete process.env[k];
  else process.env[k] = v;
};

/** A fake gh: records `repo create` calls in $FAKE_GH_LOG. FAKE_GH_AUTH=1 means "not signed in", FAKE_GH_FAIL=1 makes create fail. */
function fakeGh(): string {
  const p = join(root, win ? "fakegh.cmd" : "fakegh");
  writeFileSync(
    p,
    `#!/usr/bin/env node
const a = process.argv.slice(2);
const fs = require("node:fs");
if (a[0] === "--version") { console.log("gh version 0.0.0 (fake)"); process.exit(0); }
if (a[0] === "auth") process.exit(process.env.FAKE_GH_AUTH === "1" ? 1 : 0);
if (a[0] === "repo" && a[1] === "create") {
  fs.appendFileSync(process.env.FAKE_GH_LOG, JSON.stringify({ args: a, cwd: process.cwd() }) + "\\n");
  if (process.env.FAKE_GH_FAIL === "1") { console.error("GraphQL: Name already exists on this account (createRepository)"); process.exit(1); }
  console.log("https://github.com/fake-user/" + a[2]);
  process.exit(0);
}
process.exit(2);
`,
  );
  chmodSync(p, 0o755);
  return p;
}
const ghCalls = (): { args: string[]; cwd: string }[] => {
  const f = process.env["FAKE_GH_LOG"]!;
  return existsSync(f)
    ? readFileSync(f, "utf8")
        .trim()
        .split("\n")
        .filter(Boolean)
        .map((l) => JSON.parse(l) as { args: string[]; cwd: string })
    : [];
};

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "rhea-git-"));
  // Ignore the developer's own git configuration (signing, hooks, templates) so results do not depend on the machine.
  const globalConfig = join(root, "gitconfig");
  writeFileSync(globalConfig, "[user]\n\tname = Test User\n\temail = test@example.com\n[commit]\n\tgpgsign = false\n[init]\n\tdefaultBranch = trunk\n");
  setEnv("GIT_CONFIG_GLOBAL", globalConfig);
  setEnv("GIT_CONFIG_NOSYSTEM", "1");
  for (const k of ["GIT_AUTHOR_NAME", "GIT_AUTHOR_EMAIL", "GIT_COMMITTER_NAME", "GIT_COMMITTER_EMAIL", "GIT_DIR", "GIT_WORK_TREE"]) setEnv(k, undefined);
  setEnv("FAKE_GH_LOG", join(root, "gh.log"));
  setEnv("FAKE_GH_AUTH", undefined);
  setEnv("FAKE_GH_FAIL", undefined);
  setEnv("RHEA_GH", undefined);
});
afterEach(() => {
  for (const [k, v] of Object.entries(saved)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  rmSync(root, { recursive: true, force: true });
  vi.restoreAllMocks();
});

function project(name = "proj"): string {
  const d = join(root, name);
  mkdirSync(join(d, "src"), { recursive: true });
  writeFileSync(join(d, "package.json"), "{}\n");
  writeFileSync(join(d, ".gitignore"), "node_modules\n.env\n");
  writeFileSync(join(d, ".env"), "JWT_SECRET=do-not-commit\n");
  writeFileSync(join(d, "src/app.ts"), "export {};\n");
  return d;
}

describe("initGit", () => {
  it("creates a repository on main with one commit and a clean tree", () => {
    const d = project();
    expect(initGit(d, true)).toEqual({ state: "committed" });
    expect(git(d, "rev-parse", "--abbrev-ref", "HEAD")).toBe("main"); // not the machine's default branch
    expect(git(d, "log", "--format=%s")).toBe(FIRST_COMMIT_MESSAGE);
    expect(git(d, "rev-list", "--count", "HEAD")).toBe("1");
    expect(git(d, "status", "--porcelain")).toBe("");
  });

  it("never commits .env or other ignored files", () => {
    const d = project();
    initGit(d, true);
    const tracked = git(d, "ls-files").split("\n");
    expect(tracked).toContain("package.json");
    expect(tracked).toContain(".gitignore");
    expect(tracked).not.toContain(".env");
    expect(git(d, "log", "-p", "--all")).not.toContain("do-not-commit");
  });

  it("does nothing when asked not to", () => {
    const d = project();
    expect(initGit(d, false)).toEqual({ state: "skipped", reason: "disabled" });
    expect(existsSync(join(d, ".git"))).toBe(false);
  });

  it("leaves a project inside an existing repository alone", () => {
    spawnSync("git", ["init", root]);
    const d = project();
    expect(initGit(d, true)).toEqual({ state: "skipped", reason: "existing-repo" });
    expect(existsSync(join(d, ".git"))).toBe(false);
  });

  it("reports a missing git instead of failing", () => {
    setEnv("RHEA_GIT", "rhea-no-such-git");
    const d = project();
    expect(initGit(d, true)).toEqual({ state: "skipped", reason: "git-missing" });
  });

  it("keeps the repository and explains how to fix an unknown identity, without faking one", () => {
    writeFileSync(process.env["GIT_CONFIG_GLOBAL"]!, "[user]\n\tuseConfigOnly = true\n[commit]\n\tgpgsign = false\n");
    const d = project();
    const r = initGit(d, true);
    expect(r.state).toBe("initialized");
    expect(r.state === "initialized" && r.problem).toMatch(/user\.name/);
    expect(existsSync(join(d, ".git"))).toBe(true);
    expect(git(d, "rev-list", "--count", "--all")).toBe("0");
  });
});

describe.skipIf(win)("GitHub CLI step", () => {
  it("tells apart not installed, not signed in and ready", () => {
    setEnv("RHEA_GH", "rhea-no-such-gh");
    expect(githubCli(root)).toBe("not-installed");
    setEnv("RHEA_GH", fakeGh());
    setEnv("FAKE_GH_AUTH", "1");
    expect(githubCli(root)).toBe("not-signed-in");
    setEnv("FAKE_GH_AUTH", undefined);
    expect(githubCli(root)).toBe("ready");
  });

  it("creates the repository from the project folder with the exact flags, no shell involved", () => {
    setEnv("RHEA_GH", fakeGh());
    const d = project("my-api");
    const r = createGithubRepo(d, "my-api", "private");
    expect(r).toEqual({ ok: true, url: "https://github.com/fake-user/my-api" });
    expect(ghCalls()).toHaveLength(1);
    expect(ghCalls()[0]!.args).toEqual(["repo", "create", "my-api", "--private", "--source=.", "--remote=origin", "--push"]);
    expect(ghCalls()[0]!.cwd).toContain("my-api");
  });

  it("returns the reason when GitHub refuses", () => {
    setEnv("RHEA_GH", fakeGh());
    setEnv("FAKE_GH_FAIL", "1");
    const r = createGithubRepo(project(), "proj", "public");
    expect(r.ok).toBe(false);
    expect(!r.ok && r.problem).toMatch(/already exists/);
  });
});

describe.skipIf(win)("rhea create: git and GitHub", () => {
  const cwd0 = process.cwd();
  let log: string;
  beforeEach(() => {
    process.chdir(root);
    log = "";
    vi.spyOn(process.stdout, "write").mockImplementation(((s: string) => ((log += s), true)) as never);
    vi.spyOn(process.stderr, "write").mockImplementation(((s: string) => ((log += s), true)) as never);
    setEnv("RHEA_GH", fakeGh());
  });
  afterEach(() => process.chdir(cwd0));

  const files = (d: string, rel = ""): string[] =>
    readdirSync(join(d, rel), { withFileTypes: true }).flatMap((e) =>
      e.name === ".git" || e.name === "node_modules" ? [] : e.isDirectory() ? files(d, join(rel, e.name)) : [join(rel, e.name)],
    );

  it("makes every new project a git repository with one clean commit", async () => {
    expect(await run(["create", "my-api", "--yes"])).toBe(0);
    const d = join(root, "my-api");
    expect(git(d, "log", "--format=%s")).toBe(FIRST_COMMIT_MESSAGE);
    expect(git(d, "rev-parse", "--abbrev-ref", "HEAD")).toBe("main");
    expect(git(d, "status", "--porcelain")).toBe("");
    expect(git(d, "ls-files")).not.toMatch(/(^|\n)\.env(\n|$)/);
    expect(git(d, "ls-files")).toContain(".env.example");
    expect(log).toContain("Initialized a git repository and made the first commit");
    expect(ghCalls()).toEqual([]); // --yes never talks to GitHub
  });

  it("ships no placeholder files and no empty folders", async () => {
    await run(["create", "my-api", "--yes"]);
    const d = join(root, "my-api");
    expect(files(d).filter((f) => f.endsWith(".gitkeep"))).toEqual([]);
    const emptyDirs = (rel: string): string[] =>
      readdirSync(join(d, rel), { withFileTypes: true }).flatMap((e) => {
        if (!e.isDirectory() || e.name === ".git" || e.name === "node_modules") return [];
        const sub = join(rel, e.name);
        return readdirSync(join(d, sub)).length === 0 ? [sub] : emptyDirs(sub);
      });
    expect(emptyDirs("")).toEqual([]);
    for (const gone of ["src/middleware", "src/utils", "tests/unit", "tests/e2e"]) expect(existsSync(join(d, gone)), gone).toBe(false);
    expect(existsSync(join(d, "tests/integration"))).toBe(true);
  });

  it("a middleware generated later creates its folder on demand", async () => {
    await run(["create", "my-api", "--yes"]);
    process.chdir(join(root, "my-api"));
    expect(await run(["generate", "middleware", "audit-log"])).toBe(0);
    expect(existsSync(join(root, "my-api/src/middleware/audit-log.ts"))).toBe(true);
  });

  it("--no-git creates no repository", async () => {
    expect(await run(["create", "my-api", "--yes", "--no-git"])).toBe(0);
    expect(existsSync(join(root, "my-api/.git"))).toBe(false);
    expect(log).not.toContain("git repository");
  });

  it("inside an existing repository it adds no nested repository", async () => {
    spawnSync("git", ["init", root]);
    expect(await run(["create", "my-api", "--yes"])).toBe(0);
    expect(existsSync(join(root, "my-api/.git"))).toBe(false);
  });

  it("--github-private creates a private repository, adds origin and pushes, once", async () => {
    expect(await run(["create", "my-api", "--yes", "--github-private"])).toBe(0);
    expect(ghCalls().map((c) => c.args)).toEqual([["repo", "create", "my-api", "--private", "--source=.", "--remote=origin", "--push"]]);
    expect(log).toContain("https://github.com/fake-user/my-api");
    expect(log).not.toContain("Put it on GitHub:");
  });

  it("--github creates a public repository", async () => {
    await run(["create", "my-api", "--yes", "--github"]);
    expect(ghCalls()[0]!.args).toContain("--public");
  });

  it("--no-github skips the step and a plain run prints the command to do it later", async () => {
    await run(["create", "a-app", "--yes", "--no-github"]);
    expect(ghCalls()).toEqual([]);
    await run(["create", "b-app", "--yes"]);
    expect(log).toContain("gh repo create b-app --source=. --push");
  });

  it("keeps the project when the GitHub CLI is missing, signed out or refuses, and says what to do", async () => {
    setEnv("RHEA_GH", "rhea-no-such-gh");
    expect(await run(["create", "a-app", "--yes", "--github-private"])).toBe(0);
    expect(log).toMatch(/GitHub CLI \(gh\) is not installed/);

    setEnv("RHEA_GH", fakeGh());
    setEnv("FAKE_GH_AUTH", "1");
    expect(await run(["create", "b-app", "--yes", "--github-private"])).toBe(0);
    expect(log).toMatch(/not signed in. Run: gh auth login/);
    expect(ghCalls()).toEqual([]);

    setEnv("FAKE_GH_AUTH", undefined);
    setEnv("FAKE_GH_FAIL", "1");
    expect(await run(["create", "c-app", "--yes", "--github"])).toBe(0);
    expect(log).toMatch(/Could not create the GitHub repository: .*already exists/);
    for (const n of ["a-app", "b-app", "c-app"]) expect(git(join(root, n), "rev-list", "--count", "HEAD")).toBe("1");
  });

  it("rejects contradictory flags before writing anything", async () => {
    for (const flags of [
      ["--github", "--no-git"],
      ["--github", "--github-private"],
      ["--github", "--no-github"],
      ["--github-private", "--no-github"],
    ]) {
      expect(await run(["create", "bad-app", "--yes", ...flags]), flags.join(" ")).toBe(2);
      expect(existsSync(join(root, "bad-app")), flags.join(" ")).toBe(false);
    }
  });

  it("an unknown git identity still gives a working project with a clear next step", async () => {
    writeFileSync(process.env["GIT_CONFIG_GLOBAL"]!, "[user]\n\tuseConfigOnly = true\n");
    expect(await run(["create", "my-api", "--yes"])).toBe(0);
    expect(log).toMatch(/first commit was skipped/);
    expect(log).toMatch(/git config --global user\.name/);
    expect(existsSync(join(root, "my-api/package.json"))).toBe(true);
  });
});

/** Drives the interactive `create` prompts through a real pseudo-terminal (needs python3, not available on Windows). */
import { spawnSync } from "node:child_process";
import { chmodSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterAll, describe, expect, it } from "vitest";

const root = resolve(import.meta.dirname, "../..");
const bin = join(root, "packages/cli/dist/bin.js");
const py = spawnSync("python3", ["--version"], { encoding: "utf8" });
const canRun = process.platform !== "win32" && py.status === 0 && existsSync(bin);
const work = mkdtempSync(join(tmpdir(), "rhea-pty-"));
afterAll(() => rmSync(work, { recursive: true, force: true }));

// A throwaway git identity, so the first commit works the same on every machine, and no real GitHub account is ever involved.
const gitConfig = join(work, "gitconfig");
writeFileSync(gitConfig, "[user]\n\tname = Test User\n\temail = test@example.com\n[commit]\n\tgpgsign = false\n");
const ghLog = join(work, "gh.log");
const fakeGh = join(work, "fakegh");
writeFileSync(
  fakeGh,
  `#!/usr/bin/env node
const a = process.argv.slice(2);
if (a[0] === "--version") { console.log("gh version 0.0.0 (fake)"); process.exit(0); }
if (a[0] === "auth") process.exit(0);
if (a[0] === "repo" && a[1] === "create") { require("node:fs").appendFileSync(${JSON.stringify(ghLog)}, a.join(" ") + "\\n"); console.log("https://github.com/fake-user/" + a[2]); process.exit(0); }
process.exit(2);
`,
);
chmodSync(fakeGh, 0o755);

const drive = (name: string, steps: string[], gh = "rhea-no-such-gh") => {
  const env = { ...process.env, GIT_CONFIG_GLOBAL: gitConfig, GIT_CONFIG_NOSYSTEM: "1", RHEA_GH: gh };
  const r = spawnSync("python3", [join(root, "tests/e2e/pty-create.py"), work, bin, name, ...steps], { encoding: "utf8", timeout: 90_000, env });
  const exit = Number(/EXIT=(-?\d+)/.exec(r.stdout)?.[1] ?? NaN);
  return { out: r.stdout.replace(new RegExp(String.fromCharCode(27) + "\\[[0-9;?]*[A-Za-z]", "g"), ""), exit };
};

describe.skipIf(!canRun)("interactive create", () => {
  it("asks language, module system, database and install, and honours arrow keys", () => {
    // JavaScript (down), CommonJS (down), MySQL (down, down), authentication: No (down), install: No (down)
    const { out, exit } = drive("promptapp", [
      "Which language?=DE",
      "Which module system?=DE",
      "Which database?=DDE",
      "Add authentication (register, login, JWT)?=DE",
      "Install dependencies now?=DE",
    ]);
    expect(exit, out).toBe(0);
    expect(out).toContain("Which language?");
    expect(out).toContain("Which module system?");
    expect(out).toContain("Which database?");
    expect(out).toContain("developed by Shams Ali Shaikh");
    expect(out).toContain("JavaScript, CommonJS, database MySQL");
    expect(JSON.parse(readFileSync(join(work, "promptapp/rhea.config.json"), "utf8"))).toEqual({
      language: "js",
      module: "cjs",
      database: "mysql",
      auth: false,
    });
    expect(out).toContain("docker run -d --name promptapp-mysql");
    expect(out).toContain("http://localhost:5000/api/rhea");
    expect(existsSync(join(work, "promptapp/node_modules"))).toBe(false); // chose not to install
  }, 120_000);

  it("Enter on every prompt picks TypeScript, ES Modules, no database", () => {
    const { out, exit } = drive("defaults", ["Which language?=E", "Which module system?=E", "Which database?=E", "Install dependencies now?=DE"]);
    expect(exit, out).toBe(0);
    expect(JSON.parse(readFileSync(join(work, "defaults/rhea.config.json"), "utf8"))).toEqual({ language: "ts", module: "esm", database: "none", auth: false });
  }, 120_000);

  it("offers authentication after a database is chosen and writes it into the project", () => {
    // TypeScript, ES Modules, MongoDB (down), authentication: Yes (Enter), install: No (down)
    const { out, exit } = drive("authapp", [
      "Which language?=E",
      "Which module system?=E",
      "Which database?=DE",
      "Add authentication (register, login, JWT)?=E",
      "Install dependencies now?=DE",
    ]);
    expect(exit, out).toBe(0);
    expect(out).toContain("authentication");
    expect(JSON.parse(readFileSync(join(work, "authapp/rhea.config.json"), "utf8"))).toEqual({
      language: "ts",
      module: "esm",
      database: "mongodb",
      auth: true,
    });
    expect(existsSync(join(work, "authapp/src/modules/auth/auth.routes.ts"))).toBe(true);
  }, 120_000);

  it("does not ask about authentication when there is no database", () => {
    const { out, exit } = drive("noauthq", ["Which language?=E", "Which module system?=E", "Which database?=E", "Install dependencies now?=DE"]);
    expect(exit, out).toBe(0);
    expect(out).not.toContain("Add authentication");
  }, 120_000);

  it("makes the first commit, then offers to create the GitHub repository (private by default) and only if you say yes", () => {
    const gitCount = (d: string) =>
      spawnSync("git", ["rev-list", "--count", "HEAD"], { cwd: d, encoding: "utf8", env: { ...process.env, GIT_CONFIG_GLOBAL: gitConfig } }).stdout.trim();
    // TypeScript, ES Modules, no database, install: No (down). Then: GitHub? Yes (up, Enter), Visibility: Private (Enter).
    const yes = drive(
      "ghyes",
      [
        "Which language?=E",
        "Which module system?=E",
        "Which database?=E",
        "Install dependencies now?=DE",
        "Create a GitHub repository now?=UE",
        "Visibility?=E",
      ],
      fakeGh,
    );
    expect(yes.exit, yes.out).toBe(0);
    expect(yes.out).toContain("Initialized a git repository and made the first commit");
    expect(yes.out).toContain("https://github.com/fake-user/ghyes");
    expect(readFileSync(ghLog, "utf8")).toContain("repo create ghyes --private --source=. --remote=origin --push");
    expect(gitCount(join(work, "ghyes"))).toBe("1");

    // GitHub question: No (the default, just Enter). Nothing is created, the command to do it later is printed.
    const calls = readFileSync(ghLog, "utf8").trim().split("\n").length;
    const no = drive(
      "ghno",
      ["Which language?=E", "Which module system?=E", "Which database?=E", "Install dependencies now?=DE", "Create a GitHub repository now?=E"],
      fakeGh,
    );
    expect(no.exit, no.out).toBe(0);
    expect(readFileSync(ghLog, "utf8").trim().split("\n").length).toBe(calls);
    expect(no.out).toContain("gh repo create ghno --source=. --push");
    expect(gitCount(join(work, "ghno"))).toBe("1");

    // Without the GitHub CLI there is no extra question at all.
    const none = drive("ghnone", ["Which language?=E", "Which module system?=E", "Which database?=E", "Install dependencies now?=DE"]);
    expect(none.exit, none.out).toBe(0);
    expect(none.out).not.toContain("Create a GitHub repository now?");
  }, 120_000);

  it("asks for the project name when none is given, and Ctrl+C aborts without writing files", () => {
    const named = drive("-", ["Project name:=E", "Which language?=C"]);
    expect(named.out).toContain("Project name:");
    expect(named.exit).toBe(130);
    expect(existsSync(join(work, "my-api"))).toBe(false);
  }, 120_000);
});

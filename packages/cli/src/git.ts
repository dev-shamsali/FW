import { spawnSync } from "node:child_process";

/** Both can be overridden with an environment variable. The tests use that to substitute a fake `gh`. */
const GIT = (): string => process.env["RHEA_GIT"] ?? "git";
const GH = (): string => process.env["RHEA_GH"] ?? "gh";

const run = (cmd: string, args: string[], cwd: string) =>
  spawnSync(cmd, args, { cwd, encoding: "utf8", env: { ...process.env, GIT_TERMINAL_PROMPT: "0" }, timeout: 120_000 });

export const FIRST_COMMIT_MESSAGE = "Initial commit from Create Rhea";

export type GitResult =
  | { state: "committed" }
  | { state: "skipped"; reason: "disabled" | "git-missing" | "existing-repo" }
  /** The repository exists but the first commit failed (usually no user.name or user.email). */
  | { state: "initialized"; problem: string };

const firstLine = (text: string): string => text.trim().split("\n")[0] ?? "";

/**
 * Makes the new project a git repository with one commit, like create-next-app does.
 * It never touches an existing repository, never fakes an identity, and never throws: a problem is reported in the result.
 */
export function initGit(dir: string, enabled: boolean): GitResult {
  if (!enabled) return { state: "skipped", reason: "disabled" };
  const version = run(GIT(), ["--version"], dir);
  if (version.error || version.status !== 0) return { state: "skipped", reason: "git-missing" };

  // Inside another repository (for example a monorepo): leave it alone, the parent owns the history.
  const inside = run(GIT(), ["rev-parse", "--is-inside-work-tree"], dir);
  if (inside.status === 0 && inside.stdout.trim() === "true") return { state: "skipped", reason: "existing-repo" };

  let init = run(GIT(), ["init", "--initial-branch=main"], dir);
  if (init.status !== 0) {
    // Git older than 2.28 has no --initial-branch.
    init = run(GIT(), ["init"], dir);
    if (init.status === 0) run(GIT(), ["symbolic-ref", "HEAD", "refs/heads/main"], dir);
  }
  if (init.status !== 0) return { state: "skipped", reason: "git-missing" };

  const add = run(GIT(), ["add", "-A"], dir);
  if (add.status !== 0) return { state: "initialized", problem: firstLine(add.stderr) || "git add failed" };
  const commit = run(GIT(), ["commit", "-m", FIRST_COMMIT_MESSAGE], dir);
  if (commit.status !== 0) {
    const text = `${commit.stderr}\n${commit.stdout}`;
    const noIdentity = /Author identity unknown|user\.name|user\.email|unable to auto-detect/i.test(text);
    return {
      state: "initialized",
      problem: noIdentity
        ? 'git does not know who you are. Run: git config --global user.name "Your Name" and git config --global user.email "you@example.com"'
        : firstLine(commit.stderr) || "git commit failed",
    };
  }
  return { state: "committed" };
}

export type GithubCli = "ready" | "not-installed" | "not-signed-in";

/** Is the GitHub CLI installed, and is someone signed in to it? Reads no tokens, it only asks `gh auth status`. */
export function githubCli(cwd: string): GithubCli {
  const v = run(GH(), ["--version"], cwd);
  if (v.error || v.status !== 0) return "not-installed";
  return run(GH(), ["auth", "status"], cwd).status === 0 ? "ready" : "not-signed-in";
}

export type GithubResult = { ok: true; url: string | null } | { ok: false; problem: string };

/**
 * Creates the repository on the signed-in GitHub account, adds it as `origin` and pushes the first commit.
 * `name` is a validated project name (lowercase letters, digits, dot, dash, underscore), passed as one argument, never through a shell.
 */
export function createGithubRepo(dir: string, name: string, visibility: "public" | "private"): GithubResult {
  const r = run(GH(), ["repo", "create", name, `--${visibility}`, "--source=.", "--remote=origin", "--push"], dir);
  if (r.error || r.status !== 0) return { ok: false, problem: firstLine(r.stderr) || firstLine(r.stdout) || "gh repo create failed" };
  const url = /https:\/\/github\.com\/[^\s]+/.exec(`${r.stdout}\n${r.stderr}`)?.[0] ?? null;
  return { ok: true, url };
}

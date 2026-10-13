import { existsSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, relative, resolve, sep } from "node:path";
import { parseArgs } from "../args.js";
import { confirm, interactive, select, text } from "../prompts.js";
import { createGithubRepo, githubCli, initGit } from "../git.js";
import { npm } from "../proc.js";
import { projectFiles } from "../templates/project.js";
import { DEFAULT_OPTIONS, LABEL, type Database, type Language, type ModuleSystem, type ProjectOptions } from "../templates/options.js";
import { CliError, c, out } from "../ui.js";

/** All-or-nothing: every target is checked before the first byte is written, so a conflict never leaves partial output. */
export function writeFiles(root: string, files: Record<string, string>, force = false): string[] {
  const base = resolve(root);
  const targets = Object.keys(files).map((rel) => ({ rel, target: resolve(base, rel) }));
  for (const { rel, target } of targets) {
    if (target !== base && !target.startsWith(base + sep)) throw new CliError(`Refusing to write outside project: ${rel}`);
  }
  if (!force) {
    const existing = targets.filter((t) => existsSync(t.target)).map((t) => t.rel);
    if (existing.length) throw new CliError(`Nothing written. Already exists:\n  ${existing.join("\n  ")}\nUse --force to overwrite.`);
  }
  for (const { target } of targets) {
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, files[relative(base, target).split(sep).join("/")] ?? "");
  }
  return targets.map((t) => t.rel);
}

const DB_HINT: Record<Exclude<Database, "none">, (name: string) => string> = {
  mongodb: (n) => `docker run -d --name ${n}-mongo -p 27017:27017 mongo:7`,
  mysql: (n) => `docker run -d --name ${n}-mysql -p 3306:3306 -e MYSQL_ROOT_PASSWORD=password -e MYSQL_DATABASE=${n.replace(/[^A-Za-z0-9_]/g, "_")} mysql:8.4`,
};

function fromFlags(flags: Record<string, string | boolean>): Partial<ProjectOptions> {
  const o: Partial<ProjectOptions> = {};
  if (flags["ts"] && flags["js"]) throw new CliError("Choose either --ts or --js, not both.", 2);
  if (flags["esm"] && flags["cjs"]) throw new CliError("Choose either --esm or --cjs, not both.", 2);
  if (flags["ts"]) o.language = "ts";
  if (flags["js"]) o.language = "js";
  if (flags["esm"]) o.module = "esm";
  if (flags["cjs"]) o.module = "cjs";
  if (flags["db"] !== undefined) {
    const v = String(flags["db"]).toLowerCase();
    if (v !== "none" && v !== "mongodb" && v !== "mysql") throw new CliError(`Unknown --db "${flags["db"]}". Use none, mongodb or mysql.`, 2);
    o.database = v;
  }
  return o;
}

export async function create(argv: string[]): Promise<number> {
  const { positionals, flags } = parseArgs(
    argv.filter((a) => a !== "-y"),
    ["core-spec", "cli-spec", "auth-spec", "db"],
  );
  const yes = flags["yes"] === true || argv.includes("-y") || !interactive();
  const asked = fromFlags(flags);
  const gitOn = flags["no-git"] !== true;
  // --github and --github-private create the repository without asking. --no-github never asks.
  const github: "public" | "private" | "no" | undefined =
    flags["github"] === true ? "public" : flags["github-private"] === true ? "private" : flags["no-github"] === true ? "no" : undefined;
  if (flags["github"] === true && flags["github-private"] === true) throw new CliError("Choose either --github or --github-private, not both.", 2);
  if ((flags["github"] === true || flags["github-private"] === true) && flags["no-github"] === true)
    throw new CliError("--no-github cannot be combined with --github or --github-private.", 2);
  if (!gitOn && (github === "public" || github === "private")) throw new CliError("--github needs git. Remove --no-git.", 2);

  let name = positionals[0];
  if (!name) {
    if (!interactive()) throw new CliError("Missing project name. Example: rhea create my-api", 2);
    name = await text("Project name:", "my-api");
  }
  if (!/^[a-z0-9][a-z0-9._-]*$/.test(name)) throw new CliError(`Invalid project name "${name}". Use lowercase letters, digits, ".", "_" or "-".`, 2);
  const dir = resolve(process.cwd(), name);
  if (existsSync(dir) && readdirSync(dir).length > 0) throw new CliError(`Directory "${name}" already exists and is not empty.`);

  if (!yes) out(`\n${c.bold("Rhea.js")} ${c.dim("| developed by Shams Ali Shaikh")}\n`);
  const language: Language =
    asked.language ??
    (yes
      ? DEFAULT_OPTIONS.language
      : await select<Language>("Which language?", [
          { value: "ts", label: "TypeScript", hint: "recommended" },
          { value: "js", label: "JavaScript" },
        ]));
  const module: ModuleSystem =
    asked.module ??
    (yes
      ? DEFAULT_OPTIONS.module
      : await select<ModuleSystem>("Which module system?", [
          { value: "esm", label: "ES Modules", hint: "import / export, recommended" },
          { value: "cjs", label: "CommonJS", hint: "require / module.exports" },
        ]));
  const database: Database =
    asked.database ??
    (yes
      ? DEFAULT_OPTIONS.database
      : await select<Database>("Which database?", [
          { value: "none", label: "None", hint: "add one later" },
          { value: "mongodb", label: "MongoDB" },
          { value: "mysql", label: "MySQL" },
        ]));
  if (flags["auth"] === true && flags["no-auth"] === true) throw new CliError("Choose either --auth or --no-auth, not both.", 2);
  if (flags["auth"] === true && database === "none") throw new CliError("Authentication needs a database. Add --db mongodb or --db mysql.", 2);
  const auth: boolean =
    database === "none"
      ? false
      : flags["auth"] === true
        ? true
        : flags["no-auth"] === true
          ? false
          : yes
            ? DEFAULT_OPTIONS.auth
            : await confirm("Add authentication (register, login, JWT)?");
  const options: ProjectOptions = { language, module, database, auth };

  const install = flags["install"] === true ? true : flags["no-install"] === true ? false : yes ? false : await confirm("Install dependencies now?");

  const coreSpec = String(flags["core-spec"] ?? process.env["RHEA_CORE_SPEC"] ?? "^0.1.0-alpha.3");
  const cliSpec = String(flags["cli-spec"] ?? process.env["RHEA_CLI_SPEC"] ?? "^0.1.0-alpha.3");
  const authSpec = String(flags["auth-spec"] ?? process.env["RHEA_AUTH_SPEC"] ?? "^0.1.0-alpha.3");
  const files = projectFiles({ ...options, name, coreSpec, cliSpec, authSpec });
  writeFiles(dir, files);
  out(
    `${c.green("✓")} Created ${c.bold(name)}: ${LABEL.language[language]}, ${LABEL.module[module]}, database ${LABEL.database[database]}${auth ? ", authentication" : ""} (${Object.keys(files).length} files)`,
  );

  if (install) {
    out("Installing dependencies (this can take a minute)...");
    const r = npm(["install"], dir);
    if (r.status !== 0) throw new CliError(`npm install failed. Fix the error above, then run "npm install" inside ${name}.`);
    if (!existsSync(resolve(dir, "node_modules/@rheajs/core")))
      throw new CliError(`npm install finished but dependencies look incomplete. Run "npm install" again inside ${name}.`);
  }
  // After the install, so the lockfile is part of the first commit.
  const git = initGit(dir, gitOn);
  if (git.state === "committed") out(`${c.green("✓")} Initialized a git repository and made the first commit`);
  else if (git.state === "initialized")
    out(
      `${c.yellow("!")} Initialized a git repository, but the first commit was skipped: ${git.problem}\n  Then run: git add -A && git commit -m "Initial commit"`,
    );
  else if (git.reason === "git-missing") out(c.dim("  git was not found, so no repository was created. Install git, then run: git init"));
  let connected = false;
  if (git.state === "committed" && github !== "no") connected = await connectGithub(dir, name, github, yes);

  out("");
  out("Next steps:");
  out(`  cd ${name}`);
  if (!install) out("  npm install");
  if (database !== "none") out(`  ${DB_HINT[database](name)}   ${c.dim("# a local database matching .env, or edit DATABASE_URL")}`);
  out("  npm run dev");
  out("");
  if (auth) out(`Authentication is on: ${c.cyan("POST /api/auth/register")} and ${c.cyan("POST /api/auth/login")}. Your JWT_SECRET is already in .env.\n`);
  out(`Then open ${c.cyan("http://localhost:5000/api/rhea")}`);
  if (git.state === "committed" && !connected) out(c.dim(`\nPut it on GitHub: gh repo create ${name} --source=. --push`));
  return 0;
}

/** Creates the GitHub repository when asked to (flag) or when the person says yes. Returns true when the repository was created. */
async function connectGithub(dir: string, name: string, flag: "public" | "private" | undefined, yes: boolean): Promise<boolean> {
  let visibility = flag;
  if (!visibility) {
    // Only ask in an interactive session, and only if the GitHub CLI can actually do it.
    if (yes || githubCli(dir) !== "ready") return false;
    if (!(await confirm("Create a GitHub repository now?", false))) return false;
    visibility = await select<"private" | "public">("Visibility?", [
      { value: "private", label: "Private", hint: "only you and people you invite" },
      { value: "public", label: "Public", hint: "anyone can see the code" },
    ]);
  } else {
    const cli = githubCli(dir);
    if (cli !== "ready") {
      out(
        `${c.yellow("!")} ${cli === "not-installed" ? "The GitHub CLI (gh) is not installed. Get it from https://cli.github.com" : "The GitHub CLI is not signed in. Run: gh auth login"}, then: gh repo create ${name} --${visibility} --source=. --push`,
      );
      return false;
    }
  }
  out(`Creating the ${visibility} GitHub repository ${c.bold(name)}...`);
  const r = createGithubRepo(dir, name, visibility);
  if (!r.ok) {
    out(
      `${c.yellow("!")} Could not create the GitHub repository: ${r.problem}\n  Your project is ready. Try again later with: gh repo create ${name} --${visibility} --source=. --push`,
    );
    return false;
  }
  out(`${c.green("✓")} Created ${r.url ?? "the repository"} and pushed the first commit`);
  return true;
}

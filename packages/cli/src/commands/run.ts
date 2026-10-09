import { existsSync, rmSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "../args.js";
import { resolveBin, runNode } from "../proc.js";
import { requireProject } from "../project.js";
import { CliError, c, out } from "../ui.js";
import { readProjectOptions } from "./generate.js";

const envFile = (cwd: string, explicit?: string) => (explicit ? [`--env-file=${explicit}`] : existsSync(join(cwd, ".env")) ? ["--env-file=.env"] : []);

/** Same as `npm run dev`: nodemon with the project's nodemon.json. Projects from older alpha releases fall back to tsx watch. */
export async function dev(): Promise<number> {
  const cwd = process.cwd();
  requireProject(cwd);
  const env = { NODE_ENV: process.env["NODE_ENV"] ?? "development" };
  if (existsSync(join(cwd, "nodemon.json"))) return runNode([resolveBin(cwd, "nodemon")], { cwd, env });
  if (!existsSync(join(cwd, "src/server.ts"))) throw new CliError("src/server.ts not found.");
  return runNode([resolveBin(cwd, "tsx"), "watch", ...envFile(cwd), "src/server.ts"], { cwd, env });
}

export async function build(): Promise<number> {
  const cwd = process.cwd();
  requireProject(cwd);
  if (readProjectOptions(cwd).language === "js") {
    out(`JavaScript projects have no build step. Run ${c.cyan("npm start")} to run src/server.js with node.`);
    return 0;
  }
  const tsc = resolveBin(cwd, "typescript", "tsc");
  rmSync(join(cwd, "dist"), { recursive: true, force: true });
  const t0 = performance.now();
  out(c.dim("Type checking + compiling (tsc, single pass, no output on type errors)..."));
  const code = await runNode([tsc, "-p", "tsconfig.build.json"], { cwd });
  if (code !== 0) throw new CliError("Build failed. Fix the type errors above.");
  out(`${c.green("✓")} Built to dist/ in ${((performance.now() - t0) / 1000).toFixed(1)}s`);
  return 0;
}

export async function start(argv: string[]): Promise<number> {
  const { flags } = parseArgs(argv, ["env-file"]);
  const cwd = process.cwd();
  requireProject(cwd);
  const entry = readProjectOptions(cwd).language === "ts" ? "dist/server.js" : "src/server.js";
  if (!existsSync(join(cwd, entry))) throw new CliError(entry.startsWith("dist") ? `${entry} not found. Run "rhea build" first.` : `${entry} not found.`);
  // Production does not auto-load .env: inject real environment variables, or pass --env-file explicitly.
  const explicit = typeof flags["env-file"] === "string" ? flags["env-file"] : undefined;
  return runNode([...(explicit ? [`--env-file=${explicit}`] : []), entry], { cwd, env: { NODE_ENV: process.env["NODE_ENV"] ?? "production" } });
}

export async function test(argv: string[]): Promise<number> {
  const cwd = process.cwd();
  requireProject(cwd);
  const vitest = resolveBin(cwd, "vitest");
  return runNode([vitest, "run", ...argv], { cwd });
}

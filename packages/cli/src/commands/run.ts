import { existsSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "../args.js";
import { resolveBin, runNode } from "../proc.js";
import { requireProject } from "../project.js";
import { CliError, c, out } from "../ui.js";

const envFile = (cwd: string, explicit?: string) => (explicit ? [`--env-file=${explicit}`] : existsSync(join(cwd, ".env")) ? ["--env-file=.env"] : []);

export async function dev(): Promise<number> {
  const cwd = process.cwd();
  requireProject(cwd);
  if (!existsSync(join(cwd, "src/server.ts"))) throw new CliError("src/server.ts not found.");
  const tsx = resolveBin(cwd, "tsx");
  return runNode([tsx, "watch", ...envFile(cwd), "src/server.ts"], { cwd, env: { NODE_ENV: process.env["NODE_ENV"] ?? "development" } });
}

export async function build(): Promise<number> {
  const cwd = process.cwd();
  requireProject(cwd);
  const tsc = resolveBin(cwd, "typescript", "tsc");
  const { rmSync } = await import("node:fs");
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
  if (!existsSync(join(cwd, "dist/server.js"))) throw new CliError('dist/server.js not found. Run "rhea build" first.');
  // Production does not auto-load .env: inject real environment variables, or pass --env-file explicitly.
  const explicit = typeof flags["env-file"] === "string" ? flags["env-file"] : undefined;
  return runNode([...(explicit ? [`--env-file=${explicit}`] : []), "dist/server.js"], { cwd, env: { NODE_ENV: process.env["NODE_ENV"] ?? "production" } });
}

export async function test(argv: string[]): Promise<number> {
  const cwd = process.cwd();
  requireProject(cwd);
  const vitest = resolveBin(cwd, "vitest");
  return runNode([vitest, "run", ...argv], { cwd });
}

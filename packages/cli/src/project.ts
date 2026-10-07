import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { CliError } from "./ui.js";

export function requireProject(cwd: string): void {
  if (!existsSync(join(cwd, "package.json")))
    throw new CliError('No package.json here. Run this inside a Rhea.js project (create one with "rhea create <name>").');
}

/** Recursively list files under dir, skipping heavy/generated dirs and large files. */
export function walk(dir: string, exts: string[], out: string[] = []): string[] {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === "dist" || name === ".git" || name === "coverage") continue;
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, exts, out);
    else if (exts.some((e) => name.endsWith(e)) && st.size < 1_000_000) out.push(p);
  }
  return out;
}

export const read = (p: string): string => readFileSync(p, "utf8");

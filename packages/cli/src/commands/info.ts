import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { npm } from "../proc.js";
import { c, out } from "../ui.js";
import { VERSION } from "../version.js";

function depVersion(cwd: string, pkg: string): string {
  try {
    const p = createRequire(join(cwd, "package.json")).resolve(`${pkg}/package.json`);
    return (JSON.parse(readFileSync(p, "utf8")) as { version: string }).version;
  } catch {
    return c.dim("not installed");
  }
}

export async function info(): Promise<number> {
  const cwd = process.cwd();
  out(c.bold("Rhea.js") + c.dim("  made by Shams Ali Shaikh"));
  out(`  cli         ${VERSION}`);
  out(`  core        ${depVersion(cwd, "@rheajs/core")}`);
  out(`  node        ${process.versions.node}`);
  out(`  npm         ${npm(["--version"], cwd, "pipe").stdout?.trim() || c.dim("not found")}`);
  out(`  typescript  ${depVersion(cwd, "typescript")}`);
  out(`  platform    ${process.platform} ${process.arch}`);
  return 0;
}

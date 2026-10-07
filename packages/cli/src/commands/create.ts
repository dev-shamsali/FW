import { existsSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, relative, resolve, sep } from "node:path";
import { appFiles } from "../templates/app.js";
import { parseArgs } from "../args.js";
import { npm } from "../proc.js";
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

export async function create(argv: string[]): Promise<number> {
  const { positionals, flags } = parseArgs(argv, ["core-spec", "cli-spec"]);
  const name = positionals[0];
  if (!name) throw new CliError("Missing project name. Example: rhea create my-api", 2);
  if (!/^[a-z0-9][a-z0-9._-]*$/.test(name)) throw new CliError(`Invalid project name "${name}". Use lowercase letters, digits, ".", "_" or "-".`, 2);
  const dir = resolve(process.cwd(), name);
  if (existsSync(dir) && readdirSync(dir).length > 0) throw new CliError(`Directory "${name}" already exists and is not empty.`);

  const coreSpec = String(flags["core-spec"] ?? process.env["RHEA_CORE_SPEC"] ?? "^0.1.0-alpha.0");
  const cliSpec = String(flags["cli-spec"] ?? process.env["RHEA_CLI_SPEC"] ?? "^0.1.0-alpha.0");
  const files = appFiles({ name, coreSpec, cliSpec });
  writeFiles(dir, files);
  out(`${c.green("✓")} Created ${c.bold(name)} (${Object.keys(files).length} files)`);

  if (flags["install"]) {
    out("Installing dependencies...");
    const r = npm(["install"], dir);
    if (r.status !== 0) throw new CliError("npm install failed.");
  }
  out("");
  out("Next steps:");
  out(`  cd ${name}`);
  if (!flags["install"]) out("  npm install");
  out("  npm run dev");
  return 0;
}

import { existsSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { appFiles } from "../templates/app.js";
import { parseArgs } from "../args.js";
import { npm } from "../proc.js";
import { CliError, c, out } from "../ui.js";

export function writeFiles(root: string, files: Record<string, string>, force = false): string[] {
  const written: string[] = [];
  for (const [rel, content] of Object.entries(files)) {
    const target = resolve(root, rel);
    if (!target.startsWith(resolve(root))) throw new CliError(`Refusing to write outside project: ${rel}`);
    if (existsSync(target) && !force) throw new CliError(`${rel} already exists. Use --force to overwrite.`);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, content);
    written.push(rel);
  }
  return written;
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

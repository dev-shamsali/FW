import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "../args.js";
import { parseName } from "../names.js";
import { requireProject } from "../project.js";
import { moduleFiles, registration, singleFile } from "../templates/module.js";
import { CliError, out, ok, warn } from "../ui.js";
import { writeFiles } from "./create.js";

const KINDS = ["module", "controller", "service", "route", "middleware", "validator"];

export async function generate(argv: string[]): Promise<number> {
  const { positionals, flags } = parseArgs(argv);
  const [kind, rawName] = positionals;
  if (!kind || !KINDS.includes(kind)) throw new CliError(`Usage: rhea generate <${KINDS.join("|")}> <name>`, 2);
  const cwd = process.cwd();
  requireProject(cwd);
  const n = parseName(rawName);
  const force = flags["force"] === true;

  const files = kind === "module" ? moduleFiles(n) : singleFile(kind, n);
  const written = writeFiles(cwd, files, force);
  for (const f of written) ok(`created ${f}`);

  if (kind === "module") {
    const indexPath = join(cwd, "src/modules/index.ts");
    const reg = registration(n);
    let done = false;
    if (existsSync(indexPath)) {
      const src = readFileSync(indexPath, "utf8");
      if (src.includes("// rhea:imports") && src.includes("// rhea:modules") && !src.includes(reg.importLine)) {
        writeFileSync(indexPath, src.replace("// rhea:imports", `${reg.importLine}\n// rhea:imports`).replace("  // rhea:modules", `${reg.entryLine}\n  // rhea:modules`));
        ok("registered in src/modules/index.ts");
        done = true;
      } else if (src.includes(reg.importLine)) done = true;
    }
    if (!done) {
      warn("Could not auto-register. Add to src/modules/index.ts:");
      out(`  ${reg.importLine}\n${reg.entryLine}`);
    }
  }
  return 0;
}

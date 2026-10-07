import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "../args.js";
import { isReservedWord, parseName } from "../names.js";
import { requireProject } from "../project.js";
import { PART_DEPS, moduleFiles, middlewareFile, partFile, registration, type Part } from "../templates/module.js";
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

  if (kind === "middleware" && isReservedWord(n.camel))
    throw new CliError(`"${n.kebab}" is a reserved word and cannot be a function name. Choose another name (for example "${n.kebab}-guard").`, 2);
  if (kind === "module" && !force) {
    const indexPath = join(cwd, "src/modules/index.ts");
    const reg = registration(n);
    if (existsSync(indexPath)) {
      const src = readFileSync(indexPath, "utf8");
      if (src.includes(`${n.camel}Router`) || src.includes(`path: "/${n.kebab}"`))
        throw new CliError(`A module named "${n.kebab}" is already registered in src/modules/index.ts. Nothing written.`);
    }
    void reg;
  }
  const PART_OF: Record<string, Part> = { controller: "controller", service: "service", route: "routes", validator: "schema" };
  let files: Record<string, string>;
  if (kind === "module") files = moduleFiles(n);
  else if (kind === "middleware") files = middlewareFile(n);
  else {
    // A part imports other parts. Create any that are missing, never touching ones that already exist.
    const part = PART_OF[kind]!;
    const [targetPath, targetContent] = partFile(part, n);
    files = { [targetPath]: targetContent };
    for (const dep of PART_DEPS[part]) {
      const [p, c] = partFile(dep, n);
      if (existsSync(join(cwd, p))) continue;
      files[p] = c;
    }
  }
  const written = writeFiles(cwd, files, force);
  for (const f of written) ok(`created ${f}`);
  if (kind === "route") warn(`Register it in src/modules/index.ts: ${registration(n).importLine}`);

  if (kind === "module") {
    const indexPath = join(cwd, "src/modules/index.ts");
    const reg = registration(n);
    let done = false;
    if (existsSync(indexPath)) {
      const src = readFileSync(indexPath, "utf8");
      if (src.includes("// rhea:imports") && src.includes("// rhea:modules") && !src.includes(reg.importLine)) {
        writeFileSync(
          indexPath,
          src.replace("// rhea:imports", `${reg.importLine}\n// rhea:imports`).replace("  // rhea:modules", `${reg.entryLine}\n  // rhea:modules`),
        );
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

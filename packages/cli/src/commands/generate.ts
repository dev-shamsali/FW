import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "../args.js";
import { isReservedWord, parseName } from "../names.js";
import { requireProject } from "../project.js";
import { CONFIG_FILE, DEFAULT_OPTIONS, parseConfig, type ProjectOptions } from "../templates/options.js";
import { middlewareFile, moduleFiles, partDeps, partFile, registration, type Part } from "../templates/parts.js";
import { CliError, out, ok, warn } from "../ui.js";
import { writeFiles } from "./create.js";

const KINDS = ["module", "controller", "service", "route", "middleware", "validator"];

/** Reads rhea.config.json so generated code matches the project (TypeScript/JavaScript, ESM/CommonJS). Older projects default to TypeScript + ESM. */
export function readProjectOptions(cwd: string): ProjectOptions {
  const p = join(cwd, CONFIG_FILE);
  if (!existsSync(p)) return DEFAULT_OPTIONS;
  try {
    return parseConfig(readFileSync(p, "utf8"));
  } catch {
    throw new CliError(`${CONFIG_FILE} is not valid JSON.`);
  }
}

export async function generate(argv: string[]): Promise<number> {
  const { positionals, flags } = parseArgs(argv);
  const [kind, rawName] = positionals;
  if (!kind || !KINDS.includes(kind)) throw new CliError(`Usage: rhea generate <${KINDS.join("|")}> <name>`, 2);
  const cwd = process.cwd();
  requireProject(cwd);
  const n = parseName(rawName);
  const force = flags["force"] === true;
  const o = readProjectOptions(cwd);
  const ext = o.language === "ts" ? "ts" : "js";

  if (kind === "middleware" && isReservedWord(n.camel))
    throw new CliError(`"${n.kebab}" is a reserved word and cannot be a function name. Choose another name (for example "${n.kebab}-guard").`, 2);
  const indexPath = join(cwd, `src/modules/index.${ext}`);
  if (kind === "module" && !force && existsSync(indexPath)) {
    const src = readFileSync(indexPath, "utf8");
    if (src.includes(`${n.camel}Router`) || src.includes(`path: "/${n.kebab}"`))
      throw new CliError(`A module named "${n.kebab}" is already registered in src/modules/index.${ext}. Nothing written.`);
  }

  const PART_OF: Record<string, Part> = { controller: "controller", service: "service", route: "routes", validator: "schema" };
  let files: Record<string, string>;
  if (kind === "module") files = moduleFiles(n, o);
  else if (kind === "middleware") files = middlewareFile(n, o);
  else {
    // A part imports other parts. Create any that are missing, never touching ones that already exist.
    const part = PART_OF[kind]!;
    const [targetPath, targetContent] = partFile(part, n, o);
    files = { [targetPath]: targetContent };
    for (const dep of partDeps(part, o)) {
      const [p, c] = partFile(dep, n, o);
      if (!existsSync(join(cwd, p))) files[p] = c;
    }
  }

  for (const f of writeFiles(cwd, files, force)) ok(`created ${f}`);

  if (kind === "module" || kind === "route") {
    const reg = registration(o, n);
    let done = false;
    if (existsSync(indexPath)) {
      const src = readFileSync(indexPath, "utf8");
      if (src.includes(reg.importLine)) done = true;
      else if (src.includes("// rhea:imports") && src.includes("// rhea:modules")) {
        writeFileSync(
          indexPath,
          src.replace("// rhea:imports", `${reg.importLine}\n// rhea:imports`).replace("  // rhea:modules", `${reg.entryLine}\n  // rhea:modules`),
        );
        ok(`registered in src/modules/index.${ext}`);
        done = true;
      }
    }
    if (!done) {
      warn(`Could not auto-register. Add to src/modules/index.${ext}:`);
      out(`  ${reg.importLine}\n${reg.entryLine}`);
    }
  }
  return 0;
}

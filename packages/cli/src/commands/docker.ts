import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "../args.js";
import { requireProject } from "../project.js";
import { dockerFiles } from "../templates/docker.js";
import { ok } from "../ui.js";
import { writeFiles } from "./create.js";
import { readProjectOptions } from "./generate.js";

export async function docker(argv: string[]): Promise<number> {
  const { flags } = parseArgs(argv);
  const cwd = process.cwd();
  requireProject(cwd);
  const name = (JSON.parse(readFileSync(join(cwd, "package.json"), "utf8")) as { name?: string }).name ?? "app";
  for (const f of writeFiles(cwd, dockerFiles(readProjectOptions(cwd), name), flags["force"] === true)) ok(`created ${f}`);
  return 0;
}

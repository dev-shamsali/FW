import { parseArgs } from "../args.js";
import { requireProject } from "../project.js";
import { dockerFiles } from "../templates/app.js";
import { ok } from "../ui.js";
import { writeFiles } from "./create.js";

export async function docker(argv: string[]): Promise<number> {
  const { flags } = parseArgs(argv);
  requireProject(process.cwd());
  for (const f of writeFiles(process.cwd(), dockerFiles(), flags["force"] === true)) ok(`created ${f}`);
  return 0;
}

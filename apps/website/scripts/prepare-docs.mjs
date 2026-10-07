// Builds the docs site and copies it to public/docs so the website deploys as one static bundle.
import { spawnSync } from "node:child_process";
import { cpSync, mkdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const docs = join(here, "../../docs");
const r = spawnSync(process.execPath, ["build.mjs"], { cwd: docs, stdio: "inherit" });
if (r.status !== 0) process.exit(r.status ?? 1);
const target = join(here, "../public/docs");
rmSync(target, { recursive: true, force: true });
mkdirSync(target, { recursive: true });
cpSync(join(docs, "dist"), target, { recursive: true });

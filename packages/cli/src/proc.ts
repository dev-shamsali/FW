import { spawn, spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { CliError } from "./ui.js";

/** Resolve a dependency's JS bin entry from the project dir. Runs via node, so no .cmd shims on Windows. */
export function resolveBin(cwd: string, pkg: string, bin = pkg): string {
  try {
    const req = createRequire(join(cwd, "package.json"));
    const pj = req.resolve(`${pkg}/package.json`);
    const meta = JSON.parse(readFileSync(pj, "utf8")) as { bin?: string | Record<string, string> };
    const rel = typeof meta.bin === "string" ? meta.bin : meta.bin?.[bin];
    if (!rel) throw new Error("no bin");
    return join(dirname(pj), rel);
  } catch {
    throw new CliError(`Cannot find "${pkg}" in this project. Run "npm install" first.`);
  }
}

export function runNode(args: string[], opts: { cwd: string; env?: NodeJS.ProcessEnv }): Promise<number> {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, args, { cwd: opts.cwd, stdio: "inherit", env: { ...process.env, ...opts.env } });
    // Forward termination signals so the child can shut down gracefully instead of being orphaned.
    const forward = (sig: NodeJS.Signals) => () => void child.kill(sig);
    const handlers = (["SIGINT", "SIGTERM", "SIGHUP"] as const).map((sig) => [sig, forward(sig)] as const);
    for (const [sig, h] of handlers) process.on(sig, h);
    const done = (code: number) => {
      for (const [sig, h] of handlers) process.off(sig, h);
      resolve(code);
    };
    child.on("error", () => done(1));
    child.on("close", (code, signal) => done(code ?? (signal ? 1 : 0)));
  });
}

export function npm(args: string[], cwd: string, stdio: "inherit" | "pipe" = "inherit") {
  return spawnSync("npm", args, { cwd, stdio, shell: process.platform === "win32", encoding: "utf8" });
}

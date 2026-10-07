import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { npm } from "../proc.js";
import { read, walk } from "../project.js";
import { c, fail, ok, out, warn } from "../ui.js";

type Check = { status: "ok" | "warn" | "error"; label: string; hint?: string };

export function runDoctorChecks(cwd: string): Check[] {
  const checks: Check[] = [];
  const add = (status: Check["status"], label: string, hint?: string) => checks.push({ status, label, ...(hint ? { hint } : {}) });

  const major = Number(process.versions.node.split(".")[0]);
  major >= 20 ? add("ok", `Node.js ${process.versions.node}`) : add("error", `Node.js ${process.versions.node}`, "Rhea.js requires Node.js 20 or newer.");

  const npmV = npm(["--version"], cwd, "pipe");
  npmV.status === 0 ? add("ok", `npm ${npmV.stdout.trim()}`) : add("error", "npm", "npm not found on PATH.");

  const pkgPath = join(cwd, "package.json");
  if (!existsSync(pkgPath)) {
    add("error", "package.json", "Run inside a Rhea.js project.");
    return checks;
  }
  const pkg = JSON.parse(read(pkgPath)) as { type?: string; dependencies?: Record<string, string> };
  pkg.type === "module" ? add("ok", "ES modules") : add("warn", "package.json is not type: module", 'Add "type": "module".');

  const req = createRequire(pkgPath);
  try {
    req.resolve("typescript/package.json");
    add("ok", "TypeScript installed");
  } catch {
    add("error", "TypeScript not installed", 'Run "npm install".');
  }
  pkg.dependencies?.["@rheajs/core"] ? add("ok", "@rheajs/core (security middleware, error handling, rate limiting)") : add("error", "@rheajs/core missing", "Security defaults come from core.");

  existsSync(join(cwd, "tsconfig.json")) && existsSync(join(cwd, "tsconfig.build.json")) ? add("ok", "Build configuration") : add("error", "tsconfig.json / tsconfig.build.json missing");
  existsSync(join(cwd, ".env")) ? add("ok", ".env present") : add("warn", ".env missing", "Copy .env.example to .env for local development.");
  existsSync(join(cwd, ".env.example")) ? add("ok", ".env.example present") : add("warn", ".env.example missing");

  const src = walk(join(cwd, "src"), [".ts"]).map(read).join("\n");
  /enabled:\s*false/.test(src) && /rateLimit/.test(src) ? add("warn", "Rate limiting disabled in source", "Re-enable unless a gateway enforces limits.") : add("ok", "Rate limiting");
  /createApp\s*\(/.test(src) ? add("ok", "App built with createApp") : add("warn", "createApp not used", "Security defaults only apply when using createApp.");

  const envText = [".env", ".env.production"].map((f) => (existsSync(join(cwd, f)) ? readFileSync(join(cwd, f), "utf8") : "")).join("\n");
  /^CORS_ORIGIN=.*\*/m.test(envText) ? add("warn", "CORS_ORIGIN contains *", "Production CORS configuration requires review.") : add("ok", "CORS configuration");
  return checks;
}

export async function doctor(): Promise<number> {
  out(c.bold("Rhea.js Doctor"));
  out();
  const checks = runDoctorChecks(process.cwd());
  for (const k of checks) {
    (k.status === "ok" ? ok : k.status === "warn" ? warn : fail)(k.label + (k.hint ? c.dim(` — ${k.hint}`) : ""));
  }
  const errors = checks.filter((k) => k.status === "error").length;
  const warnings = checks.filter((k) => k.status === "warn").length;
  out();
  out(`${errors} error${errors === 1 ? "" : "s"}, ${warnings} warning${warnings === 1 ? "" : "s"}`);
  return errors ? 1 : 0;
}

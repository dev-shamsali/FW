import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { npm } from "../proc.js";
import { read, walk } from "../project.js";
import { c, fail, ok, out, warn } from "../ui.js";
import { readProjectOptions } from "./generate.js";

type Check = { status: "ok" | "warn" | "error"; label: string; hint?: string };

export function runDoctorChecks(cwd: string): Check[] {
  const checks: Check[] = [];
  const add = (status: Check["status"], label: string, hint?: string) => checks.push({ status, label, ...(hint ? { hint } : {}) });

  const [major = 0, minor = 0] = process.versions.node.split(".").map(Number);
  if (major > 20 || (major === 20 && minor >= 19)) add("ok", `Node.js ${process.versions.node}`);
  else add("error", `Node.js ${process.versions.node}`, "Generated projects need Node.js 20.19 or newer.");

  const npmV = npm(["--version"], cwd, "pipe");
  if (npmV.status === 0) add("ok", `npm ${npmV.stdout.trim()}`);
  else add("error", "npm", "npm not found on PATH.");

  const pkgPath = join(cwd, "package.json");
  if (!existsSync(pkgPath)) {
    add("error", "package.json", "Run inside a Rhea.js project.");
    return checks;
  }
  const pkg = JSON.parse(read(pkgPath)) as { type?: string; dependencies?: Record<string, string> };
  const opts = readProjectOptions(cwd);
  add("ok", `${opts.language === "ts" ? "TypeScript" : "JavaScript"}, ${opts.module === "esm" ? "ES modules" : "CommonJS"}`);
  if ((opts.module === "esm") !== (pkg.type === "module"))
    add("warn", `package.json "type" does not match rhea.config.json (${opts.module})`, 'Use "type": "module" for ESM, "commonjs" for CommonJS.');

  if (!existsSync(join(cwd, "node_modules"))) add("error", "Dependencies are not installed", 'Run "npm install" in the project folder.');
  else if (opts.language === "ts") {
    try {
      createRequire(pkgPath).resolve("typescript/package.json");
      add("ok", "TypeScript installed");
    } catch {
      add("error", "TypeScript not installed", 'Run "npm install".');
    }
  }

  if (pkg.dependencies?.["@rheajs/core"]) add("ok", "@rheajs/core (security middleware, error handling, rate limiting)");
  else add("error", "@rheajs/core missing", "Security defaults come from core.");

  if (opts.language === "ts") {
    if (existsSync(join(cwd, "tsconfig.json")) && existsSync(join(cwd, "tsconfig.build.json"))) add("ok", "Build configuration");
    else add("error", "tsconfig.json / tsconfig.build.json missing");
  }
  const envLocal = existsSync(join(cwd, ".env")) ? readFileSync(join(cwd, ".env"), "utf8") : "";
  if (envLocal) add("ok", ".env present");
  else add("warn", ".env missing", "Copy .env.example to .env for local development.");
  if (existsSync(join(cwd, ".env.example"))) add("ok", ".env.example present");
  else add("warn", ".env.example missing");

  if (opts.database !== "none") {
    if (/^DATABASE_URL=\S+/m.test(envLocal)) add("ok", `DATABASE_URL set for ${opts.database}`);
    else add("warn", "DATABASE_URL missing in .env", `Required for ${opts.database}. Set it, or export it before starting.`);
  }

  if (opts.auth) {
    const m = /^JWT_SECRET=(\S*)/m.exec(envLocal);
    if (m && m[1] && m[1].length >= 32) add("ok", "JWT_SECRET set");
    else add("error", "JWT_SECRET missing or shorter than 32 characters", "Generate one with: openssl rand -base64 48");
  }

  const src = walk(join(cwd, "src"), [".ts", ".js", ".mjs"]).map(read).join("\n");
  if (/enabled:\s*false/.test(src) && /rateLimit/.test(src)) add("warn", "Rate limiting disabled in source", "Re-enable unless a gateway enforces limits.");
  else add("ok", "Rate limiting");
  if (/createApp\s*\(/.test(src)) add("ok", "App built with createApp");
  else add("warn", "createApp not used", "Security defaults only apply when using createApp.");

  const envText = [".env", ".env.production"].map((f) => (existsSync(join(cwd, f)) ? readFileSync(join(cwd, f), "utf8") : "")).join("\n");
  if (/^CORS_ORIGIN=.*\*/m.test(envText)) add("warn", "CORS_ORIGIN contains *", "Production CORS configuration requires review.");
  else add("ok", "CORS configuration");
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

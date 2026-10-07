import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { parseArgs } from "../args.js";
import { npm } from "../proc.js";
import { read, requireProject, walk } from "../project.js";
import { c, fail, ok, out, warn } from "../ui.js";

export interface Finding {
  severity: "high" | "medium" | "low";
  message: string;
  where?: string;
}

const SECRET_PATTERNS: [RegExp, string][] = [
  [/-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/, "private key"],
  [/\bAKIA[0-9A-Z]{16}\b/, "AWS access key id"],
  [/\bghp_[A-Za-z0-9]{36}\b/, "GitHub token"],
  [/\bnpm_[A-Za-z0-9]{36}\b/, "npm token"],
  [/(?:secret|password|passwd|api[_-]?key|token)["']?\s*[:=]\s*["'][^"'\s]{8,}["']/i, "hardcoded credential"],
];

function bytes(v: string): number {
  const m = /^(\d+(?:\.\d+)?)\s*(b|kb|mb|gb)?$/i.exec(v.trim());
  if (!m) return 0;
  const mult = { b: 1, kb: 1024, mb: 1024 ** 2, gb: 1024 ** 3 }[(m[2] ?? "b").toLowerCase() as "b"];
  return Number(m[1]) * mult;
}

/** Static checks only. Never prints secret values, only file:line. */
export function scanProject(cwd: string): Finding[] {
  const f: Finding[] = [];
  const rel = (p: string) => relative(cwd, p);

  const files = walk(join(cwd, "src"), [".ts", ".js", ".json"]);
  const sources = files.map(read);
  files.forEach((file, fi) => {
    const lines = sources[fi]!.split("\n");
    lines.forEach((line, i) => {
      const where = `${rel(file)}:${i + 1}`;
      for (const [re, label] of SECRET_PATTERNS) if (re.test(line)) f.push({ severity: "high", message: `Possible ${label} in source`, where });
      if (/origin\s*:\s*(?:\[\s*)?["']\*["']/.test(line)) f.push({ severity: "high", message: 'Wildcard CORS origin "*"', where });
      if (/rateLimit\s*:\s*\{[^}]*enabled\s*:\s*false/.test(line)) f.push({ severity: "medium", message: "Rate limiting disabled", where });
      const bl = /bodyLimit\s*:\s*["']([^"']+)["']/.exec(line);
      if (bl && bytes(bl[1]!) > 1024 ** 2) f.push({ severity: "medium", message: `Large body limit (${bl[1]})`, where });
      if (/secure\s*:\s*false/.test(line) || /httpOnly\s*:\s*false/.test(line)) f.push({ severity: "medium", message: "Insecure cookie option", where });
      if (/\bhelmet\b.*disable|contentSecurityPolicy\s*:\s*false/.test(line))
        f.push({ severity: "medium", message: "Security header protection disabled", where });
      if (/x-powered-by["']?\s*[,)]\s*["']?(true|enable)/i.test(line)) f.push({ severity: "low", message: "x-powered-by enabled", where });
    });
  });
  const all = sources.join("\n");
  if (/express\(\)/.test(all) && !/createApp\s*\(/.test(all)) {
    f.push({ severity: "medium", message: "Raw express() used without createApp: Rhea.js security defaults not applied" });
  }

  for (const envf of [".env", ".env.production", ".env.example"]) {
    const p = join(cwd, envf);
    if (existsSync(p) && /^CORS_ORIGIN=.*\*/m.test(readFileSync(p, "utf8"))) f.push({ severity: "high", message: "CORS_ORIGIN contains *", where: envf });
  }
  const gi = join(cwd, ".gitignore");
  if (existsSync(join(cwd, ".env")) && !(existsSync(gi) && /^\.env\b/m.test(readFileSync(gi, "utf8"))))
    f.push({ severity: "high", message: ".env is not in .gitignore", where: ".gitignore" });
  if (existsSync(join(cwd, ".git"))) {
    const g = spawnSync("git", ["ls-files", "--error-unmatch", ".env"], { cwd, stdio: "ignore" });
    if (g.status === 0) f.push({ severity: "high", message: ".env is tracked by git", where: ".env" });
  }
  return f;
}

function audit(cwd: string): Finding[] {
  const r = npm(["audit", "--json"], cwd, "pipe");
  try {
    const j = JSON.parse(r.stdout) as { metadata?: { vulnerabilities?: Record<string, number> }; error?: unknown };
    const v = j.metadata?.vulnerabilities;
    if (!v) return [{ severity: "low", message: "npm audit could not run (offline or no lockfile)" }];
    const out: Finding[] = [];
    if ((v["critical"] ?? 0) + (v["high"] ?? 0) > 0)
      out.push({ severity: "high", message: `Dependencies: ${v["critical"] ?? 0} critical, ${v["high"] ?? 0} high vulnerabilities` });
    if ((v["moderate"] ?? 0) > 0) out.push({ severity: "medium", message: `Dependencies: ${v["moderate"]} moderate vulnerabilities` });
    if ((v["low"] ?? 0) > 0) out.push({ severity: "low", message: `Dependencies: ${v["low"]} low vulnerabilities` });
    return out;
  } catch {
    return [{ severity: "low", message: "npm audit output unreadable" }];
  }
}

export async function security(argv: string[]): Promise<number> {
  const { flags } = parseArgs(argv);
  const cwd = process.cwd();
  requireProject(cwd);
  out(c.bold("Rhea.js Security Scan"));
  out();
  const findings = [...scanProject(cwd), ...(flags["audit"] ? audit(cwd) : [])];
  if (!findings.length) ok("No issues found by the static checks");
  for (const x of findings) {
    const line = `${x.message}${x.where ? c.dim(` (${x.where})`) : ""}`;
    (x.severity === "high" ? fail : warn)(`[${x.severity}] ${line}`);
  }
  if (!flags["audit"]) out(c.dim("\nDependency audit skipped. Run with --audit (needs network)."));
  out(c.dim("\nThis is a basic static check, not a penetration test or a security audit. A clean result does not guarantee security."));
  const high = findings.filter((x) => x.severity === "high").length;
  const med = findings.filter((x) => x.severity === "medium").length;
  return high || (flags["strict"] && med) ? 1 : 0;
}

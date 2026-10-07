// Release preflight. Usage: node scripts/check-release.mjs [--tag vX.Y.Z] [--strict] [--no-install]
// Inspects exactly what would be published. Never publishes anything.
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const strict = args.includes("--strict");
const tag = args.includes("--tag") ? args[args.indexOf("--tag") + 1] : null;
const errors = [];
const warns = [];
const fail = (m) => errors.push(m);
const warn = (m) => warns.push(m);
const win = process.platform === "win32";
const run = (cmd, a, cwd) => spawnSync(cmd, a, { cwd, encoding: "utf8", shell: win, maxBuffer: 64 * 1024 * 1024 });

const dirs = ["core", "cli", "create-rhea"];
const pkgs = dirs.map((d) => ({ dir: join(root, "packages", d), json: JSON.parse(readFileSync(join(root, "packages", d, "package.json"), "utf8")) }));

// 1. metadata
const version = pkgs[0].json.version;
for (const { json: j } of pkgs) {
  if (j.version !== version) fail(`${j.name}: version ${j.version} differs from ${version}`);
  if (j.private) fail(`${j.name}: private is true`);
  if (j.license !== "MIT") fail(`${j.name}: license must be MIT`);
  if (j.type !== "module") fail(`${j.name}: type must be module`);
  if (!j.engines?.node) fail(`${j.name}: engines.node missing`);
  if (!j.description || !j.keywords?.length) fail(`${j.name}: description/keywords missing`);
  if (!j.repository?.url || !j.bugs?.url) (strict ? fail : warn)(`${j.name}: repository/bugs missing. Run: node scripts/set-repo.mjs <owner>/<repo>`);
  if (JSON.stringify(j).includes("PLACEHOLDER")) fail(`${j.name}: placeholder text in package.json`);
}
const cliDep = pkgs[2].json.dependencies?.["@rheajs/cli"];
if (cliDep !== version) fail(`create-rhea depends on @rheajs/cli@${cliDep}, expected ${version}`);
if (tag && tag !== `v${version}`) fail(`tag ${tag} does not match package version v${version}`);
const changelog = readFileSync(join(root, "CHANGELOG.md"), "utf8");
if (!changelog.includes(`[${version}]`)) fail(`CHANGELOG.md has no entry for ${version}`);
const cfg = JSON.parse(readFileSync(join(root, "site.config.json"), "utf8"));
if (!cfg.version || !version.startsWith(cfg.version.replace("-alpha", ""))) warn(`site.config.json version (${cfg.version}) differs from ${version}`);

// 2. what would be published
const allowed = (p) => p === "package.json" || p === "README.md" || p === "LICENSE" || /^dist\/.+\.(js|d\.ts)$/.test(p);
const SECRETS = [
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
  /\bAKIA[0-9A-Z]{16}\b/,
  /\bghp_[A-Za-z0-9]{36}\b/,
  /\bnpm_[A-Za-z0-9]{36}\b/,
  /(?:secret|password|api[_-]?key|token)["']?\s*[:=]\s*["'][A-Za-z0-9+/=_-]{16,}["']/i,
];
const tarDir = mkdtempSync(join(tmpdir(), "rhea-release-"));
const tarballs = [];
for (const { dir, json: j } of pkgs) {
  const r = run("npm", ["pack", "--json", "--pack-destination", tarDir], dir);
  if (r.status !== 0) {
    fail(`${j.name}: npm pack failed\n${r.stderr}`);
    continue;
  }
  const raw = JSON.parse(r.stdout);
  const info = Array.isArray(raw) ? raw[0] : Object.values(raw)[0];
  tarballs.push(join(tarDir, info.filename));
  const paths = info.files.map((f) => f.path);
  for (const p of paths) if (!allowed(p)) fail(`${j.name}: unexpected file in package: ${p}`);
  for (const need of ["package.json", "README.md", "LICENSE"]) if (!paths.includes(need)) fail(`${j.name}: ${need} missing from package`);
  if (!paths.some((p) => p.startsWith("dist/"))) fail(`${j.name}: dist/ missing. Run npm run build first`);
  for (const p of paths.filter((x) => x.startsWith("dist/") && existsSync(join(dir, x)))) {
    const text = readFileSync(join(dir, p), "utf8");
    for (const re of SECRETS) if (re.test(text)) fail(`${j.name}: possible secret in ${p}`);
  }
  if (j.bin)
    for (const b of Object.values(j.bin))
      if (!existsSync(join(dir, b))) fail(`${j.name}: bin ${b} does not exist (run npm run build)`);
      else if (!readFileSync(join(dir, b), "utf8").startsWith("#!/usr/bin/env node")) fail(`${j.name}: ${b} lacks a node shebang`);
  console.log(`${j.name}@${j.version}: ${paths.length} files, ${(info.size / 1024).toFixed(1)} kB packed`);
}

// 3. install the real tarballs in an empty project and use them (checks exports, bin, engines, dependencies)
if (!args.includes("--no-install") && errors.length === 0) {
  const proj = join(tarDir, "consumer");
  mkdirSync(proj);
  writeFileSync(join(proj, "package.json"), JSON.stringify({ name: "consumer", version: "1.0.0", private: true, type: "module" }));
  const i = run("npm", ["install", "--no-audit", "--no-fund", ...tarballs], proj);
  if (i.status !== 0) fail(`installing the tarballs failed:\n${i.stderr}`);
  else {
    const t = run(
      process.execPath,
      [
        "--input-type=module",
        "-e",
        'const m = await import("@rheajs/core"); for (const k of ["createApp","validate","NotFoundError","loadEnv","sendSuccess"]) if (typeof m[k] === "undefined") throw new Error("missing export " + k); console.log("core exports ok")',
      ],
      proj,
    );
    if (t.status !== 0) fail(`importing @rheajs/core from the tarball failed:\n${t.stderr}`);
    const v = run(process.execPath, [join(proj, "node_modules/@rheajs/cli/dist/bin.js"), "--version"], proj);
    if (v.status !== 0 || v.stdout.trim() !== version) fail(`rhea --version from the tarball returned "${v.stdout.trim()}" (expected ${version})`);
    const s = run(process.execPath, [join(proj, "node_modules/create-rhea/dist/bin.js")], proj);
    if (s.status !== 2 || !/Missing project name/.test(s.stderr)) fail(`create-rhea without args should exit 2 with usage, got ${s.status}`);
    console.log("tarball install test: " + (errors.length ? "FAILED" : "ok"));
  }
}
rmSync(tarDir, { recursive: true, force: true });

for (const w of warns) console.log(`warning: ${w}`);
if (errors.length) {
  for (const e of errors) console.error(`error: ${e}`);
  console.error(`\nRelease check FAILED (${errors.length} error${errors.length === 1 ? "" : "s"}). Nothing was published.`);
  process.exit(1);
}
console.log(`\nRelease check passed for ${version}. Nothing was published.`);

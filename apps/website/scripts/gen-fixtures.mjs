// Captures REAL output for the website: pipeline scenarios from the built core, CLI transcripts from a real scaffold.
// Run: npm run fixtures -w @rheajs/website   (needs `npm run build` at the repo root first, and network for npm install)
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readdirSync, rmSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const { createApp, Router, validate, z, sendSuccess } = await import(pathToFileURL(join(root, "packages/core/dist/index.js")).href);

const routes = () =>
  Router()
    .get("/health", (_q, res) => sendSuccess(res, { status: "ok" }))
    .get("/slow", () => undefined)
    .get("/crash", () => {
      throw new Error("connect failed: postgres://admin:hunter2@db.internal/app");
    })
    .post("/users", validate(z.object({ email: z.email() })), (q, res) => sendSuccess(res, q.body, "Created", 201));

async function scenario({ options = {}, requests }) {
  const app = createApp({ env: "production", logger: { level: "silent" }, handleSignals: false, ...options });
  app.mount("/", routes());
  const srv = await app.start(0, "127.0.0.1");
  const base = `http://127.0.0.1:${srv.address().port}`;
  let last;
  for (const r of requests) {
    const res = await fetch(base + r.path, { method: r.method ?? "GET", headers: r.headers, body: r.body });
    last = { status: res.status, acao: res.headers.get("access-control-allow-origin"), body: await res.json() };
  }
  await app.stop();
  return last;
}

const J = { "content-type": "application/json" };
const defs = [
  {
    id: "ok",
    label: "Valid request",
    layer: 10,
    request: "GET /health",
    note: "Passes every layer and reaches your handler.",
    run: { requests: [{ path: "/health" }] },
  },
  {
    id: "cors",
    label: "Unlisted browser origin",
    layer: 4,
    request: "GET /health  Origin: https://evil.example",
    note: "The server still answers, but sends no CORS header, so browsers will not let that page read the response.",
    run: { options: { cors: { origin: ["https://app.example.com"] } }, requests: [{ path: "/health", headers: { origin: "https://evil.example" } }] },
  },
  {
    id: "flood",
    label: "Too many requests",
    layer: 5,
    request: "GET /health  (3rd request, limit set to 2)",
    note: "Limit shown is 2 per minute so the demo is short. The default is 100 per minute.",
    run: { options: { rateLimit: { limit: 2, windowMs: 60000 } }, requests: [{ path: "/health" }, { path: "/health" }, { path: "/health" }] },
  },
  {
    id: "slow",
    label: "Handler never responds",
    layer: 6,
    request: "GET /slow  (timeout set to 50 ms)",
    note: "Timeout shown is 50 ms for the demo. The default is 30 seconds.",
    run: { options: { requestTimeoutMs: 50 }, requests: [{ path: "/slow" }] },
  },
  {
    id: "big",
    label: "Oversized body",
    layer: 7,
    request: "POST /users  5 kB body (limit set to 1 kB)",
    note: "Limit shown is 1 kB for the demo. The default is 100 kb.",
    run: {
      options: { bodyLimit: "1kb" },
      requests: [{ path: "/users", method: "POST", headers: J, body: JSON.stringify({ email: "a@b.co", pad: "x".repeat(5000) }) }],
    },
  },
  {
    id: "proto",
    label: "Prototype pollution payload",
    layer: 8,
    request: 'POST /users  {"a":{"__proto__":{"admin":true}}}',
    note: "Bodies with __proto__, constructor or prototype keys are rejected before your code sees them.",
    run: { requests: [{ path: "/users", method: "POST", headers: J, body: '{"a":{"__proto__":{"admin":true}}}' }] },
  },
  {
    id: "invalid",
    label: "Invalid input",
    layer: 9,
    request: 'POST /users  {"email":"nope"}',
    note: "validate(schema) on the route returns every problem in one response.",
    run: { requests: [{ path: "/users", method: "POST", headers: J, body: JSON.stringify({ email: "nope" }) }] },
  },
  {
    id: "crash",
    label: "Unhandled exception",
    layer: 11,
    request: "GET /crash  (handler throws with a database password in the message)",
    note: "In production the message is replaced. The full error goes to the log, not the client.",
    run: { requests: [{ path: "/crash" }] },
  },
];
const scenarios = [];
for (const d of defs) {
  const { run, ...meta } = d;
  scenarios.push({ ...meta, response: await scenario(run) });
}
for (const s of scenarios) if (JSON.stringify(s.response).includes("hunter2")) throw new Error("secret leaked in fixture " + s.id);

// ---- CLI transcripts from a real scaffold ----
const work = mkdtempSync(join(tmpdir(), "rhea-fx-"));
const tgz = join(work, "tgz");
mkdirSync(tgz);
const sh = (cmd, args, cwd, env = {}) =>
  spawnSync(cmd, args, { cwd, encoding: "utf8", shell: process.platform === "win32", env: { ...process.env, NO_COLOR: "1", ...env } });
for (const w of ["@rheajs/core", "@rheajs/cli"]) sh("npm", ["pack", "-w", w, "--pack-destination", tgz], root);
const spec = (p) =>
  "file:" +
  join(
    tgz,
    readdirSync(tgz).find((f) => f.startsWith(p)),
  );
const env = { RHEA_CORE_SPEC: spec("rheajs-core"), RHEA_CLI_SPEC: spec("rheajs-cli") };
const bin = join(root, "packages/cli/dist/bin.js");
const rhea = (args, cwd) => sh(process.execPath, [bin, ...args], cwd, env);
const text = (r) => (r.stdout + r.stderr).replace(/^npm notice.*\n/gm, "").trimEnd();
const cli = [];
const step = (cmd, r) => cli.push({ cmd, output: text(r), exit: r.status });
let r = rhea(["create", "my-api"], work);
step("npx create-rhea my-api", r);
const app = join(work, "my-api");
sh("npm", ["install", "--no-audit", "--no-fund"], app, env);
step("npx rhea generate module users", rhea(["generate", "module", "users"], app));
step("npx rhea build", rhea(["build"], app));
step("npx rhea doctor", rhea(["doctor"], app));
step("npx rhea security", rhea(["security"], app));
rmSync(work, { recursive: true, force: true });

const ver = (p) => JSON.parse(readFileSync(join(root, p, "package.json"), "utf8")).version;
const fixtures = {
  generatedAt: new Date().toISOString(),
  node: process.versions.node,
  platform: process.platform,
  versions: { core: ver("packages/core"), cli: ver("packages/cli") },
  scenarios,
  cli,
};
writeFileSync(join(root, "apps/website/src/data/fixtures.json"), JSON.stringify(fixtures, null, 2) + "\n");
console.log(`fixtures: ${scenarios.length} scenarios, ${cli.length} CLI steps`);

// Load test. Usage: node scripts/bench.mjs [seconds]   (build first: npm run build)
// Starts each server in its own process and drives it with autocannon on the same machine.
// Numbers depend entirely on the machine. Compare scenarios with each other, not with other machines.
import { spawn } from "node:child_process";
import { cpus, totalmem } from "node:os";
import { setTimeout as sleep } from "node:timers/promises";
import autocannon from "autocannon";

const seconds = Number(process.argv[2] ?? 10);
const connections = 64;

async function start(scenario, port) {
  const child = spawn(process.execPath, ["scripts/bench-server.mjs", scenario, String(port)], { stdio: ["ignore", "pipe", "ignore"] });
  let token = "";
  child.stdout.on("data", (d) => (token ||= /TOKEN=(\S+)/.exec(String(d))?.[1] ?? ""));
  for (let i = 0; i < 100; i++) {
    try {
      if ((await fetch(`http://127.0.0.1:${port}/hello`)).status === 200) return { child, token };
    } catch {
      /* not up yet */
    }
    await sleep(100);
  }
  child.kill();
  throw new Error(`${scenario} did not start`);
}

async function measure(label, url, opts = {}) {
  await autocannon({ url, connections, duration: 3, ...opts }); // warm-up
  const r = await autocannon({ url, connections, duration: seconds, ...opts });
  return {
    label,
    "req/s": Math.round(r.requests.average),
    "p50 ms": r.latency.p50,
    "p99 ms": r.latency.p99,
    errors: r.errors + r.non2xx,
  };
}

const rows = [];
const express = await start("express", 5601);
rows.push(await measure("Express 5, plain JSON route", "http://127.0.0.1:5601/hello"));
rows.push(
  await measure("Express 5, JSON body echo (no validation)", "http://127.0.0.1:5601/users", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: "a@example.com", age: 30 }),
  }),
);
express.child.kill();

const rhea = await start("rhea", 5602);
rows.push(await measure("Rhea.js, default pipeline, plain route", "http://127.0.0.1:5602/hello"));
rows.push(
  await measure("Rhea.js, with Zod validation (POST)", "http://127.0.0.1:5602/users", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: "a@example.com", age: 30 }),
  }),
);
rows.push(await measure("Rhea.js, JWT-protected route", "http://127.0.0.1:5602/me", { headers: { authorization: `Bearer ${rhea.token}` } }));
rhea.child.kill();

console.log(
  `\nNode ${process.version}, ${cpus().length} x ${cpus()[0].model.trim()}, ${(totalmem() / 2 ** 30).toFixed(0)} GiB RAM, ${connections} connections, ${seconds} s per scenario, load generator on the same machine\n`,
);
console.table(rows);

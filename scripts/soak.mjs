// Soak test. Usage: node scripts/soak.mjs [seconds]   (build first: npm run build)
// Holds steady load on a Rhea.js server and samples its memory, to look for leaks and latency drift.
import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { clearInterval, setInterval } from "node:timers";
import { setTimeout as sleep } from "node:timers/promises";
import autocannon from "autocannon";

const seconds = Number(process.argv[2] ?? 120);
const child = spawn(process.execPath, ["scripts/bench-server.mjs", "rhea", "5603"], { stdio: "ignore" });
const rssMb = () => Number(/VmRSS:\s+(\d+)/.exec(readFileSync(`/proc/${child.pid}/status`, "utf8"))[1]) / 1024;
for (let i = 0; i < 100; i++) {
  try {
    if ((await fetch("http://127.0.0.1:5603/hello")).status === 200) break;
  } catch {
    await sleep(100);
  }
}

const samples = [];
const timer = setInterval(() => samples.push(Math.round(rssMb())), Math.max(1000, (seconds * 1000) / 12));
const r = await autocannon({
  url: "http://127.0.0.1:5603/users",
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ email: "a@example.com", age: 30 }),
  connections: 32,
  duration: seconds,
});
clearInterval(timer);
samples.push(Math.round(rssMb()));
child.kill();
console.log(
  `${seconds} s at 32 connections: ${Math.round(r.requests.average)} req/s, ${r.requests.total} requests, errors ${r.errors}, non-2xx ${r.non2xx}, p99 ${r.latency.p99} ms`,
);
console.log(`Server RSS (MB) over time: ${samples.join(", ")}`);

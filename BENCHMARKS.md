# Benchmarks

Measured on 2026-10-10. Read the caveats before quoting any number.

## Method

- `node scripts/bench.mjs 10` starts each server in its own process and drives it with [autocannon](https://github.com/mcollina/autocannon): 64 connections, 3 s warm-up, 10 s measured per scenario.
- `node scripts/soak.mjs 180` holds 32 connections on a Rhea.js `POST` route for 180 s and samples the server's resident memory.
- Servers run with `NODE_ENV=production`. The Rhea.js rate limit is raised to 1,000,000,000 so the test measures the pipeline, not the 429 path. Request logging stays on, with output discarded.
- Run with `npm run bench` and `npm run soak`. Source: [scripts/bench.mjs](scripts/bench.mjs), [scripts/bench-server.mjs](scripts/bench-server.mjs), [scripts/soak.mjs](scripts/soak.mjs). Run `npm run build` first.

## Machine

Intel Core i7-8665U (4 cores, 8 threads, 1.9 GHz base), 8 GiB RAM shared with a desktop session, Node.js 26.10.0, Linux. The load generator ran on the same machine as the server, so both compete for the CPU.

## Results (two runs, 8 to 10 s each)

| Scenario                               | Requests per second | p50 latency | p99 latency | Errors |
| -------------------------------------- | ------------------- | ----------- | ----------- | ------ |
| Express 5, plain JSON route            | 4,190 to 4,230      | 14 ms       | 29 to 31 ms | 0      |
| Express 5, JSON body echo, no checks   | 3,253 to 3,375      | 18 ms       | 34 to 38 ms | 0      |
| Rhea.js, default pipeline, plain route | 2,506 to 2,607      | 24 to 25 ms | 48 to 53 ms | 0      |
| Rhea.js, with Zod validation (`POST`)  | 2,302 to 2,340      | 25 ms       | 57 to 59 ms | 0      |
| Rhea.js, JWT-protected route           | 1,867 to 2,127      | 28 to 29 ms | 56 to 87 ms | 0      |

## What this says

- Rhea.js is **slower** than bare Express on a trivial route: about 60% of its throughput here. That is the cost of what it does on every request: request ID, JSON request log, Helmet headers, rate limit counting, timeout timer, body limit, prototype-pollution check and the error-handling layer. If a route needs raw speed and none of that, plain Express is faster.
- Validation added roughly 5 to 10% on top. JWT verification (HMAC) added roughly 15 to 25% on top of the plain route, and the p99 varied the most between runs.
- 180 s soak at 32 connections: 392,475 requests, **0 errors**, 2,181 requests per second, p99 29 ms. Server memory rose from 134 MB to 171 MB during the first minute, then stayed at 171 MB for the rest of the run. That is no sign of a leak at this scale. It is not proof of none over days.

## Caveats

- One laptop, one Node.js version, one operating system. Numbers on a server will be higher and will differ in ratio.
- The load generator shares the CPU with the server, which lowers every number and widens the tails.
- Routes return tiny JSON bodies and do no database or network work. Real applications spend most of their time elsewhere, which hides these differences.
- Two runs are not a statistical study. Treat differences under about 10% as noise.
- Nothing here compares Rhea.js with other frameworks such as Fastify or NestJS. It was not measured, so no claim is made.

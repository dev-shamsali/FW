/**
 * redisRateLimitStore against a real Redis 7 container, with two app instances sharing one limit.
 * Skipped when Docker is not available (macOS and Windows runners). Run with: npm run test:e2e
 */
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { Router, createApp, redisRateLimitStore, sendSuccess } from "@rheajs/core";
import { Redis } from "ioredis";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const root = resolve(import.meta.dirname, "../..");
const docker = (args: string[]) => spawnSync("docker", args, { encoding: "utf8", cwd: root });
const canRun = process.platform === "linux" && docker(["version", "--format", "{{.Server.Version}}"]).status === 0;
const NAME = `rhea-test-redis-${process.pid}`;
const PORT = 6390 + (process.pid % 50);

let redis: Redis;

async function instance(limit: number, windowMs: number) {
  const app = createApp({ env: "test", rateLimit: { limit, windowMs, store: redisRateLimitStore(redis, `t${Math.random()}:`) } });
  app.mount(
    "/x",
    Router().get("/", (_q, r) => sendSuccess(r, { ok: true })),
  );
  return (await app.ready()).express;
}

describe.skipIf(!canRun)("redisRateLimitStore with real Redis", () => {
  beforeAll(async () => {
    const r = docker(["run", "-d", "--rm", "--name", NAME, "-p", `127.0.0.1:${PORT}:6379`, "redis:7-alpine"]);
    expect(r.status, r.stderr).toBe(0);
    redis = new Redis({ port: PORT, host: "127.0.0.1", maxRetriesPerRequest: 1, retryStrategy: () => null });
    for (let i = 0; i < 50; i++) {
      try {
        if ((await redis.ping()) === "PONG") return;
      } catch {
        await new Promise((r) => setTimeout(r, 200));
      }
    }
    throw new Error("Redis did not become ready");
  }, 120_000);

  afterAll(async () => {
    redis?.disconnect();
    docker(["rm", "-f", NAME]);
  });

  it("two instances with the same prefix share one limit", async () => {
    const prefix = `shared${Date.now()}:`;
    const make = async () => {
      const app = createApp({ env: "test", rateLimit: { limit: 3, windowMs: 60_000, store: redisRateLimitStore(redis, prefix) } });
      app.mount(
        "/x",
        Router().get("/", (_q, r) => sendSuccess(r, { ok: true })),
      );
      return (await app.ready()).express;
    };
    const [a, b] = [await make(), await make()];
    const codes: number[] = [];
    for (const app of [a, b, a, b, a]) codes.push((await request(app).get("/x")).status);
    expect(codes).toEqual([200, 200, 200, 429, 429]);
  });

  it("sets a TTL on the counter and the window resets after it", async () => {
    const prefix = `ttl${Date.now()}:`;
    const app = createApp({ env: "test", rateLimit: { limit: 1, windowMs: 1500, store: redisRateLimitStore(redis, prefix) } });
    app.mount(
      "/x",
      Router().get("/", (_q, r) => sendSuccess(r, {})),
    );
    const e = (await app.ready()).express;
    expect((await request(e).get("/x")).status).toBe(200);
    expect((await request(e).get("/x")).status).toBe(429);
    const keys = await redis.keys(`${prefix}*`);
    expect(keys.length).toBe(1);
    const ttl = await redis.pttl(keys[0]!);
    expect(ttl).toBeGreaterThan(0);
    expect(ttl).toBeLessThanOrEqual(1500);
    await new Promise((r) => setTimeout(r, 1800));
    expect(await redis.exists(keys[0]!)).toBe(0);
    expect((await request(e).get("/x")).status).toBe(200);
  });

  it("holds under concurrent requests: exactly `limit` succeed", async () => {
    const e = await instance(20, 60_000);
    const res = await Promise.all(Array.from({ length: 60 }, () => request(e).get("/x")));
    expect(res.filter((r) => r.status === 200).length).toBe(20);
    expect(res.filter((r) => r.status === 429).length).toBe(40);
  });

  it("returns a generic 500 that leaks nothing while Redis is down", async () => {
    const prod = createApp({
      env: "production",
      logger: { level: "silent" },
      handleProcessErrors: false,
      rateLimit: { store: redisRateLimitStore(redis, `down${Date.now()}:`) },
    });
    prod.mount(
      "/x",
      Router().get("/", (_q, r) => sendSuccess(r, {})),
    );
    const e = (await prod.ready()).express;
    expect((await request(e).get("/x")).status).toBe(200);
    expect(docker(["stop", NAME]).status).toBe(0);
    const down = await request(e).get("/x");
    expect(down.status).toBe(500);
    expect(JSON.stringify(down.body)).not.toMatch(/ECONN|Redis|redis|connect/);
  }, 60_000);
});

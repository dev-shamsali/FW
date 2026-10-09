import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Router, createApp, rateLimiter, redisRateLimitStore, sendSuccess, type RedisLike } from "../src/index.js";

/** In-memory stand-in for the Redis commands the store uses. TTLs follow a fake clock. */
function fakeRedis() {
  const data = new Map<string, { n: number; expiresAt: number | null }>();
  const client: RedisLike & { data: typeof data } = {
    data,
    async incr(k) {
      const e = data.get(k) ?? { n: 0, expiresAt: null };
      e.n += 1;
      data.set(k, e);
      return e.n;
    },
    async decr(k) {
      const e = data.get(k);
      if (!e) return 0;
      e.n -= 1;
      return e.n;
    },
    async pexpire(k, ms) {
      const e = data.get(k);
      if (!e) return 0;
      e.expiresAt = Date.now() + ms;
      return 1;
    },
    async pttl(k) {
      const e = data.get(k);
      if (!e) return -2;
      return e.expiresAt === null ? -1 : e.expiresAt - Date.now();
    },
    async del(k) {
      return data.delete(k) ? 1 : 0;
    },
  };
  return client;
}

describe("shared rate-limit store", () => {
  it("counts through the store, so two app instances share one limit", async () => {
    const redis = fakeRedis();
    const make = () => {
      const app = createApp({ env: "test", rateLimit: { limit: 3, windowMs: 60_000, store: redisRateLimitStore(redis) } });
      app.mount(
        "/x",
        Router().get("/", (_q, r) => sendSuccess(r, { ok: true })),
      );
      return app.ready();
    };
    const [a, b] = await Promise.all([make(), make()]);
    const codes: number[] = [];
    for (const app of [a, b, a, b, a]) codes.push((await request(app.express).get("/x")).status);
    expect(codes).toEqual([200, 200, 200, 429, 429]);
  });

  it("sets an expiry on the first hit and repairs a key that lost its expiry", async () => {
    const redis = fakeRedis();
    const store = redisRateLimitStore(redis, "t:");
    store.init!({ windowMs: 5_000 } as never);
    await store.increment("k");
    expect(redis.data.get("t:k")!.expiresAt).toBeGreaterThan(Date.now());
    redis.data.get("t:k")!.expiresAt = null;
    const r = await store.increment("k");
    expect(r.totalHits).toBe(2);
    expect(redis.data.get("t:k")!.expiresAt).not.toBeNull();
  });

  it("resetKey and decrement work", async () => {
    const redis = fakeRedis();
    const store = redisRateLimitStore(redis);
    store.init!({ windowMs: 1000 } as never);
    await store.increment("a");
    await store.increment("a");
    await store.decrement!("a");
    expect((await store.increment("a")).totalHits).toBe(2);
    await store.resetKey("a");
    expect((await store.increment("a")).totalHits).toBe(1);
  });

  it("passes a store failure to the error handler instead of hanging", async () => {
    const broken: RedisLike = { ...fakeRedis(), incr: async () => Promise.reject(new Error("redis down")) };
    const app = createApp({ env: "production", logger: { level: "silent" }, rateLimit: { store: redisRateLimitStore(broken) } });
    app.mount(
      "/x",
      Router().get("/", (_q, r) => sendSuccess(r, {})),
    );
    const res = await request((await app.ready()).express).get("/x");
    expect(res.status).toBe(500);
    expect(JSON.stringify(res.body)).not.toContain("redis down");
  });
});

describe("rate limit options", () => {
  it("limits per key and skips exempt requests", async () => {
    const app = createApp({
      env: "test",
      rateLimit: { limit: 1, keyGenerator: (req) => String(req.headers["x-api-key"] ?? "anon"), skip: (req) => req.path === "/health" },
    });
    app.mount(
      "/x",
      Router().get("/", (_q, r) => sendSuccess(r, {})),
    );
    app.mount(
      "/health",
      Router().get("/", (_q, r) => sendSuccess(r, {})),
    );
    const e = (await app.ready()).express;
    expect((await request(e).get("/x").set("x-api-key", "a")).status).toBe(200);
    expect((await request(e).get("/x").set("x-api-key", "b")).status).toBe(200);
    expect((await request(e).get("/x").set("x-api-key", "a")).status).toBe(429);
    for (let i = 0; i < 5; i++) expect((await request(e).get("/health").set("x-api-key", "a")).status).toBe(200);
  });

  it("rateLimiter() protects one route with the standard 429 shape", async () => {
    const app = createApp({ env: "test" });
    app.mount(
      "/login",
      Router().post("/", rateLimiter({ limit: 2, windowMs: 60_000 }), (_q, r) => sendSuccess(r, {})),
    );
    app.mount(
      "/other",
      Router().get("/", (_q, r) => sendSuccess(r, {})),
    );
    const e = (await app.ready()).express;
    const s: number[] = [];
    for (let i = 0; i < 3; i++) s.push((await request(e).post("/login")).status);
    expect(s).toEqual([200, 200, 429]);
    const blocked = await request(e).post("/login");
    expect(blocked.body.error.code).toBe("RATE_LIMITED");
    for (let i = 0; i < 5; i++) expect((await request(e).get("/other")).status).toBe(200);
  });
});

describe("process safety", () => {
  const apps: ReturnType<typeof createApp>[] = [];
  afterEach(async () => {
    await Promise.all(apps.splice(0).map((a) => a.stop()));
    vi.restoreAllMocks();
  });

  it("applies server timeouts and keeps headersTimeout above keepAliveTimeout", async () => {
    const app = createApp({
      env: "test",
      handleSignals: false,
      handleProcessErrors: false,
      server: { keepAliveTimeoutMs: 70_000, headersTimeoutMs: 1_000, requestTimeoutMs: 9_000 },
    });
    apps.push(app);
    const srv = await app.start(0, "127.0.0.1");
    expect(srv.keepAliveTimeout).toBe(70_000);
    expect(srv.headersTimeout).toBe(71_000);
    expect(srv.requestTimeout).toBe(9_000);
  });

  it("registers process error handlers on start and removes them on stop", async () => {
    const before = [process.listenerCount("uncaughtException"), process.listenerCount("unhandledRejection")];
    const app = createApp({ env: "test", handleSignals: false });
    await app.start(0, "127.0.0.1");
    expect([process.listenerCount("uncaughtException"), process.listenerCount("unhandledRejection")]).toEqual([before[0]! + 1, before[1]! + 1]);
    await app.stop();
    expect([process.listenerCount("uncaughtException"), process.listenerCount("unhandledRejection")]).toEqual(before);
  });

  it("can be turned off", async () => {
    const before = process.listenerCount("unhandledRejection");
    const app = createApp({ env: "test", handleSignals: false, handleProcessErrors: false });
    apps.push(app);
    await app.start(0, "127.0.0.1");
    expect(process.listenerCount("unhandledRejection")).toBe(before);
  });

  it("an unhandled rejection runs shutdown hooks and exits 1", async () => {
    const exit = vi.spyOn(process, "exit").mockImplementation((() => undefined) as never);
    const hook = vi.fn();
    const app = createApp({ env: "test", handleSignals: false, logger: { level: "silent" } });
    app.hook("afterShutdown", hook);
    await app.start(0, "127.0.0.1");
    const handlers = process.listeners("unhandledRejection");
    handlers[handlers.length - 1]!(new Error("boom"), Promise.resolve());
    await vi.waitFor(() => expect(exit).toHaveBeenCalledWith(1));
    expect(hook).toHaveBeenCalledTimes(1);
  });
});

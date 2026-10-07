import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { Router } from "express";
import { createApp, validate, z, NotFoundError, ConflictError, parseEnv, baseEnvShape, EnvValidationError, sendSuccess, createLogger, ConfigError } from "../src/index.js";

const silent = { level: "silent" as const };
const build = (o: Parameters<typeof createApp>[0] = {}) => createApp({ logger: silent, handleSignals: false, env: "test", ...o });

describe("responses and errors", () => {
  it("wraps success and errors in the standard shape", async () => {
    const app = build();
    const r = Router();
    r.get("/ok", (_q, res) => sendSuccess(res, { a: 1 }));
    r.get("/nf", () => { throw new NotFoundError("User not found", { code: "USER_NOT_FOUND" }); });
    r.get("/async", async () => { throw new ConflictError("dup"); });
    app.mount("/", r);
    await app.ready();
    expect((await request(app.express).get("/ok")).body).toEqual({ success: true, data: { a: 1 }, message: "Success" });
    const nf = await request(app.express).get("/nf");
    expect(nf.status).toBe(404);
    expect(nf.body.error).toMatchObject({ code: "USER_NOT_FOUND", message: "User not found" });
    expect((await request(app.express).get("/async")).status).toBe(409);
    expect((await request(app.express).get("/missing")).body.error.code).toBe("NOT_FOUND");
  });

  it("hides internals in production, shows them in development", async () => {
    for (const [env, leaks] of [["production", false], ["development", true]] as const) {
      const app = build({ env });
      const r = Router();
      r.get("/boom", () => { throw new Error("db password=hunter2 failed"); });
      app.mount("/", r);
      await app.ready();
      const res = await request(app.express).get("/boom");
      expect(res.status).toBe(500);
      expect(JSON.stringify(res.body).includes("hunter2")).toBe(leaks);
      expect(res.body.error.stack !== undefined).toBe(leaks);
    }
  });

  it("maps malformed and oversized JSON to safe 4xx", async () => {
    const app = build({ bodyLimit: "50b" });
    app.mount("/", Router().post("/x", (_q, res) => void res.json({})));
    await app.ready();
    const bad = await request(app.express).post("/x").set("content-type", "application/json").send("{oops");
    expect(bad.status).toBe(400);
    expect(bad.body.error.code).toBe("INVALID_JSON");
    const big = await request(app.express).post("/x").send({ a: "x".repeat(200) });
    expect(big.status).toBe(413);
    expect(big.body.error.code).toBe("PAYLOAD_TOO_LARGE");
  });

  it("rejects prototype pollution keys", async () => {
    const app = build();
    app.mount("/", Router().post("/x", (_q, res) => void res.json({})));
    await app.ready();
    const res = await request(app.express).post("/x").set("content-type", "application/json").send('{"a":{"__proto__":{"admin":true}}}');
    expect(res.status).toBe(400);
  });
});

describe("validation", () => {
  it("validates, strips unknown keys, and reports consistent errors", async () => {
    const app = build();
    const schema = z.object({ email: z.email(), age: z.number().int() });
    app.mount("/", Router().post("/u", validate(schema), (q, res) => sendSuccess(res, q.body, "ok", 201))
      .get("/q", validate({ query: z.object({ n: z.coerce.number() }) }), (q, res) => sendSuccess(res, q.query)));
    await app.ready();
    const ok = await request(app.express).post("/u").send({ email: "a@b.co", age: 3, extra: 1 });
    expect(ok.status).toBe(201);
    expect(ok.body.data).toEqual({ email: "a@b.co", age: 3 });
    const bad = await request(app.express).post("/u").send({ email: "nope" });
    expect(bad.status).toBe(422);
    expect(bad.body.error.code).toBe("VALIDATION_ERROR");
    expect(bad.body.error.details.length).toBe(2);
    expect((await request(app.express).get("/q?n=5")).body.data).toEqual({ n: 5 });
  });
});

describe("env", () => {
  it("reports missing and invalid variables", () => {
    const shape = { ...baseEnvShape, DATABASE_URL: z.string().min(1), JWT_SECRET: z.string().min(16) };
    try {
      parseEnv(shape, { JWT_SECRET: "short", PORT: "70000" });
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(EnvValidationError);
      const err = e as EnvValidationError;
      expect(err.missing).toEqual(["DATABASE_URL"]);
      expect(err.invalid.map((i) => i.key).sort()).toEqual(["JWT_SECRET", "PORT"]);
      expect(err.format()).toContain("Application startup aborted.");
    }
    expect(parseEnv(baseEnvShape, { CORS_ORIGIN: "a.com, b.com" }).CORS_ORIGIN).toEqual(["a.com", "b.com"]);
  });
});

describe("request id", () => {
  it("propagates safe ids and replaces unsafe ones", async () => {
    const app = build();
    await app.ready();
    expect((await request(app.express).get("/").set("X-Request-ID", "abc-123")).headers["x-request-id"]).toBe("abc-123");
    const gen = (await request(app.express).get("/").set("X-Request-ID", "bad id<script>")).headers["x-request-id"];
    expect(gen).toMatch(/^[0-9a-f-]{36}$/);
  });
});

describe("security", () => {
  it("sets helmet headers and hides x-powered-by", async () => {
    const app = build();
    await app.ready();
    const r = await request(app.express).get("/");
    expect(r.headers["x-powered-by"]).toBeUndefined();
    expect(r.headers["x-content-type-options"]).toBe("nosniff");
  });

  it("refuses wildcard CORS in production and sends no CORS headers by default", async () => {
    expect(() => build({ env: "production", cors: { origin: ["*"] } })).toThrow(ConfigError);
    const app = build();
    await app.ready();
    expect((await request(app.express).get("/").set("Origin", "http://evil.test")).headers["access-control-allow-origin"]).toBeUndefined();
    const allowed = build({ cors: { origin: ["http://ok.test"] } });
    await allowed.ready();
    expect((await request(allowed.express).get("/").set("Origin", "http://ok.test")).headers["access-control-allow-origin"]).toBe("http://ok.test");
  });

  it("rate limits", async () => {
    const app = build({ rateLimit: { limit: 2, windowMs: 60_000 } });
    await app.ready();
    await request(app.express).get("/");
    await request(app.express).get("/");
    const r = await request(app.express).get("/");
    expect(r.status).toBe(429);
    expect(r.body.error.code).toBe("RATE_LIMITED");
  });

  it("times out slow handlers", async () => {
    const app = build({ requestTimeoutMs: 30 });
    app.mount("/", Router().get("/slow", () => undefined));
    await app.ready();
    expect((await request(app.express).get("/slow")).status).toBe(503);
  });
});

describe("logger", () => {
  it("redacts secrets", () => {
    const lines: string[] = [];
    const log = createLogger({ pretty: false, level: "info", destination: { write: (l: string) => void lines.push(l) } });
    log.info({ user: { password: "p", token: "t" }, req: { headers: { authorization: "Bearer x", cookie: "c" } } }, "x");
    const out = lines.join("");
    for (const secret of ['"p"', '"t"', "Bearer x", '"c"']) expect(out).not.toContain(secret);
    expect(out).toContain("[REDACTED]");
  });
});

describe("lifecycle and plugins", () => {
  it("runs hooks in order and plugins get a narrow context", async () => {
    const order: string[] = [];
    const app = build();
    for (const h of ["beforeInit", "init", "afterInit", "beforeStart", "afterStart", "beforeShutdown", "afterShutdown"] as const) app.hook(h, () => void order.push(h));
    app.use({ name: "demo", setup: (ctx) => { ctx.mount("/p", Router().get("/", (_q, res) => void res.json({ p: 1 }))); ctx.onHook("init", () => void order.push("plugin-init")); } });
    const srv = await app.start(0);
    const port = (srv.address() as { port: number }).port;
    expect((await fetch(`http://127.0.0.1:${port}/p`)).status).toBe(200);
    await app.stop();
    expect(order).toEqual(["beforeInit", "init", "plugin-init", "afterInit", "beforeStart", "afterStart", "beforeShutdown", "afterShutdown"]);
    expect(srv.listening).toBe(false);
  });

  it("keeps running shutdown hooks when one throws", async () => {
    const app = build();
    const after = vi.fn();
    app.hook("beforeShutdown", () => { throw new Error("x"); }).hook("afterShutdown", after);
    await app.start(0);
    await app.stop();
    expect(after).toHaveBeenCalled();
  });
});

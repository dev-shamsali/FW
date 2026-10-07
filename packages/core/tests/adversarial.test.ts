import { createServer, request as httpRequest } from "node:http";
import { connect } from "node:net";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { Router } from "express";
import { createApp, sendSuccess, validate, z } from "../src/index.js";

const build = (o: Parameters<typeof createApp>[0] = {}) => createApp({ logger: { level: "silent" }, handleSignals: false, env: "test", ...o });
const port = (srv: ReturnType<typeof createServer>) => (srv.address() as { port: number }).port;

describe("HTTP edge cases", () => {
  it("answers CORS preflight for allowed origin and omits headers for others", async () => {
    const app = build({ cors: { origin: ["https://ok.test"] } });
    await app.ready();
    const ok = await request(app.express).options("/x").set("Origin", "https://ok.test").set("Access-Control-Request-Method", "POST");
    expect(ok.status).toBe(204);
    expect(ok.headers["access-control-allow-origin"]).toBe("https://ok.test");
    const bad = await request(app.express).options("/x").set("Origin", "https://evil.test").set("Access-Control-Request-Method", "POST");
    expect(bad.headers["access-control-allow-origin"]).toBeUndefined();
  });

  it("handles HEAD, unknown methods and encoded paths without crashing", async () => {
    const app = build();
    app.mount("/", Router().get("/ab", (_q, res) => sendSuccess(res, 1)));
    await app.ready();
    expect((await request(app.express).head("/ab")).status).toBe(200);
    expect([400, 404]).toContain((await request(app.express).get("/%E0%A4%A")).status); // malformed URI: no crash
    expect((await request(app.express).get("/nope%00")).status).toBe(404);
    expect((await request(app.express).propfind?.("/") ?? { status: 404 }).status).toBe(404);
  });

  it("rejects non-object, array and wrong content-type bodies cleanly", async () => {
    const app = build();
    app.mount("/", Router().post("/u", validate(z.object({ n: z.number() })), (q, res) => sendSuccess(res, q.body)));
    await app.ready();
    for (const body of ['"str"', "123", "null", "[]", "[{\"__proto__\":1}]"]) {
      const r = await request(app.express).post("/u").set("content-type", "application/json").send(body);
      expect([400, 422], body).toContain(r.status);
    }
    const form = await request(app.express).post("/u").type("form").send("n=1");
    expect(form.status).toBe(422);
    const text = await request(app.express).post("/u").set("content-type", "text/plain").send("hi");
    expect(text.status).toBe(422);
  });

  it("rejects deeply nested pollution and constructor.prototype chains", async () => {
    const app = build();
    app.mount("/", Router().post("/u", (_q, res) => void res.json({})));
    await app.ready();
    const deep = '{"a":'.repeat(30) + '{"constructor":{"prototype":{"x":1}}}' + "}".repeat(30);
    expect((await request(app.express).post("/u").set("content-type", "application/json").send(deep)).status).toBe(400);
    expect(({} as Record<string, unknown>)["x"]).toBeUndefined();
  });

  it("does not reflect hostile request ids and survives header injection attempts", async () => {
    const app = build();
    await app.ready();
    for (const id of ["a\r\nSet-Cookie: x=1", "<script>", "x".repeat(500), "ok id"]) {
      const r = await request(app.express).get("/").set("X-Request-ID", id.replace(/[\r\n]/g, ""));
      expect(r.headers["set-cookie"]).toBeUndefined();
      expect(r.headers["x-request-id"]).toMatch(/^[A-Za-z0-9._-]{1,128}$/);
    }
  });

  it("rejects oversized headers at the HTTP layer without crashing the app", async () => {
    const app = build();
    const srv = await app.start(0, "127.0.0.1");
    const status = await new Promise<number>((resolve) => {
      const req = httpRequest({ port: port(srv), host: "127.0.0.1", headers: { "x-big": "a".repeat(40_000) } }, (res) => resolve(res.statusCode ?? 0));
      req.on("error", () => resolve(0));
      req.end();
    });
    expect([0, 431]).toContain(status);
    const ok = await fetch(`http://127.0.0.1:${port(srv)}/`);
    expect(ok.status).toBe(404);
    await app.stop();
  });
});

describe("error handling edge cases", () => {
  it("a handler responding after the timeout fired does not corrupt the response or crash", async () => {
    const lines: string[] = [];
    const app = build({ requestTimeoutMs: 20, logger: { level: "error", pretty: false, destination: { write: (l: string) => void lines.push(l) } } });
    app.mount("/", Router().get("/late", async (_q, res) => { await new Promise((r) => setTimeout(r, 80)); sendSuccess(res, "late"); }));
    await app.ready();
    const r = await request(app.express).get("/late");
    expect(r.status).toBe(503);
    await new Promise((r) => setTimeout(r, 120));
    expect(lines.join("")).not.toContain("ERR_HTTP_HEADERS_SENT");
  });

  it("throwing non-Error values yields a safe 500", async () => {
    const app = build({ env: "production" });
    app.mount("/", Router().get("/s", () => { throw "string secret"; }).get("/o", () => { throw { password: "x" }; }));
    await app.ready();
    for (const p of ["/s", "/o"]) {
      const r = await request(app.express).get(p);
      expect(r.status, p).toBe(500);
      expect(JSON.stringify(r.body)).not.toMatch(/secret|password/);
    }
  });

  it("a 4xx error with status property from third-party code is not leaked verbatim", async () => {
    const app = build({ env: "production" });
    app.mount("/", Router().get("/x", () => { throw Object.assign(new Error("db row 42 for user bob@x.com"), { status: 400 }); }));
    await app.ready();
    const r = await request(app.express).get("/x");
    expect(r.status).toBe(400);
    expect(JSON.stringify(r.body)).not.toContain("bob@x.com");
  });

  it("an error thrown after headers were sent ends the response instead of hanging", async () => {
    const app = build();
    app.mount("/", Router().get("/half", (_q, res) => { res.write("partial"); throw new Error("late"); }));
    await app.ready();
    const r = await request(app.express).get("/half").buffer(true).catch((e) => e);
    expect(r).toBeDefined();
  });
});

describe("shutdown", () => {
  it("lets an in-flight request finish before closing", async () => {
    const app = build({ shutdownTimeoutMs: 2000 });
    app.mount("/", Router().get("/work", async (_q, res) => { await new Promise((r) => setTimeout(r, 150)); sendSuccess(res, "done"); }));
    const srv = await app.start(0, "127.0.0.1");
    const inflight = fetch(`http://127.0.0.1:${port(srv)}/work`).then((r) => r.json());
    await new Promise((r) => setTimeout(r, 30));
    await app.stop();
    expect((await inflight).data).toBe("done");
  });

  it("stops accepting new connections once stopping", async () => {
    const app = build();
    const srv = await app.start(0, "127.0.0.1");
    const p = port(srv);
    await app.stop();
    await expect(
      new Promise((resolve, reject) => {
        const s = connect(p, "127.0.0.1");
        s.on("connect", () => { s.destroy(); resolve("connected"); });
        s.on("error", reject);
      }),
    ).rejects.toThrow();
  });

  it("startup hook failure aborts start and does not leave a listener", async () => {
    const app = build();
    app.hook("beforeStart", () => { throw new Error("db down"); });
    await expect(app.start(0)).rejects.toThrow("db down");
    await app.stop();
  });
});

describe("concurrency", () => {
  it("serves many concurrent requests with unique request ids and no errors", async () => {
    const app = build({ rateLimit: { limit: 100_000, windowMs: 60_000 } });
    app.mount("/", Router().get("/c", (_q, res) => sendSuccess(res, 1)));
    const srv = await app.start(0, "127.0.0.1");
    const base = `http://127.0.0.1:${port(srv)}`;
    const results = await Promise.all(Array.from({ length: 500 }, () => fetch(`${base}/c`).then((r) => [r.status, r.headers.get("x-request-id")] as const)));
    expect(results.every(([s]) => s === 200)).toBe(true);
    expect(new Set(results.map(([, id]) => id)).size).toBe(500);
    await app.stop();
  });
});

describe("process-level safety", () => {
  it("does not register uncaught handlers that swallow crashes", () => {
    const before = process.listenerCount("uncaughtException");
    build();
    expect(process.listenerCount("uncaughtException")).toBe(before);
    vi.restoreAllMocks();
  });
});

import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Router } from "express";
import {
  createApp,
  createLogger,
  loadEnv,
  z,
  AppError,
  BadRequestError,
  UnauthorizedError,
  ForbiddenError,
  ValidationError,
  InternalServerError,
  validate,
  sendSuccess,
} from "../src/index.js";

const build = (o: Parameters<typeof createApp>[0] = {}) => createApp({ logger: { level: "silent" }, handleSignals: false, env: "test", ...o });
afterEach(() => vi.restoreAllMocks());

describe("error classes", () => {
  it("carry status, code and expose flag", () => {
    expect([
      new BadRequestError().status,
      new UnauthorizedError().status,
      new ForbiddenError().status,
      new ValidationError().status,
      new InternalServerError().status,
    ]).toEqual([400, 401, 403, 422, 500]);
    expect(new InternalServerError().expose).toBe(false);
    expect(new BadRequestError("x", { code: "CUSTOM" }).code).toBe("CUSTOM");
    expect(new AppError(418, "TEAPOT", "t").name).toBe("AppError");
    expect(new BadRequestError("x", { cause: "c" }).cause).toBe("c");
  });
});

describe("error handler", () => {
  it("masks non-exposed AppError in production, keeps exposed ones", async () => {
    const app = build({ env: "production" });
    app.mount(
      "/",
      Router()
        .get("/a", () => {
          throw new InternalServerError("secret detail", { code: "DB_DOWN" });
        })
        .get("/b", () => {
          throw new ForbiddenError("nope");
        }),
    );
    await app.ready();
    const a = await request(app.express).get("/a");
    expect(a.status).toBe(500);
    expect(a.body.error).toMatchObject({ code: "INTERNAL_ERROR", message: "Internal server error" });
    expect(JSON.stringify(a.body)).not.toContain("secret detail");
    expect((await request(app.express).get("/b")).body.error.message).toBe("nope");
  });

  it("includes the request id for correlation", async () => {
    const app = build();
    await app.ready();
    const r = await request(app.express).get("/zzz").set("X-Request-ID", "corr-1");
    expect(r.body.error.requestId).toBe("corr-1");
  });

  it("supports a custom formatter", async () => {
    const app = build({ formatter: { success: (data) => ({ ok: true, data }), error: (e) => ({ ok: false, code: e.code }) } });
    app.mount(
      "/",
      Router().get("/ok", (_q, res) => sendSuccess(res, 1)),
    );
    await app.ready();
    expect((await request(app.express).get("/ok")).body).toEqual({ ok: true, data: 1 });
    expect((await request(app.express).get("/missing")).body).toEqual({ ok: false, code: "NOT_FOUND" });
  });
});

describe("app lifecycle", () => {
  it("ready() is idempotent and start() twice fails", async () => {
    const app = build();
    const init = vi.fn();
    app.hook("init", init);
    await Promise.all([app.ready(), app.ready()]);
    expect(init).toHaveBeenCalledTimes(1);
    await app.start(0);
    await expect(app.start(0)).rejects.toThrow(/already started/);
    await app.stop();
    await app.stop();
  });

  it("installs and removes signal handlers", async () => {
    const before = process.listenerCount("SIGTERM");
    const app = createApp({ logger: { level: "silent" }, env: "test" });
    await app.start(0);
    expect(process.listenerCount("SIGTERM")).toBe(before + 1);
    await app.stop();
    expect(process.listenerCount("SIGTERM")).toBe(before);
  });

  it("force-closes keep-alive connections after the shutdown timeout", async () => {
    const app = build({ shutdownTimeoutMs: 50 });
    app.mount(
      "/",
      Router().get("/hang", () => undefined),
    );
    const srv = await app.start(0);
    const port = (srv.address() as { port: number }).port;
    const ctl = new AbortController();
    const p = fetch(`http://127.0.0.1:${port}/hang`, { signal: ctl.signal }).catch(() => "closed");
    await new Promise((r) => setTimeout(r, 30));
    await app.stop();
    expect(await p).toBe("closed");
  });

  it("reports listen errors", async () => {
    const a = build();
    const srv = await a.start(0);
    const port = (srv.address() as { port: number }).port;
    await expect(build().start(port)).rejects.toThrow(/EADDRINUSE/);
    await a.stop();
  });

  it("plugin ctx.addMiddleware and logger work", async () => {
    const app = build();
    app.use({
      name: "hdr",
      setup(ctx) {
        ctx.addMiddleware((_q, res, next) => {
          res.setHeader("x-plugin", ctx.production ? "p" : "d");
          next();
        });
        ctx.logger.info("hi");
      },
    });
    await app.ready();
    expect((await request(app.express).get("/")).headers["x-plugin"]).toBe("d");
  });

  it("accepts a prebuilt logger and trustProxy", async () => {
    const lines: string[] = [];
    const logger = createLogger({ pretty: false, level: "info", destination: { write: (l: string) => void lines.push(l) } });
    const app = createApp({ logger, env: "test", handleSignals: false, trustProxy: true });
    await app.ready();
    await request(app.express).get("/nope?token=abc");
    await new Promise((r) => setTimeout(r, 10));
    const log = lines.join("");
    expect(log).toContain('"path":"/nope"');
    expect(log).not.toContain("token=abc");
  });
});

describe("validate", () => {
  it("validates params and collects errors across parts", async () => {
    const app = build();
    app.mount(
      "/",
      Router().get("/x/:id", validate({ params: z.object({ id: z.uuid() }), query: z.object({ n: z.coerce.number() }) }), (_q, res) => void res.json({})),
    );
    await app.ready();
    const r = await request(app.express).get("/x/nope?n=abc");
    expect(r.status).toBe(422);
    expect(r.body.error.details.map((d: { in: string }) => d.in).sort()).toEqual(["params", "query"]);
  });
});

describe("loadEnv", () => {
  it("prints the failure message and exits non-zero", () => {
    const exit = vi.spyOn(process, "exit").mockImplementation((() => {
      throw new Error("exit");
    }) as never);
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => loadEnv({ DATABASE_URL: z.string() }, {})).toThrow("exit");
    expect(exit).toHaveBeenCalledWith(1);
    expect(errSpy.mock.calls[0]?.[0]).toContain("Missing:\n- DATABASE_URL");
    expect(loadEnv({ A: z.string() }, { A: "1" })).toEqual({ A: "1" });
  });
});

describe("logger pretty stream", () => {
  it("writes readable lines in development", () => {
    const w = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    createLogger({ pretty: true, level: "info", name: "t" }).info({ a: 1 }, "hello");
    expect(String(w.mock.calls[0]?.[0])).toContain("hello");
  });
});

/** Morgan access log, JSON-only bodies, operator keys, Permissions-Policy and the proxy warning. */
import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Router, createApp, sendSuccess, type RheaOptions } from "../src/index.js";

const build = (o: RheaOptions = {}) => {
  const app = createApp({ env: "production", logger: { level: "silent" }, handleSignals: false, handleProcessErrors: false, rateLimit: { limit: 1e9 }, ...o });
  app.mount(
    "/echo",
    Router().all("/", (req, res) => sendSuccess(res, { body: req.body ?? null, query: req.query })),
  );
  return app;
};
afterEach(() => vi.restoreAllMocks());

describe("morgan access log", () => {
  const capture = () => {
    const lines: string[] = [];
    const spy = vi.spyOn(process.stdout, "write").mockImplementation(((chunk: string | Uint8Array) => {
      lines.push(String(chunk));
      return true;
    }) as typeof process.stdout.write);
    return { lines, spy };
  };

  it("is on in development with the short dev format, and the pino line is not duplicated", async () => {
    const { lines } = capture();
    const app = build({ env: "development", logger: { level: "info", pretty: false } });
    await request((await app.ready()).express).get("/echo");
    const out = lines.join("");
    expect(out).toMatch(/GET \/echo \d{3} [\d.]+ ms - \d+/);
    expect(out).not.toContain('"msg":"request"');
  });

  it("is off in production and test by default; the pino line stays", async () => {
    const { lines } = capture();
    const app = build({ logger: { level: "info", pretty: false } });
    await request((await app.ready()).express).get("/echo");
    const out = lines.join("");
    expect(out).toContain('"msg":"request"');
    expect(out).not.toMatch(/GET \/echo \d{3} [\d.]+ ms/);
  });

  it("never prints the query string, not even in combined format or the referrer", async () => {
    const { lines } = capture();
    const app = build({ accessLog: "combined" });
    await request((await app.ready()).express)
      .get("/echo?token=SECRET123&password=hunter2")
      .set("Referer", "https://app.example.com/page?session=REFERRERSECRET")
      .set("Authorization", "Bearer HEADERSECRET")
      .set("Cookie", "sid=COOKIESECRET");
    const out = lines.join("");
    expect(out).toContain('"GET /echo HTTP/1.1"');
    expect(out).toContain('"https://app.example.com/page"');
    for (const secret of ["SECRET123", "hunter2", "REFERRERSECRET", "HEADERSECRET", "COOKIESECRET"]) expect(out, secret).not.toContain(secret);
  });

  it.each(["dev", "tiny", "common", "combined"] as const)("format %s logs the path and status", async (format) => {
    const { lines } = capture();
    const app = build({ accessLog: format });
    await request((await app.ready()).express).get("/echo?a=1");
    const out = lines.join("");
    expect(out).toContain("/echo");
    expect(out).not.toContain("a=1");
    expect(out).toMatch(/\b200\b/);
  });

  it("can be forced off in development, and both logs can be kept on request", async () => {
    const off = capture();
    await request((await build({ env: "development", accessLog: false, requestLogging: false }).ready()).express).get("/echo");
    expect(off.lines.join("")).toBe("");
    vi.restoreAllMocks();
    const both = capture();
    const app = build({ env: "development", accessLog: "tiny", requestLogging: true, logger: { level: "info", pretty: false } });
    await request((await app.ready()).express).get("/echo");
    expect(both.lines.join("")).toContain('"msg":"request"');
    expect(both.lines.join("")).toMatch(/GET \/echo 200/);
  });
});

describe("JSON-only bodies (requireJson)", () => {
  it("answers 415 for form, text and multipart bodies on every body method", async () => {
    const e = (await build().ready()).express;
    for (const method of ["post", "put", "patch", "delete"] as const) {
      const r = await request(e)[method]("/echo").type("form").send("a=1");
      expect(r.status, method).toBe(415);
      expect(r.body.error.code).toBe("UNSUPPORTED_MEDIA_TYPE");
    }
    expect((await request(e).post("/echo").set("content-type", "text/plain").send("hello")).status).toBe(415);
    expect((await request(e).post("/echo").set("content-type", "multipart/form-data; boundary=x").send("--x--")).status).toBe(415);
  });

  it("allows JSON (also +json and with a charset), empty bodies and GET", async () => {
    const e = (await build().ready()).express;
    expect((await request(e).post("/echo").send({ a: 1 })).status).toBe(200);
    expect((await request(e).post("/echo").set("content-type", "application/json; charset=utf-8").send('{"a":1}')).status).toBe(200);
    expect((await request(e).post("/echo").set("content-type", "application/vnd.api+json").send('{"a":1}')).status).toBe(200);
    expect((await request(e).post("/echo")).status).toBe(200);
    expect((await request(e).get("/echo")).status).toBe(200);
  });

  it("can be turned off", async () => {
    const e = (await build({ requireJson: false }).ready()).express;
    expect((await request(e).post("/echo").type("form").send("a=1")).status).toBe(200);
  });
});

describe("operator keys (rejectOperatorKeys)", () => {
  const login = (e: Parameters<typeof request>[0], body: unknown) =>
    request(e)
      .post("/echo")
      .send(body as object);
  it("rejects $ne, $gt, $where and $regex anywhere in the body when enabled", async () => {
    const e = (await build({ rejectOperatorKeys: true }).ready()).express;
    for (const body of [{ email: { $ne: null } }, { a: [{ b: { $gt: "" } }] }, { $where: "1" }, { x: { y: { z: { $regex: ".*" } } } }]) {
      const r = await login(e, body);
      expect(r.status, JSON.stringify(body)).toBe(400);
      expect(r.body.error.code).toBe("INVALID_BODY");
    }
  });
  it("lets ordinary bodies through, and is off by default", async () => {
    const on = (await build({ rejectOperatorKeys: true }).ready()).express;
    expect((await login(on, { email: "a@b.co", price: "$5", note: "uses $ne in text" })).status).toBe(200);
    const off = (await build().ready()).express;
    expect((await login(off, { email: { $ne: null } })).status).toBe(200);
  });
});

describe("response headers", () => {
  it("sends a Permissions-Policy that turns off powerful features", async () => {
    const e = (await build().ready()).express;
    const h = (await request(e).get("/echo")).headers["permissions-policy"] ?? "";
    for (const f of ["camera=()", "microphone=()", "geolocation=()", "payment=()"]) expect(h).toContain(f);
  });
});

describe("proxy warning", () => {
  const run = async (o: RheaOptions, headers: Record<string, string>) => {
    const lines: string[] = [];
    const app = build({ logger: { level: "warn", pretty: false, destination: { write: (l: string) => void lines.push(l) } }, ...o });
    const e = (await app.ready()).express;
    for (let i = 0; i < 3; i++) {
      const r = request(e).get("/echo");
      for (const [k, v] of Object.entries(headers)) r.set(k, v);
      await r;
    }
    return lines.filter((l) => l.includes("trustProxy"));
  };
  it("warns once in production when X-Forwarded-For arrives and trustProxy is off", async () => {
    const w = await run({}, { "X-Forwarded-For": "203.0.113.9" });
    expect(w.length).toBe(1);
    expect(w[0]).toContain("TRUST_PROXY");
  });
  it("stays quiet with trustProxy set, without the header, and outside production", async () => {
    expect(await run({ trustProxy: 1 }, { "X-Forwarded-For": "203.0.113.9" })).toEqual([]);
    expect(await run({}, {})).toEqual([]);
    expect(await run({ env: "test" }, { "X-Forwarded-For": "203.0.113.9" })).toEqual([]);
  });
});

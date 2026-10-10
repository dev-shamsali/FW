/** Regression tests for findings from the 2026-10-10 security self-audit. */
import request from "supertest";
import { describe, expect, it } from "vitest";
import { Router, createApp, createLogger, sendSuccess } from "../src/index.js";

const app = async () => {
  const a = createApp({ env: "production", logger: { level: "silent" }, handleSignals: false, handleProcessErrors: false, rateLimit: { limit: 1e9 } });
  a.mount(
    "/echo",
    Router().post("/", (req, res) => sendSuccess(res, { keys: Object.keys(req.body ?? {}) })),
  );
  return (await a.ready()).express;
};
const nest = (inner: string, levels: number) => {
  let s = inner;
  for (let i = 0; i < levels; i++) s = `{"a":${s}}`;
  return s;
};
const post = (e: Awaited<ReturnType<typeof app>>, body: string) => request(e).post("/echo").set("content-type", "application/json").send(body);

describe("prototype pollution guard cannot be bypassed by depth", () => {
  it("rejects __proto__ at depth 5, 32, 33 and 40", async () => {
    const e = await app();
    for (const depth of [5, 32, 33, 40, 200]) {
      const r = await post(e, nest('{"__proto__":{"admin":true}}', depth));
      expect(r.status, `depth ${depth}`).toBe(400);
      expect(r.body.error.code).toBe("INVALID_BODY");
    }
  });
  it("rejects constructor.prototype hidden deep inside arrays", async () => {
    const e = await app();
    const r = await post(e, `{"list":[${nest('{"constructor":{"prototype":{"x":1}}}', 50)}]}`);
    expect(r.status).toBe(400);
  });
  it("rejects absurdly deep arrays without crashing, and still serves the next request", async () => {
    const e = await app();
    const r = await post(e, "[".repeat(45_000) + "]".repeat(45_000));
    expect(r.status).toBe(400);
    expect((await post(e, '{"ok":1}')).status).toBe(200);
  });
  it("still accepts ordinary nested bodies up to 32 levels", async () => {
    const e = await app();
    expect((await post(e, nest("1", 20))).status).toBe(200);
  });
});

describe("log redaction reaches nested values", () => {
  const logged = (obj: object, extra: string[] = []) => {
    const lines: string[] = [];
    createLogger({ pretty: false, level: "info", redact: extra, destination: { write: (l: string) => void lines.push(l) } }).info(obj, "x");
    return lines.join("");
  };
  it("redacts sensitive keys at nesting levels 1 to 4", () => {
    const text = logged({
      a: { password: "p-one" },
      b: { c: { token: "t-two" } },
      d: { e: { f: { apiKey: "k-three" } } },
      g: { h: { i: { secret: "s-four" } } },
      jwt: "j-five",
      user: { idToken: "i-six", clientSecret: "c-seven", privateKey: "pk-eight" },
      req: { raw: { headers: { authorization: "Bearer a-nine", cookie: "c-ten" } } },
    });
    for (const v of ["p-one", "t-two", "k-three", "s-four", "j-five", "i-six", "c-seven", "pk-eight", "a-nine", "c-ten"]) expect(text, v).not.toContain(v);
    expect(text).toContain("[REDACTED]");
  });
  it("keeps harmless fields readable", () => {
    expect(logged({ user: { id: "u-1", name: "Ada" } })).toContain("Ada");
  });
});

import { createApp, Router, sendSuccess } from "@rheajs/core";
import { SignJWT } from "jose";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { authenticate, createJwt, hashPassword, MAX_PASSWORD_LENGTH, needsRehash, optionalAuth, requireRole, verifyPassword } from "../src/index.js";

const SECRET = "x".repeat(40);
const cfg = { secret: SECRET, issuer: "rhea-test", audience: "rhea-api" };
const FAST = { cost: 1 << 10 };

describe("passwords", () => {
  it("hashes with a random salt and verifies", async () => {
    const a = await hashPassword("correct horse", FAST);
    const b = await hashPassword("correct horse", FAST);
    expect(a).not.toBe(b);
    expect(a.startsWith("scrypt$1024$8$1$")).toBe(true);
    expect(await verifyPassword("correct horse", a)).toBe(true);
    expect(await verifyPassword("wrong horse", a)).toBe(false);
    expect(a).not.toContain("correct horse");
  });

  it("treats visually identical unicode as the same password", async () => {
    const h = await hashPassword("café", FAST);
    expect(await verifyPassword("café", h)).toBe(true);
  });

  it("returns false, never throws, for malformed or missing hashes", async () => {
    for (const bad of [null, undefined, "", "plain", "scrypt$x$8$1$aa$bb", "bcrypt$1$2$3$4$5", "scrypt$1024$8$1$$"]) {
      expect(await verifyPassword("pw", bad as never)).toBe(false);
    }
  }, 30_000);

  it("refuses absurd cost parameters in a tampered hash", async () => {
    const h = await hashPassword("pw", FAST);
    const parts = h.split("$");
    parts[1] = String(2 ** 30);
    const t = Date.now();
    expect(await verifyPassword("pw", parts.join("$"))).toBe(false);
    expect(Date.now() - t).toBeLessThan(1000);
  });

  it("rejects empty, non-string and oversized passwords", async () => {
    await expect(hashPassword("")).rejects.toThrow(TypeError);
    await expect(hashPassword(123 as never)).rejects.toThrow(TypeError);
    await expect(hashPassword("a".repeat(MAX_PASSWORD_LENGTH + 1))).rejects.toThrow(RangeError);
    expect(await verifyPassword("a".repeat(MAX_PASSWORD_LENGTH + 1), "x")).toBe(false);
  });

  it("flags weaker hashes for rehash", async () => {
    const weak = await hashPassword("pw", FAST);
    expect(needsRehash(weak)).toBe(true);
    expect(needsRehash(weak, FAST)).toBe(false);
    expect(needsRehash("garbage")).toBe(true);
  });

  it("uses the strong default cost", async () => {
    const h = await hashPassword("pw");
    expect(h.startsWith("scrypt$131072$8$1$")).toBe(true);
    expect(needsRehash(h)).toBe(false);
    expect(await verifyPassword("pw", h)).toBe(true);
  }, 20_000);
});

describe("jwt", () => {
  const jwt = createJwt(cfg);

  it("signs and verifies claims", async () => {
    const t = await jwt.sign({ sub: "u1", roles: ["admin"], org: "acme" });
    const c = await jwt.verify(t);
    expect(c).toMatchObject({ sub: "u1", roles: ["admin"], org: "acme", iss: "rhea-test", aud: "rhea-api" });
    expect(typeof c["exp"]).toBe("number");
  });

  it("cannot override reserved claims", async () => {
    const t = await jwt.sign({ sub: "u1", iss: "evil", aud: "evil", exp: 1 });
    const c = await jwt.verify(t);
    expect(c["iss"]).toBe("rhea-test");
    expect(c["exp"]).toBeGreaterThan(Date.now() / 1000);
  });

  it("rejects short secrets, missing issuer and bad claims", async () => {
    expect(() => createJwt({ ...cfg, secret: "short" })).toThrow(/32 bytes/);
    expect(() => createJwt({ ...cfg, issuer: "" })).toThrow(/issuer and audience/);
    await expect(jwt.sign({ sub: "" })).rejects.toThrow(TypeError);
  });

  it("reports expiry separately and rejects everything else as invalid", async () => {
    const expired = await jwt.sign({ sub: "u" }, { expiresIn: -60 });
    await expect(jwt.verify(expired)).rejects.toMatchObject({ code: "TOKEN_EXPIRED", status: 401 });

    const key = new TextEncoder().encode(SECRET);
    const make = (alg: string, over: Partial<{ iss: string; aud: string; sub: string }> = {}) =>
      new SignJWT({})
        .setProtectedHeader({ alg })
        .setIssuer(over.iss ?? cfg.issuer)
        .setAudience(over.aud ?? cfg.audience)
        .setSubject(over.sub ?? "u")
        .setExpirationTime("5m")
        .sign(key);
    const good = await jwt.sign({ sub: "u" });
    const [h, p, s] = good.split(".") as [string, string, string];
    const forgedPayload = Buffer.from(JSON.stringify({ sub: "admin", iss: cfg.issuer, aud: cfg.audience, exp: 9999999999 })).toString("base64url");
    const none = `${Buffer.from('{"alg":"none"}').toString("base64url")}.${forgedPayload}.`;
    const cases = [
      ["wrong algorithm HS512", await make("HS512")],
      ["wrong issuer", await make("HS256", { iss: "other" })],
      ["wrong audience", await make("HS256", { aud: "other" })],
      ["alg none", none],
      ["tampered payload", `${h}.${forgedPayload}.${s}`],
      ["tampered signature", `${h}.${p}.${s.slice(0, -2)}AA`],
      ["garbage", "not.a.jwt"],
      ["empty", ""],
    ] as const;
    for (const [name, token] of cases) await expect(jwt.verify(token), name).rejects.toMatchObject({ code: "INVALID_TOKEN", status: 401 });
    await expect(createJwt({ ...cfg, secret: "y".repeat(40) }).verify(good)).rejects.toMatchObject({ code: "INVALID_TOKEN" });
  });
});

describe("guards in an app", () => {
  const jwt = createJwt(cfg);
  async function build() {
    const app = createApp({ env: "production", logger: { level: "silent" }, handleSignals: false });
    app.mount(
      "/me",
      Router().get("/", authenticate(jwt), (req, res) => sendSuccess(res, req.user)),
    );
    app.mount(
      "/admin",
      Router().get("/", authenticate(jwt), requireRole("admin", "owner"), (_req, res) => sendSuccess(res, { ok: true })),
    );
    app.mount(
      "/maybe",
      Router().get("/", optionalAuth(jwt), (req, res) => sendSuccess(res, { user: req.user?.id ?? null })),
    );
    return (await app.ready()).express;
  }

  it("401 without a token, with a challenge header", async () => {
    const e = await build();
    const r = await request(e).get("/me");
    expect(r.status).toBe(401);
    expect(r.body.error.code).toBe("AUTH_REQUIRED");
    expect(r.headers["www-authenticate"]).toContain("Bearer");
  });

  it("accepts a valid token and exposes req.user", async () => {
    const e = await build();
    const t = await jwt.sign({ sub: "u1", roles: ["viewer"] });
    const r = await request(e).get("/me").set("Authorization", `Bearer ${t}`);
    expect(r.status).toBe(200);
    expect(r.body.data).toMatchObject({ id: "u1", roles: ["viewer"] });
  });

  it("ignores tokens in the query string and non-Bearer schemes", async () => {
    const e = await build();
    const t = await jwt.sign({ sub: "u1" });
    expect((await request(e).get(`/me?token=${t}`)).status).toBe(401);
    expect((await request(e).get("/me").set("Authorization", `Basic ${t}`)).status).toBe(401);
    expect((await request(e).get("/me").set("Authorization", `bearer ${t}`)).status).toBe(401);
  });

  it("enforces roles: 403 for the wrong role, 200 for any listed role", async () => {
    const e = await build();
    const viewer = await jwt.sign({ sub: "v", roles: ["viewer"] });
    const owner = await jwt.sign({ sub: "o", roles: ["owner"] });
    const none = await jwt.sign({ sub: "n" });
    expect((await request(e).get("/admin").set("Authorization", `Bearer ${viewer}`)).status).toBe(403);
    expect((await request(e).get("/admin").set("Authorization", `Bearer ${none}`)).status).toBe(403);
    expect((await request(e).get("/admin").set("Authorization", `Bearer ${owner}`)).status).toBe(200);
    expect((await request(e).get("/admin")).status).toBe(401);
  });

  it("a role claim that is not a string array grants nothing", async () => {
    const e = await build();
    const t = await jwt.sign({ sub: "x", roles: "admin" as never });
    expect((await request(e).get("/admin").set("Authorization", `Bearer ${t}`)).status).toBe(403);
  });

  it("optionalAuth lets anonymous through but rejects a bad token", async () => {
    const e = await build();
    expect((await request(e).get("/maybe")).body.data.user).toBeNull();
    const t = await jwt.sign({ sub: "u9" });
    expect((await request(e).get("/maybe").set("Authorization", `Bearer ${t}`)).body.data.user).toBe("u9");
    expect((await request(e).get("/maybe").set("Authorization", "Bearer abc.def.ghi")).status).toBe(401);
  });

  it("expired tokens say so, and errors never leak the secret", async () => {
    const e = await build();
    const t = await jwt.sign({ sub: "u1" }, { expiresIn: -60 });
    const r = await request(e).get("/me").set("Authorization", `Bearer ${t}`);
    expect(r.status).toBe(401);
    expect(r.body.error.code).toBe("TOKEN_EXPIRED");
    expect(JSON.stringify(r.body)).not.toContain(SECRET);
  });

  it("requireRole needs roles", () => {
    expect(() => requireRole()).toThrow();
  });
});

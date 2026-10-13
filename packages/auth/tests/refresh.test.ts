import { createApp, Router, sendSuccess } from "@rheajs/core";
import request from "supertest";
import { describe, expect, it } from "vitest";
import {
  assertAllowedOrigin,
  clearRefreshCookie,
  createLockout,
  createMemoryRefreshStore,
  createRefreshTokens,
  isCommonPassword,
  noStore,
  readCookie,
  setRefreshCookie,
} from "../src/index.js";

const DAY = 86_400_000;
function clock(start = Date.UTC(2026, 9, 13)) {
  let t = start;
  return { now: () => new Date(t), advance: (ms: number) => void (t += ms) };
}
const setup = (over: Partial<Parameters<typeof createRefreshTokens>[0]> = {}) => {
  const store = createMemoryRefreshStore();
  const c = clock();
  return { store, c, tokens: createRefreshTokens({ store, now: c.now, ...over }) };
};
const code = (p: Promise<unknown>) =>
  p.then(
    () => "ok",
    (e: { code?: string }) => e.code,
  );

describe("refresh tokens", () => {
  it("issues an opaque 43 character token and stores only its hash", async () => {
    const { store, tokens } = setup();
    const t = await tokens.issue("u1");
    expect(t.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(JSON.stringify(store.records)).not.toContain(t.token);
    expect(store.records[0]!.tokenHash).toMatch(/^[0-9a-f]{64}$/);
    expect(t.expiresAt.getTime() - Date.UTC(2026, 9, 13)).toBe(7 * DAY);
  });

  it("rotates: the new token works, the old one is marked used, both belong to one family", async () => {
    const { store, tokens } = setup();
    const a = await tokens.issue("u1");
    const b = await tokens.rotate(a.token);
    expect(b.token).not.toBe(a.token);
    expect(b.familyId).toBe(a.familyId);
    expect(b.userId).toBe("u1");
    expect(store.records.filter((r) => r.usedAt).length).toBe(1);
    expect((await tokens.rotate(b.token)).userId).toBe("u1");
  });

  it("detects reuse after the grace window and revokes the whole family", async () => {
    const { c, tokens } = setup();
    const a = await tokens.issue("u1");
    const b = await tokens.rotate(a.token);
    c.advance(60_000);
    expect(await code(tokens.rotate(a.token))).toBe("REFRESH_REUSED");
    // the newest token was revoked with the family: the thief and the owner are both signed out
    expect(await code(tokens.rotate(b.token))).toBe("REFRESH_INVALID");
  });

  it("treats a second use within the grace window as a harmless conflict and keeps the family", async () => {
    const { c, tokens } = setup();
    const a = await tokens.issue("u1");
    const b = await tokens.rotate(a.token);
    c.advance(3_000);
    expect(await code(tokens.rotate(a.token))).toBe("REFRESH_CONFLICT");
    expect((await tokens.rotate(b.token)).userId).toBe("u1");
  });

  it("of two truly parallel requests with the same token, exactly one succeeds", async () => {
    const { tokens } = setup();
    const a = await tokens.issue("u1");
    const results = await Promise.all(Array.from({ length: 8 }, () => code(tokens.rotate(a.token))));
    expect(results.filter((r) => r === "ok").length).toBe(1);
    expect(results.filter((r) => r === "REFRESH_CONFLICT").length).toBe(7);
  });

  it("expires after the idle time, and a busy session still ends at the absolute limit", async () => {
    const idle = setup();
    const a = await idle.tokens.issue("u1");
    idle.c.advance(7 * DAY + 1000);
    expect(await code(idle.tokens.rotate(a.token))).toBe("REFRESH_EXPIRED");

    const busy = setup();
    let t = await busy.tokens.issue("u1");
    // refresh every 6 days: never idle for 7, yet the 30 day session limit must still end it
    let ended = "";
    for (let i = 0; i < 8 && !ended; i++) {
      busy.c.advance(6 * DAY);
      const r = await busy.tokens.rotate(t.token).then(
        (n) => ((t = n), ""),
        (e: { code: string }) => e.code,
      );
      ended = r;
    }
    expect(ended).toBe("REFRESH_EXPIRED");
    expect(t.expiresAt.getTime()).toBeLessThanOrEqual(Date.UTC(2026, 9, 13) + 30 * DAY);
  });

  it("rejects malformed, unknown and non-string tokens without touching the store", async () => {
    const { tokens } = setup();
    for (const bad of ["", "short", "x".repeat(44), "!".repeat(43), "a".repeat(43), 12 as never, null as never]) {
      expect(await code(tokens.rotate(bad)), String(bad)).toBe("REFRESH_INVALID");
    }
  });

  it("revoke ends the session, can be repeated, and ignores unknown tokens", async () => {
    const { tokens } = setup();
    const a = await tokens.issue("u1");
    const b = await tokens.rotate(a.token);
    await tokens.revoke(b.token);
    await tokens.revoke(b.token);
    await tokens.revoke("not-a-token");
    expect(await code(tokens.rotate(b.token))).toBe("REFRESH_INVALID");
  });

  it("revokeAll signs a user out of every session and leaves others alone", async () => {
    const { tokens } = setup();
    const phone = await tokens.issue("u1");
    const laptop = await tokens.issue("u1");
    const other = await tokens.issue("u2");
    await tokens.revokeAll("u1");
    expect(await code(tokens.rotate(phone.token))).toBe("REFRESH_INVALID");
    expect(await code(tokens.rotate(laptop.token))).toBe("REFRESH_INVALID");
    expect(await code(tokens.rotate(other.token))).toBe("ok");
  });

  it("honours custom lifetimes", async () => {
    const { c, tokens } = setup({ idleSec: 60, maxSec: 3600 });
    const a = await tokens.issue("u1");
    c.advance(61_000);
    expect(await code(tokens.rotate(a.token))).toBe("REFRESH_EXPIRED");
  });
});

describe("refresh cookie", () => {
  const app = async () => {
    const a = createApp({ env: "test" });
    a.mount(
      "/c",
      Router()
        .get("/set", noStore, (_q, res) => (setRefreshCookie(res, "T".repeat(43), { secure: true, maxAgeSec: 604800 }), sendSuccess(res, {})))
        .get("/set-dev", (_q, res) => (setRefreshCookie(res, "T".repeat(43), { secure: false, maxAgeSec: 60 }), sendSuccess(res, {})))
        .get("/clear", (_q, res) => (clearRefreshCookie(res, { secure: true }), sendSuccess(res, {})))
        .get("/read", (req, res) => sendSuccess(res, { v: readCookie(req) ?? null })),
    );
    return (await a.ready()).express;
  };

  it("is httpOnly, SameSite=Strict, scoped to /api/auth, and Secure when asked", async () => {
    const e = await app();
    const c = (await request(e).get("/c/set")).headers["set-cookie"]![0]!;
    for (const f of ["rhea_refresh=" + "T".repeat(43), "Max-Age=604800", "Path=/api/auth", "HttpOnly", "SameSite=Strict", "Secure"]) expect(c).toContain(f);
    expect((await request(e).get("/c/set-dev")).headers["set-cookie"]![0]).not.toContain("Secure");
  });

  it("clear removes it", async () => {
    const c = (await request(await app()).get("/c/clear")).headers["set-cookie"]![0]!;
    expect(c).toContain("rhea_refresh=;");
    expect(c).toContain("Max-Age=0");
  });

  it("noStore sets Cache-Control: no-store", async () => {
    expect((await request(await app()).get("/c/set")).headers["cache-control"]).toBe("no-store");
  });

  it("reads one cookie out of many, and ignores a missing, oversized or look-alike cookie", async () => {
    const e = await app();
    const read = async (h?: string) => (await (h ? request(e).get("/c/read").set("Cookie", h) : request(e).get("/c/read"))).body.data.v;
    expect(await read("a=1; rhea_refresh=abc; b=2")).toBe("abc");
    expect(await read("rhea_refresh_x=abc; xrhea_refresh=zzz")).toBeNull();
    expect(await read()).toBeNull();
    expect(await read("rhea_refresh=" + "a".repeat(5000))).toBeNull();
  });

  it("assertAllowedOrigin needs an Origin from the allow-list", () => {
    const req = (origin?: string) => ({ headers: origin ? { origin } : {} }) as never;
    expect(() => assertAllowedOrigin(req("https://app.example.com"), ["https://app.example.com"])).not.toThrow();
    for (const o of [undefined, "https://evil.example", "https://app.example.com.evil.io", "null"]) {
      expect(() => assertAllowedOrigin(req(o), ["https://app.example.com"]), String(o)).toThrowError(
        expect.objectContaining({ code: "CSRF_ORIGIN", status: 403 }),
      );
    }
    expect(() => assertAllowedOrigin(req("https://app.example.com"), [])).toThrow();
  });
});

describe("lockout policy", () => {
  const t0 = new Date("2026-10-13T10:00:00Z");
  const lock = createLockout();
  it("locks on the 5th consecutive failure for 15 minutes", () => {
    let s = lock.afterSuccess();
    for (let i = 1; i <= 4; i++) {
      s = lock.afterFailure(s, t0);
      expect(lock.status(s, t0).locked, `after ${i}`).toBe(false);
    }
    s = lock.afterFailure(s, t0);
    expect(lock.status(s, t0)).toEqual({ locked: true, retryAfterSec: 900 });
    expect(lock.status(s, new Date(t0.getTime() + 899_000)).locked).toBe(true);
    expect(lock.status(s, new Date(t0.getTime() + 900_000)).locked).toBe(false);
  });
  it("a success resets the count, and a finished lock starts a new count", () => {
    let s = { failedLogins: 4, lockedUntil: null as Date | null };
    expect(lock.afterSuccess()).toEqual({ failedLogins: 0, lockedUntil: null });
    s = lock.afterFailure(s, t0);
    const after = new Date(t0.getTime() + 901_000);
    s = lock.afterFailure(s, after);
    expect(s.failedLogins).toBe(1);
    expect(lock.status(s, after).locked).toBe(false);
  });
  it("is configurable", () => {
    const l = createLockout({ maxFailures: 2, lockSec: 60 });
    const s = l.afterFailure(l.afterFailure(l.afterSuccess(), t0), t0);
    expect(l.status(s, t0)).toEqual({ locked: true, retryAfterSec: 60 });
  });
});

describe("common passwords", () => {
  it("flags common words with obvious suffixes, number runs and repeats, ignoring case", () => {
    for (const p of ["password1234", "Password123456", "qwerty123456", "iloveyou1234", "123456789012", "aaaaaaaaaaaa", "abcabcabcabc", "Welcome2026"]) {
      expect(isCommonPassword(p), p).toBe(true);
    }
  });
  it("lets real passphrases through", () => {
    for (const p of ["correct-horse-battery", "tractor violet sandwich 42", "N0t-in-any-list-xq7"]) expect(isCommonPassword(p), p).toBe(false);
    expect(isCommonPassword(5 as never)).toBe(false);
  });
});

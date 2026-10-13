import { createHash, randomBytes, randomUUID } from "node:crypto";
import { UnauthorizedError } from "@rheajs/core";

/** One stored refresh token. Only a hash of the token is ever stored, never the token. */
export interface RefreshRecord {
  id: string;
  userId: string;
  /** All tokens issued from one login share a family, so one replay can revoke the whole chain. */
  familyId: string;
  tokenHash: string;
  createdAt: Date;
  expiresAt: Date;
  /** The family cannot be extended past this moment, however often it rotates. */
  familyExpiresAt: Date;
  usedAt: Date | null;
  revokedAt: Date | null;
}

/** Storage the app provides (MongoDB, MySQL, Redis ...). `createMemoryRefreshStore` is for tests. */
export interface RefreshTokenStore {
  create(record: RefreshRecord): Promise<void>;
  findByHash(tokenHash: string): Promise<RefreshRecord | null>;
  /** Sets `usedAt` only if it is still null. Must be atomic. Returns true when this call claimed the token. */
  markUsed(id: string, at: Date): Promise<boolean>;
  revokeFamily(familyId: string, at: Date): Promise<void>;
  revokeUser(userId: string, at: Date): Promise<void>;
}

export interface RefreshConfig {
  store: RefreshTokenStore;
  /** A token not used for this long expires. Default 7 days. */
  idleSec?: number;
  /** A login session ends this long after login, however active. Default 30 days. */
  maxSec?: number;
  /**
   * After a token is rotated, a second use within this many seconds is treated as two parallel requests (a double click,
   * a retry), not as theft: it fails with REFRESH_CONFLICT and the family is kept. Default 10.
   */
  graceSec?: number;
  /** Clock for tests. */
  now?: () => Date;
}

export interface IssuedRefreshToken {
  /** Give this to the client once. It cannot be read back. */
  token: string;
  expiresAt: Date;
  userId: string;
  familyId: string;
}

export interface RefreshTokens {
  /** Starts a new family for a user who just logged in. */
  issue(userId: string): Promise<IssuedRefreshToken>;
  /** Exchanges a refresh token for a new one. Throws UnauthorizedError REFRESH_INVALID, REFRESH_EXPIRED, REFRESH_REUSED or REFRESH_CONFLICT. */
  rotate(token: string): Promise<IssuedRefreshToken>;
  /** Ends the session the token belongs to. Never throws for an unknown token, so logout can be repeated. */
  revoke(token: string): Promise<void>;
  /** Ends every session of a user (log out everywhere). */
  revokeAll(userId: string): Promise<void>;
}

const SHAPE = /^[A-Za-z0-9_-]{43}$/;
const hash = (token: string): string => createHash("sha256").update(token).digest("hex");
const fail = (code: string, message: string) => new UnauthorizedError(message, { code });

/**
 * Rotating refresh tokens with reuse detection.
 * The token is 32 random bytes, so a fast SHA-256 is enough to store it (there is nothing to brute-force).
 */
export function createRefreshTokens(config: RefreshConfig): RefreshTokens {
  const { store } = config;
  const idleMs = (config.idleSec ?? 7 * 86_400) * 1000;
  const maxMs = (config.maxSec ?? 30 * 86_400) * 1000;
  const graceMs = (config.graceSec ?? 10) * 1000;
  const now = config.now ?? (() => new Date());

  async function mint(userId: string, familyId: string, familyExpiresAt: Date, at: Date): Promise<IssuedRefreshToken> {
    const token = randomBytes(32).toString("base64url");
    const expiresAt = new Date(Math.min(at.getTime() + idleMs, familyExpiresAt.getTime()));
    await store.create({
      id: randomUUID(),
      userId,
      familyId,
      tokenHash: hash(token),
      createdAt: at,
      expiresAt,
      familyExpiresAt,
      usedAt: null,
      revokedAt: null,
    });
    return { token, expiresAt, userId, familyId };
  }

  return {
    async issue(userId) {
      const at = now();
      return mint(userId, randomUUID(), new Date(at.getTime() + maxMs), at);
    },

    async rotate(token) {
      if (typeof token !== "string" || !SHAPE.test(token)) throw fail("REFRESH_INVALID", "Invalid refresh token");
      const rec = await store.findByHash(hash(token));
      if (!rec || rec.revokedAt) throw fail("REFRESH_INVALID", "Invalid refresh token");
      const at = now();
      if (rec.usedAt) {
        if (at.getTime() - rec.usedAt.getTime() <= graceMs) throw fail("REFRESH_CONFLICT", "Refresh token was just used. Retry with the newest token");
        // An old token came back after its replacement was issued: it was copied. End the whole session.
        await store.revokeFamily(rec.familyId, at);
        throw fail("REFRESH_REUSED", "Refresh token reuse detected. Sign in again");
      }
      if (at >= rec.expiresAt || at >= rec.familyExpiresAt) throw fail("REFRESH_EXPIRED", "Refresh token expired. Sign in again");
      // Atomic claim: of two simultaneous requests with the same token, only one gets true.
      if (!(await store.markUsed(rec.id, at))) throw fail("REFRESH_CONFLICT", "Refresh token was just used. Retry with the newest token");
      return mint(rec.userId, rec.familyId, rec.familyExpiresAt, at);
    },

    async revoke(token) {
      if (typeof token !== "string" || !SHAPE.test(token)) return;
      const rec = await store.findByHash(hash(token));
      if (rec) await store.revokeFamily(rec.familyId, now());
    },

    async revokeAll(userId) {
      await store.revokeUser(userId, now());
    },
  };
}

/** In-memory store for tests and demos. Not shared between processes and lost on restart: do not use it in production. */
export function createMemoryRefreshStore(): RefreshTokenStore & { records: RefreshRecord[] } {
  const records: RefreshRecord[] = [];
  return {
    records,
    async create(r) {
      records.push({ ...r });
    },
    async findByHash(h) {
      const r = records.find((x) => x.tokenHash === h);
      return r ? { ...r } : null;
    },
    async markUsed(id, at) {
      const r = records.find((x) => x.id === id);
      if (!r || r.usedAt) return false;
      r.usedAt = at;
      return true;
    },
    async revokeFamily(familyId, at) {
      for (const r of records) if (r.familyId === familyId && !r.revokedAt) r.revokedAt = at;
    },
    async revokeUser(userId, at) {
      for (const r of records) if (r.userId === userId && !r.revokedAt) r.revokedAt = at;
    },
  };
}

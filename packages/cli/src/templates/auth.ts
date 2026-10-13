import type { Files } from "./parts.js";
import type { ProjectOptions } from "./options.js";
import { syntax, tidy } from "./syntax.js";

/**
 * Files for the optional authentication module: users in the chosen database, register, login, refresh tokens with
 * rotation and reuse detection, logout, account lockout, and a protected /me route.
 */
export function authFiles(o: ProjectOptions): Files {
  const s = syntax(o);
  const { t, imp, impType, exp, rel } = s;
  const E = s.ext;
  const T = s.testExt;
  const bang = s.ts ? "!" : "";
  const mongo = o.database === "mongodb";

  const types = s.ts
    ? tidy(`export interface User {
  id: string;
  email: string;
  passwordHash: string;
  roles: string[];
  createdAt: Date;
  /** Consecutive wrong passwords. Reset by a correct one. */
  failedLogins: number;
  /** Logins are refused until this moment. */
  lockedUntil: Date | null;
}

/** What the service needs from storage. The MongoDB or MySQL implementation lives in auth.repository. */
export interface UserRepository {
  findByEmail(email: string): Promise<User | null>;
  findById(id: string): Promise<User | null>;
  /** Throws ConflictError (EMAIL_TAKEN) when the email already exists. */
  create(input: { email: string; passwordHash: string; roles: string[] }): Promise<User>;
  updatePasswordHash(id: string, passwordHash: string): Promise<void>;
  /** Saves the lockout counters after a login attempt. */
  saveLockout(id: string, state: { failedLogins: number; lockedUntil: Date | null }): Promise<void>;
}
`)
    : "";

  const repository = mongo
    ? tidy(`${imp(["randomUUID"], "node:crypto")}
${imp(["ConflictError"], "@rheajs/core")}
${imp(["getDb"], rel("../../config/database"))}
${imp(["ensureRefreshStore"], rel("./auth.refresh-store"))}
${impType(["User", "UserRepository"], rel("./auth.types"))}

${s.ts ? "interface UserDoc {\n  _id: string;\n  email: string;\n  passwordHash: string;\n  roles: string[];\n  createdAt: Date;\n  failedLogins?: number;\n  lockedUntil?: Date | null;\n}\n" : ""}
const users = () => getDb().collection${t("<UserDoc>")}("users");

const toUser = (d${t(": UserDoc")})${t(": User")} => ({
  id: d._id,
  email: d.email,
  passwordHash: d.passwordHash,
  roles: d.roles,
  createdAt: d.createdAt,
  failedLogins: d.failedLogins ?? 0,
  lockedUntil: d.lockedUntil ?? null,
});

/** Creates the indexes the auth module needs. Safe to run on every start. */
async function ensureUserStore()${t(": Promise<void>")} {
  await users().createIndex({ email: 1 }, { unique: true });
  await ensureRefreshStore();
}

const userRepository${t(": UserRepository")} = {
  async findByEmail(email) {
    const d = await users().findOne({ email });
    return d ? toUser(d) : null;
  },
  async findById(id) {
    const d = await users().findOne({ _id: id });
    return d ? toUser(d) : null;
  },
  async create({ email, passwordHash, roles }) {
    const doc${t(": UserDoc")} = { _id: randomUUID(), email, passwordHash, roles, createdAt: new Date(), failedLogins: 0, lockedUntil: null };
    try {
      await users().insertOne(doc);
    } catch (err) {
      if ((err${t(" as { code?: number }")}).code === 11000) throw new ConflictError("Email already registered", { code: "EMAIL_TAKEN" });
      throw err;
    }
    return toUser(doc);
  },
  async updatePasswordHash(id, passwordHash) {
    await users().updateOne({ _id: id }, { $set: { passwordHash } });
  },
  async saveLockout(id, { failedLogins, lockedUntil }) {
    await users().updateOne({ _id: id }, { $set: { failedLogins, lockedUntil } });
  },
};

${exp(["userRepository", "ensureUserStore"])}
`)
    : tidy(`${imp(["randomUUID"], "node:crypto")}
${imp(["ConflictError"], "@rheajs/core")}
${impType(["RowDataPacket"], "mysql2/promise")}
${imp(["getPool"], rel("../../config/database"))}
${imp(["ensureRefreshStore"], rel("./auth.refresh-store"))}
${impType(["User", "UserRepository"], rel("./auth.types"))}

${s.ts ? "interface UserRow extends RowDataPacket {\n  id: string;\n  email: string;\n  password_hash: string;\n  roles: string;\n  created_at: Date;\n  failed_logins: number;\n  locked_until: Date | null;\n}\n" : ""}
const toUser = (r${t(": UserRow")})${t(": User")} => ({
  id: r.id,
  email: r.email,
  passwordHash: r.password_hash,
  roles: r.roles ? r.roles.split(",") : [],
  createdAt: r.created_at,
  failedLogins: r.failed_logins ?? 0,
  lockedUntil: r.locked_until ?? null,
});

/** Creates the tables the auth module needs, and adds new columns to a users table from an older version. Move this to a migration tool once your schema grows. */
async function ensureUserStore()${t(": Promise<void>")} {
  await getPool().query(
    "CREATE TABLE IF NOT EXISTS users (" +
      "id CHAR(36) NOT NULL PRIMARY KEY, " +
      "email VARCHAR(254) NOT NULL, " +
      "password_hash VARCHAR(255) NOT NULL, " +
      "roles VARCHAR(255) NOT NULL, " +
      "created_at DATETIME(3) NOT NULL, " +
      "failed_logins INT NOT NULL DEFAULT 0, " +
      "locked_until DATETIME(3) NULL, " +
      "UNIQUE KEY users_email_unique (email)" +
      ") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4",
  );
  const [columns] = await getPool().query${t("<RowDataPacket[]>")}(
    "SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'failed_logins'",
  );
  if (columns.length === 0) await getPool().query("ALTER TABLE users ADD COLUMN failed_logins INT NOT NULL DEFAULT 0, ADD COLUMN locked_until DATETIME(3) NULL");
  await ensureRefreshStore();
}

const userRepository${t(": UserRepository")} = {
  async findByEmail(email) {
    const [rows] = await getPool().execute${t("<UserRow[]>")}("SELECT * FROM users WHERE email = ? LIMIT 1", [email]);
    return rows[0] ? toUser(rows[0]) : null;
  },
  async findById(id) {
    const [rows] = await getPool().execute${t("<UserRow[]>")}("SELECT * FROM users WHERE id = ? LIMIT 1", [id]);
    return rows[0] ? toUser(rows[0]) : null;
  },
  async create({ email, passwordHash, roles }) {
    const id = randomUUID();
    const createdAt = new Date();
    try {
      await getPool().execute("INSERT INTO users (id, email, password_hash, roles, created_at) VALUES (?, ?, ?, ?, ?)", [id, email, passwordHash, roles.join(","), createdAt]);
    } catch (err) {
      if ((err${t(" as { code?: string }")}).code === "ER_DUP_ENTRY") throw new ConflictError("Email already registered", { code: "EMAIL_TAKEN" });
      throw err;
    }
    return { id, email, passwordHash, roles, createdAt, failedLogins: 0, lockedUntil: null };
  },
  async updatePasswordHash(id, passwordHash) {
    await getPool().execute("UPDATE users SET password_hash = ? WHERE id = ?", [passwordHash, id]);
  },
  async saveLockout(id, { failedLogins, lockedUntil }) {
    await getPool().execute("UPDATE users SET failed_logins = ?, locked_until = ? WHERE id = ?", [failedLogins, lockedUntil, id]);
  },
};

${exp(["userRepository", "ensureUserStore"])}
`);

  const refreshStore = mongo
    ? tidy(`${impType(["RefreshRecord", "RefreshTokenStore"], "@rheajs/auth")}
${imp(["getDb"], rel("../../config/database"))}

${s.ts ? "interface TokenDoc {\n  _id: string;\n  userId: string;\n  familyId: string;\n  tokenHash: string;\n  createdAt: Date;\n  expiresAt: Date;\n  familyExpiresAt: Date;\n  usedAt: Date | null;\n  revokedAt: Date | null;\n}\n" : ""}
const tokens = () => getDb().collection${t("<TokenDoc>")}("refresh_tokens");

const toRecord = (d${t(": TokenDoc")})${t(": RefreshRecord")} => ({
  id: d._id,
  userId: d.userId,
  familyId: d.familyId,
  tokenHash: d.tokenHash,
  createdAt: d.createdAt,
  expiresAt: d.expiresAt,
  familyExpiresAt: d.familyExpiresAt,
  usedAt: d.usedAt ?? null,
  revokedAt: d.revokedAt ?? null,
});

/** Indexes for refresh tokens. MongoDB deletes a record one day after its session limit, when nothing can use it any more. */
async function ensureRefreshStore()${t(": Promise<void>")} {
  await tokens().createIndex({ tokenHash: 1 }, { unique: true });
  await tokens().createIndex({ familyId: 1 });
  await tokens().createIndex({ userId: 1 });
  await tokens().createIndex({ familyExpiresAt: 1 }, { expireAfterSeconds: 86_400 });
}

/** Only a hash of each token is stored, never the token. */
const refreshStore${t(": RefreshTokenStore")} = {
  async create(r) {
    await tokens().insertOne({
      _id: r.id,
      userId: r.userId,
      familyId: r.familyId,
      tokenHash: r.tokenHash,
      createdAt: r.createdAt,
      expiresAt: r.expiresAt,
      familyExpiresAt: r.familyExpiresAt,
      usedAt: null,
      revokedAt: null,
    });
  },
  async findByHash(tokenHash) {
    const d = await tokens().findOne({ tokenHash });
    return d ? toRecord(d) : null;
  },
  // The filter makes the claim atomic: of two simultaneous requests, only one modifies the document.
  async markUsed(id, at) {
    const r = await tokens().updateOne({ _id: id, usedAt: null }, { $set: { usedAt: at } });
    return r.modifiedCount === 1;
  },
  async revokeFamily(familyId, at) {
    await tokens().updateMany({ familyId, revokedAt: null }, { $set: { revokedAt: at } });
  },
  async revokeUser(userId, at) {
    await tokens().updateMany({ userId, revokedAt: null }, { $set: { revokedAt: at } });
  },
};

${exp(["refreshStore", "ensureRefreshStore"])}
`)
    : tidy(`${impType(["RefreshRecord", "RefreshTokenStore"], "@rheajs/auth")}
${impType(["ResultSetHeader", "RowDataPacket"], "mysql2/promise")}
${imp(["getPool"], rel("../../config/database"))}

${s.ts ? "interface TokenRow extends RowDataPacket {\n  id: string;\n  user_id: string;\n  family_id: string;\n  token_hash: string;\n  created_at: Date;\n  expires_at: Date;\n  family_expires_at: Date;\n  used_at: Date | null;\n  revoked_at: Date | null;\n}\n" : ""}
const toRecord = (r${t(": TokenRow")})${t(": RefreshRecord")} => ({
  id: r.id,
  userId: r.user_id,
  familyId: r.family_id,
  tokenHash: r.token_hash,
  createdAt: r.created_at,
  expiresAt: r.expires_at,
  familyExpiresAt: r.family_expires_at,
  usedAt: r.used_at ?? null,
  revokedAt: r.revoked_at ?? null,
});

/** Creates the refresh token table and removes records one day past their session limit, when nothing can use them any more. */
async function ensureRefreshStore()${t(": Promise<void>")} {
  await getPool().query(
    "CREATE TABLE IF NOT EXISTS refresh_tokens (" +
      "id CHAR(36) NOT NULL PRIMARY KEY, " +
      "user_id CHAR(36) NOT NULL, " +
      "family_id CHAR(36) NOT NULL, " +
      "token_hash CHAR(64) NOT NULL, " +
      "created_at DATETIME(3) NOT NULL, " +
      "expires_at DATETIME(3) NOT NULL, " +
      "family_expires_at DATETIME(3) NOT NULL, " +
      "used_at DATETIME(3) NULL, " +
      "revoked_at DATETIME(3) NULL, " +
      "UNIQUE KEY refresh_tokens_hash (token_hash), " +
      "KEY refresh_tokens_family (family_id), " +
      "KEY refresh_tokens_user (user_id), " +
      "KEY refresh_tokens_expiry (family_expires_at)" +
      ") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4",
  );
  await getPool().query("DELETE FROM refresh_tokens WHERE family_expires_at < (NOW() - INTERVAL 1 DAY)");
}

/** Only a hash of each token is stored, never the token. */
const refreshStore${t(": RefreshTokenStore")} = {
  async create(r) {
    await getPool().execute(
      "INSERT INTO refresh_tokens (id, user_id, family_id, token_hash, created_at, expires_at, family_expires_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [r.id, r.userId, r.familyId, r.tokenHash, r.createdAt, r.expiresAt, r.familyExpiresAt],
    );
  },
  async findByHash(tokenHash) {
    const [rows] = await getPool().execute${t("<TokenRow[]>")}("SELECT * FROM refresh_tokens WHERE token_hash = ? LIMIT 1", [tokenHash]);
    return rows[0] ? toRecord(rows[0]) : null;
  },
  // The "used_at IS NULL" condition makes the claim atomic: of two simultaneous requests, only one updates a row.
  async markUsed(id, at) {
    const [result] = await getPool().execute${t("<ResultSetHeader>")}("UPDATE refresh_tokens SET used_at = ? WHERE id = ? AND used_at IS NULL", [at, id]);
    return result.affectedRows === 1;
  },
  async revokeFamily(familyId, at) {
    await getPool().execute("UPDATE refresh_tokens SET revoked_at = ? WHERE family_id = ? AND revoked_at IS NULL", [at, familyId]);
  },
  async revokeUser(userId, at) {
    await getPool().execute("UPDATE refresh_tokens SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL", [at, userId]);
  },
};

${exp(["refreshStore", "ensureRefreshStore"])}
`);

  const service = tidy(`${imp(["AppError", "ConflictError", "NotFoundError", "UnauthorizedError"], "@rheajs/core")}
${imp(["hashPassword", "needsRehash", "verifyPassword"], "@rheajs/auth")}
${impType(["IssuedRefreshToken", "Jwt", "Lockout", "PasswordOptions", "RefreshTokens"], "@rheajs/auth")}
${impType(["User", "UserRepository"], rel("./auth.types"))}

${s.ts ? "interface Credentials {\n  email: string;\n  password: string;\n}\n\ninterface AuthDeps {\n  jwt: Jwt;\n  refresh: RefreshTokens;\n  lockout: Lockout;\n  /** Override the password hashing cost. Tests use a low cost. Leave unset in production. */\n  password?: PasswordOptions;\n}\n" : ""}
/** Thrown while an account is locked. The route turns \`retryAfterSec\` into a Retry-After header. */
class AccountLockedError extends AppError {
  ${s.ts ? "readonly retryAfterSec: number;\n  " : ""}constructor(retryAfterSec${t(": number")}) {
    super(429, "ACCOUNT_LOCKED", "Too many failed sign-in attempts. Try again later.", { expose: true });
    this.retryAfterSec = retryAfterSec;
  }
}

/** The user as clients see it. The password hash and lockout counters never leave the service. */
const publicUser = (u${t(": User")}) => ({ id: u.id, email: u.email, roles: u.roles, createdAt: u.createdAt });

function createAuthService(repo${t(": UserRepository")}, { jwt, refresh, lockout, password }${t(": AuthDeps")}) {
  /** An access token (short-lived) and a refresh token (long-lived, rotated on every use). */
  async function session(u${t(": User")}, refreshToken${t(": IssuedRefreshToken")}) {
    return {
      user: publicUser(u),
      accessToken: await jwt.sign({ sub: u.id, roles: u.roles }),
      tokenType: "Bearer",
      refreshToken: refreshToken.token,
      refreshExpiresAt: refreshToken.expiresAt,
    };
  }

  return {
    async register({ email, password: plain }${t(": Credentials")}) {
      // Cheap duplicate check first, so a repeated email does not cost a full password hash. The unique index still decides races.
      if (await repo.findByEmail(email)) throw new ConflictError("Email already registered", { code: "EMAIL_TAKEN" });
      const user = await repo.create({ email, passwordHash: await hashPassword(plain, password), roles: ["user"] });
      return session(user, await refresh.issue(user.id));
    },

    async login({ email, password: plain }${t(": Credentials")}) {
      const user = await repo.findByEmail(email);
      if (user) {
        // A locked account is refused before any password work, and the refusal does not extend the lock.
        const state = lockout.status(user);
        if (state.locked) throw new AccountLockedError(state.retryAfterSec);
      }
      // Verifies against a dummy hash when the user does not exist, so timing does not reveal registered emails.
      const ok = await verifyPassword(plain, user?.passwordHash ?? null);
      if (!user || !ok) {
        if (user) await repo.saveLockout(user.id, lockout.afterFailure(user));
        throw new UnauthorizedError("Invalid email or password", { code: "INVALID_CREDENTIALS" });
      }
      if (user.failedLogins > 0 || user.lockedUntil) await repo.saveLockout(user.id, lockout.afterSuccess());
      if (needsRehash(user.passwordHash, password)) await repo.updatePasswordHash(user.id, await hashPassword(plain, password));
      return session(user, await refresh.issue(user.id));
    },

    /** Trades a refresh token for a new access token and a new refresh token. The presented token stops working. */
    async refresh(token${t(": string")}) {
      const next = await refresh.rotate(token);
      const user = await repo.findById(next.userId);
      if (!user) {
        await refresh.revokeAll(next.userId);
        throw new UnauthorizedError("Invalid refresh token", { code: "REFRESH_INVALID" });
      }
      return session(user, next);
    },

    /** Ends the session the refresh token belongs to. Safe to repeat. */
    async logout(token${t(": string")}) {
      await refresh.revoke(token);
    },

    /** Ends every session of the user. */
    async logoutAll(userId${t(": string")}) {
      await refresh.revokeAll(userId);
    },

    async me(id${t(": string")}) {
      const user = await repo.findById(id);
      if (!user) throw new NotFoundError("User not found");
      return publicUser(user);
    },
  };
}

${exp(["createAuthService", "AccountLockedError"])}
`);

  const schema = tidy(`${imp(["z"], "@rheajs/core")}
${imp(["isCommonPassword"], "@rheajs/auth")}

const email = z.string().trim().toLowerCase().pipe(z.email().max(254));

const registerSchema = z.object({
  email,
  // At least 12 characters. Length matters more than symbols. Hashing allows up to 128.
  password: z
    .string()
    .min(12, "must be at least 12 characters")
    .max(128)
    .refine((p) => !isCommonPassword(p), "is too common. Choose a longer, less guessable password"),
});

const loginSchema = z.object({
  email,
  password: z.string().min(1).max(128),
});

/** Body mode: the client sends the refresh token it was given. In cookie mode the body is ignored and the cookie is used. */
const refreshSchema = z.object({
  refreshToken: z.string().length(43),
});

${exp(["registerSchema", "loginSchema", "refreshSchema"])}
`);

  const routes = tidy(`${imp(["Router", "UnauthorizedError", "rateLimiter", "sendSuccess", "validate"], "@rheajs/core")}
${impType(["Request", "Response"], "@rheajs/core")}
${imp(["assertAllowedOrigin", "authenticate", "clearRefreshCookie", "noStore", "readCookie", "setRefreshCookie"], "@rheajs/auth")}
${impType(["Jwt"], "@rheajs/auth")}
${imp(["authCookie", "authServiceDeps", "jwt"], rel("../../config/auth"))}
${imp(["createAuthService"], rel("./auth.service"))}
${imp(["userRepository"], rel("./auth.repository"))}
${imp(["loginSchema", "refreshSchema", "registerSchema"], rel("./auth.schema"))}

${s.ts ? "type Service = ReturnType<typeof createAuthService>;\n\n/** Cookie settings from config/auth.\n *  enabled: the refresh token travels in an httpOnly cookie instead of the JSON body. */\ninterface CookieMode {\n  enabled: boolean;\n  secure: boolean;\n  maxAgeSec: number;\n  allowedOrigins: string[];\n}\n" : ""}
/** Builds the auth routes. Passing the service, the token signer and the cookie settings in keeps the routes testable without a database. */
function createAuthRouter(service${t(": Service")}, tokens${t(": Jwt")}, cookie${t(": CookieMode")}) {
  const router = Router();
  const cookieOptions = { secure: cookie.secure, maxAgeSec: cookie.maxAgeSec };
  // Slow down password guessing and mass sign-ups. Counters are per process: pass a shared store to rateLimiter() when you run several instances.
  const attempts = { limit: 10, windowMs: 15 * 60_000 };
  const refreshes = { limit: 60, windowMs: 15 * 60_000 };

  // Tokens must never be stored by a browser, proxy or CDN.
  router.use(noStore);

  /** Sends a session. In cookie mode the refresh token goes into the cookie and out of the JSON. */
  function send(res${t(": Response")}, result${t(': Awaited<ReturnType<Service["login"]>>')}, message${t(": string")}, status = 200) {
    const { refreshToken, ...body } = result;
    if (cookie.enabled) {
      setRefreshCookie(res, refreshToken, cookieOptions);
      return sendSuccess(res, body, message, status);
    }
    return sendSuccess(res, result, message, status);
  }

  /** Finds the refresh token the way the mode says. In cookie mode the request must also come from an allowed origin (CSRF). */
  function refreshTokenOf(req${t(": Request")})${t(": string")} {
    if (cookie.enabled) {
      assertAllowedOrigin(req, cookie.allowedOrigins);
      const fromCookie = readCookie(req);
      if (!fromCookie) throw new UnauthorizedError("Invalid refresh token", { code: "REFRESH_INVALID" });
      return fromCookie;
    }
    return req.body.refreshToken;
  }

  const tokenRoute = cookie.enabled ? [] : [validate(refreshSchema)];

  router.post("/register", rateLimiter(attempts), validate(registerSchema), async (req, res) =>
    send(res, await service.register(req.body), "Registered", 201),
  );

  router.post("/login", rateLimiter(attempts), validate(loginSchema), async (req, res) => {
    try {
      return send(res, await service.login(req.body), "Logged in");
    } catch (err) {
      // Matched by code, not by class, so it also works when a bundler or test runner loads the service twice.
      const locked = err${t(" as { code?: string; retryAfterSec?: number }")};
      if (locked.code === "ACCOUNT_LOCKED" && typeof locked.retryAfterSec === "number") res.setHeader("Retry-After", String(locked.retryAfterSec));
      throw err;
    }
  });

  router.post("/refresh", rateLimiter(refreshes), ...tokenRoute, async (req, res) => {
    try {
      return send(res, await service.refresh(refreshTokenOf(req)), "Refreshed");
    } catch (err) {
      // A cookie that no longer works is cleared, so the browser stops sending it. A request refused as forged (CSRF_ORIGIN) must not touch the real cookie.
      const failed = err${t(" as { code?: string }")};
      if (cookie.enabled && failed.code !== "CSRF_ORIGIN") clearRefreshCookie(res, cookieOptions);
      throw err;
    }
  });

  router.post("/logout", rateLimiter(refreshes), ...tokenRoute, async (req, res) => {
    await service.logout(refreshTokenOf(req));
    if (cookie.enabled) clearRefreshCookie(res, cookieOptions);
    res.status(204).end();
  });

  router.post("/logout-all", authenticate(tokens), async (req, res) => {
    await service.logoutAll(req.user${bang}.id);
    if (cookie.enabled) clearRefreshCookie(res, cookieOptions);
    res.status(204).end();
  });

  router.get("/me", authenticate(tokens), async (req, res) => sendSuccess(res, await service.me(req.user${bang}.id)));
  return router;
}

const authRouter = createAuthRouter(createAuthService(userRepository, authServiceDeps), jwt, authCookie);

${exp(["authRouter", "createAuthRouter"])}
`);

  const config = tidy(`${imp(["createJwt", "createLockout", "createRefreshTokens"], "@rheajs/auth")}
${imp(["env"], rel("./env"))}
${imp(["refreshStore"], rel("../modules/auth/auth.refresh-store"))}

/** Signs and verifies access tokens. The secret comes from JWT_SECRET (at least 32 characters). */
const jwt = createJwt({
  secret: env.JWT_SECRET,
  issuer: env.JWT_ISSUER,
  audience: env.JWT_AUDIENCE,
  expiresIn: env.JWT_EXPIRES_IN,
});

/** Refresh tokens: random, stored hashed, rotated on every use. Reusing an old one ends the whole session. */
const refresh = createRefreshTokens({
  store: refreshStore,
  idleSec: env.REFRESH_TOKEN_IDLE_DAYS * 86_400,
  maxSec: env.REFRESH_TOKEN_MAX_DAYS * 86_400,
});

/** 5 wrong passwords lock an account for 15 minutes. */
const lockout = createLockout({ maxFailures: 5, lockSec: 900 });

if (env.AUTH_REFRESH_COOKIE && env.CORS_ORIGIN.length === 0)
  throw new Error("AUTH_REFRESH_COOKIE=true needs CORS_ORIGIN: the browser origins allowed to call /api/auth/refresh.");

/** AUTH_REFRESH_COOKIE=true keeps the refresh token in an httpOnly cookie that page scripts cannot read. */
const authCookie = {
  enabled: env.AUTH_REFRESH_COOKIE,
  secure: env.NODE_ENV === "production",
  maxAgeSec: env.REFRESH_TOKEN_IDLE_DAYS * 86_400,
  allowedOrigins: env.CORS_ORIGIN,
};

const authServiceDeps = { jwt, refresh, lockout };

${exp(["jwt", "refresh", "lockout", "authCookie", "authServiceDeps"])}
`);

  const test = tidy(`import { randomUUID } from "node:crypto";
import { createApp } from "@rheajs/core";
import { createJwt, createLockout, createMemoryRefreshStore, createRefreshTokens } from "@rheajs/auth";
import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { createAuthRouter } from "../../src/modules/auth/auth.routes.js";
import { createAuthService } from "../../src/modules/auth/auth.service.js";
${s.ts ? 'import type { UserRepository, User } from "../../src/modules/auth/auth.types.js";\nimport type { RheaApp } from "@rheajs/core";' : ""}

// In-memory users and refresh tokens, so these tests need no database. A low hashing cost keeps them fast: never do that in real code.
function memoryRepository()${t(": UserRepository")} {
  const users${t(": User[]")} = [];
  return {
    async findByEmail(email) {
      return users.find((u) => u.email === email) ?? null;
    },
    async findById(id) {
      return users.find((u) => u.id === id) ?? null;
    },
    async create({ email, passwordHash, roles }) {
      const user = { id: randomUUID(), email, passwordHash, roles, createdAt: new Date(), failedLogins: 0, lockedUntil: null };
      users.push(user);
      return user;
    },
    async updatePasswordHash(id, passwordHash) {
      const u = users.find((x) => x.id === id);
      if (u) u.passwordHash = passwordHash;
    },
    async saveLockout(id, state) {
      const u = users.find((x) => x.id === id);
      if (u) Object.assign(u, state);
    },
  };
}

const jwt = createJwt({ secret: "t".repeat(40), issuer: "test", audience: "test-clients" });
const pw = "a-long-test-" + "pass";
const wrongPw = "not-the-" + "right-one";
const good = { email: "Ada@Example.com", password: pw };

async function build(cookie = { enabled: false, secure: false, maxAgeSec: 604800, allowedOrigins: []${s.ts ? " as string[]" : ""} }) {
  const service = createAuthService(memoryRepository(), {
    jwt,
    // graceSec 0: a replayed token counts as theft at once, so the test does not have to wait for the 10 second window.
    refresh: createRefreshTokens({ store: createMemoryRefreshStore(), graceSec: 0 }),
    lockout: createLockout(),
    password: { cost: 1024 },
  });
  const app = createApp({ env: "test" });
  app.mount("/api/auth", createAuthRouter(service, jwt, cookie));
  return app.ready();
}
const post = (app${t(": RheaApp")}, path${t(": string")}, body${t(": object")} = {}) => request(app.express).post("/api/auth" + path).send(body);

describe("auth: register, login and tokens", () => {
  let app${t(": RheaApp")};
  beforeEach(async () => {
    app = await build();
  });

  it("registers, normalises the email and never returns the password hash", async () => {
    const res = await post(app, "/register", good);
    expect(res.status).toBe(201);
    expect(res.body.data.user.email).toBe("ada@example.com");
    expect(res.body.data.user.roles).toEqual(["user"]);
    expect(res.body.data.tokenType).toBe("Bearer");
    expect(res.body.data.accessToken).toBeTruthy();
    expect(res.body.data.refreshToken).toHaveLength(43);
    expect(JSON.stringify(res.body)).not.toMatch(/scrypt|passwordHash|failedLogins/);
  });

  it("never lets a browser or proxy keep a token response", async () => {
    const res = await post(app, "/register", good);
    expect(res.headers["cache-control"]).toBe("no-store");
  });

  it("rejects a duplicate email with 409, weak input with 422, and common passwords", async () => {
    await post(app, "/register", good);
    expect((await post(app, "/register", good)).body.error.code).toBe("EMAIL_TAKEN");
    expect((await post(app, "/register", { email: "x@example.com", password: "short" })).status).toBe(422);
    expect((await post(app, "/register", { email: "not-an-email", password: pw })).status).toBe(422);
    const common = await post(app, "/register", { email: "y@example.com", password: "password123456" });
    expect(common.status).toBe(422);
    expect(JSON.stringify(common.body)).toMatch(/too common/);
  });

  it("logs in and the access token unlocks /me", async () => {
    await post(app, "/register", good);
    const login = await post(app, "/login", { email: "ada@example.com", password: pw });
    expect(login.status).toBe(200);
    const me = await request(app.express).get("/api/auth/me").set("Authorization", \`Bearer \${login.body.data.accessToken}\`);
    expect(me.status).toBe(200);
    expect(me.body.data.email).toBe("ada@example.com");
  });

  it("gives the same 401 for a wrong password and an unknown email", async () => {
    await post(app, "/register", good);
    const wrong = await post(app, "/login", { email: "ada@example.com", password: wrongPw });
    const unknown = await post(app, "/login", { email: "nobody@example.com", password: wrongPw });
    expect(wrong.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(wrong.body.error).toEqual({ ...unknown.body.error, requestId: wrong.body.error.requestId });
    expect(wrong.body.error.code).toBe("INVALID_CREDENTIALS");
  });

  it("protects /me", async () => {
    expect((await request(app.express).get("/api/auth/me")).status).toBe(401);
    expect((await request(app.express).get("/api/auth/me").set("Authorization", "Bearer not.a.token")).status).toBe(401);
  });
});

describe("auth: refresh tokens", () => {
  let app${t(": RheaApp")};
  let first${t(": { accessToken: string; refreshToken: string }")};
  beforeEach(async () => {
    app = await build();
    first = (await post(app, "/register", good)).body.data;
  });

  it("trades a refresh token for new tokens, and the old refresh token stops working", async () => {
    const next = await post(app, "/refresh", { refreshToken: first.refreshToken });
    expect(next.status).toBe(200);
    expect(next.body.data.refreshToken).not.toBe(first.refreshToken);
    expect(next.body.data.accessToken).toBeTruthy();
    expect((await post(app, "/refresh", { refreshToken: next.body.data.refreshToken })).status).toBe(200);
  });

  it("treats a replayed old token as theft and ends the whole session", async () => {
    const next = await post(app, "/refresh", { refreshToken: first.refreshToken });
    expect(next.status).toBe(200);
    await new Promise((r) => setTimeout(r, 20));
    const replay = await post(app, "/refresh", { refreshToken: first.refreshToken });
    expect(replay.status).toBe(401);
    expect(replay.body.error.code).toBe("REFRESH_REUSED");
    // the thief and the owner are both signed out: the newest token died with the family
    const newest = await post(app, "/refresh", { refreshToken: next.body.data.refreshToken });
    expect(newest.status).toBe(401);
    expect(newest.body.error.code).toBe("REFRESH_INVALID");
  });

  it("rejects missing, malformed and unknown refresh tokens", async () => {
    expect((await post(app, "/refresh", {})).status).toBe(422);
    expect((await post(app, "/refresh", { refreshToken: "short" })).status).toBe(422);
    const unknown = await post(app, "/refresh", { refreshToken: "a".repeat(43) });
    expect(unknown.status).toBe(401);
    expect(unknown.body.error.code).toBe("REFRESH_INVALID");
  });

  it("logout ends the session and can be repeated", async () => {
    expect((await post(app, "/logout", { refreshToken: first.refreshToken })).status).toBe(204);
    expect((await post(app, "/logout", { refreshToken: first.refreshToken })).status).toBe(204);
    expect((await post(app, "/refresh", { refreshToken: first.refreshToken })).body.error.code).toBe("REFRESH_INVALID");
  });

  it("logout-all ends every session of the user", async () => {
    const second = (await post(app, "/login", { email: "ada@example.com", password: pw })).body.data;
    const out = await request(app.express).post("/api/auth/logout-all").set("Authorization", \`Bearer \${second.accessToken}\`);
    expect(out.status).toBe(204);
    expect((await post(app, "/refresh", { refreshToken: first.refreshToken })).status).toBe(401);
    expect((await post(app, "/refresh", { refreshToken: second.refreshToken })).status).toBe(401);
    expect((await request(app.express).post("/api/auth/logout-all")).status).toBe(401);
  });
});

describe("auth: account lockout", () => {
  it("locks an account after 5 wrong passwords, even for the right password, with Retry-After", async () => {
    const app = await build();
    await post(app, "/register", good);
    for (let i = 0; i < 5; i++) expect((await post(app, "/login", { email: "ada@example.com", password: wrongPw })).status).toBe(401);
    const locked = await post(app, "/login", { email: "ada@example.com", password: pw });
    expect(locked.status).toBe(429);
    expect(locked.body.error.code).toBe("ACCOUNT_LOCKED");
    expect(Number(locked.headers["retry-after"])).toBeGreaterThan(800);
  });

  it("a correct password resets the count", async () => {
    const app = await build();
    await post(app, "/register", good);
    for (let i = 0; i < 4; i++) await post(app, "/login", { email: "ada@example.com", password: wrongPw });
    expect((await post(app, "/login", { email: "ada@example.com", password: pw })).status).toBe(200);
    for (let i = 0; i < 4; i++) expect((await post(app, "/login", { email: "ada@example.com", password: wrongPw })).status).toBe(401);
  });
});

describe("auth: cookie mode", () => {
  const origin = "https://app.example.com";
  const cookieMode = { enabled: true, secure: true, maxAgeSec: 604800, allowedOrigins: [origin] };
  const cookieOf = (res${t(": request.Response")}) => String(res.headers["set-cookie"]?.[0] ?? "");

  it("keeps the refresh token out of the JSON and in an httpOnly cookie", async () => {
    const app = await build(cookieMode);
    const res = await post(app, "/register", good);
    expect(res.body.data.refreshToken).toBeUndefined();
    expect(JSON.stringify(res.body)).not.toMatch(/rhea_refresh/);
    const c = cookieOf(res);
    for (const flag of ["rhea_refresh=", "HttpOnly", "SameSite=Strict", "Secure", "Path=/api/auth"]) expect(c).toContain(flag);
  });

  it("refresh needs the cookie and an allowed Origin (CSRF check)", async () => {
    const app = await build(cookieMode);
    const cookie = cookieOf(await post(app, "/register", good)).split(";")[0]${s.ts ? "!" : ""};
    const call = (headers${t(": Record<string, string>")}) => request(app.express).post("/api/auth/refresh").set(headers);
    expect((await call({ Cookie: cookie })).status).toBe(403);
    const forged = await call({ Cookie: cookie, Origin: "https://evil.example" });
    expect(forged.body.error.code).toBe("CSRF_ORIGIN");
    // a forged request must not touch the real cookie
    expect(forged.headers["set-cookie"]).toBeUndefined();
    const ok = await call({ Cookie: cookie, Origin: origin });
    expect(ok.status).toBe(200);
    expect(ok.body.data.accessToken).toBeTruthy();
    expect(cookieOf(ok)).toContain("rhea_refresh=");
    // the old cookie value is spent
    expect((await call({ Cookie: cookie, Origin: origin })).status).toBe(401);
  });

  it("ignores a refresh token sent in the body, and logout clears the cookie", async () => {
    const app = await build(cookieMode);
    const reg = await post(app, "/register", good);
    const cookie = cookieOf(reg).split(";")[0]${s.ts ? "!" : ""};
    const bodyOnly = await request(app.express).post("/api/auth/refresh").set("Origin", origin).send({ refreshToken: "a".repeat(43) });
    expect(bodyOnly.status).toBe(401);
    const out = await request(app.express).post("/api/auth/logout").set({ Cookie: cookie, Origin: origin });
    expect(out.status).toBe(204);
    expect(cookieOf(out)).toContain("Max-Age=0");
  });
});
`);

  return {
    [`src/config/auth.${E}`]: config,
    ...(s.ts ? { [`src/modules/auth/auth.types.${E}`]: types } : {}),
    [`src/modules/auth/auth.repository.${E}`]: repository,
    [`src/modules/auth/auth.refresh-store.${E}`]: refreshStore,
    [`src/modules/auth/auth.service.${E}`]: service,
    [`src/modules/auth/auth.schema.${E}`]: schema,
    [`src/modules/auth/auth.routes.${E}`]: routes,
    [`tests/integration/auth.test.${T}`]: test,
  };
}

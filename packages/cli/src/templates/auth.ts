import type { Files } from "./parts.js";
import type { ProjectOptions } from "./options.js";
import { syntax, tidy } from "./syntax.js";

/** Files for the optional authentication module: users in the chosen database, register, login and a protected /me route. */
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
}

/** What the service needs from storage. The MongoDB or MySQL implementation lives in auth.repository. */
export interface UserRepository {
  findByEmail(email: string): Promise<User | null>;
  findById(id: string): Promise<User | null>;
  /** Throws ConflictError (EMAIL_TAKEN) when the email already exists. */
  create(input: { email: string; passwordHash: string; roles: string[] }): Promise<User>;
  updatePasswordHash(id: string, passwordHash: string): Promise<void>;
}
`)
    : "";

  const repository = mongo
    ? tidy(`${imp(["randomUUID"], "node:crypto")}
${imp(["ConflictError"], "@rheajs/core")}
${imp(["getDb"], rel("../../config/database"))}
${impType(["User", "UserRepository"], rel("./auth.types"))}

${s.ts ? "interface UserDoc {\n  _id: string;\n  email: string;\n  passwordHash: string;\n  roles: string[];\n  createdAt: Date;\n}\n" : ""}
const users = () => getDb().collection${t("<UserDoc>")}("users");

const toUser = (d${t(": UserDoc")})${t(": User")} => ({ id: d._id, email: d.email, passwordHash: d.passwordHash, roles: d.roles, createdAt: d.createdAt });

/** Creates the unique email index. Safe to run on every start. */
async function ensureUserStore()${t(": Promise<void>")} {
  await users().createIndex({ email: 1 }, { unique: true });
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
    const doc${t(": UserDoc")} = { _id: randomUUID(), email, passwordHash, roles, createdAt: new Date() };
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
};

${exp(["userRepository", "ensureUserStore"])}
`)
    : tidy(`${imp(["randomUUID"], "node:crypto")}
${imp(["ConflictError"], "@rheajs/core")}
${impType(["RowDataPacket"], "mysql2/promise")}
${imp(["getPool"], rel("../../config/database"))}
${impType(["User", "UserRepository"], rel("./auth.types"))}

${s.ts ? "interface UserRow extends RowDataPacket {\n  id: string;\n  email: string;\n  password_hash: string;\n  roles: string;\n  created_at: Date;\n}\n" : ""}
const toUser = (r${t(": UserRow")})${t(": User")} => ({
  id: r.id,
  email: r.email,
  passwordHash: r.password_hash,
  roles: r.roles ? r.roles.split(",") : [],
  createdAt: r.created_at,
});

/** Creates the users table if it does not exist. Move this to a migration tool once your schema grows. */
async function ensureUserStore()${t(": Promise<void>")} {
  await getPool().query(
    "CREATE TABLE IF NOT EXISTS users (" +
      "id CHAR(36) NOT NULL PRIMARY KEY, " +
      "email VARCHAR(254) NOT NULL, " +
      "password_hash VARCHAR(255) NOT NULL, " +
      "roles VARCHAR(255) NOT NULL, " +
      "created_at DATETIME(3) NOT NULL, " +
      "UNIQUE KEY users_email_unique (email)" +
      ") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4",
  );
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
    return { id, email, passwordHash, roles, createdAt };
  },
  async updatePasswordHash(id, passwordHash) {
    await getPool().execute("UPDATE users SET password_hash = ? WHERE id = ?", [passwordHash, id]);
  },
};

${exp(["userRepository", "ensureUserStore"])}
`);

  const service = tidy(`${imp(["ConflictError", "NotFoundError", "UnauthorizedError"], "@rheajs/core")}
${imp(["hashPassword", "needsRehash", "verifyPassword"], "@rheajs/auth")}
${impType(["Jwt", "PasswordOptions"], "@rheajs/auth")}
${impType(["User", "UserRepository"], rel("./auth.types"))}

${s.ts ? "interface Credentials {\n  email: string;\n  password: string;\n}\n\ninterface AuthDeps {\n  jwt: Jwt;\n  /** Override the password hashing cost. Tests use a low cost. Leave unset in production. */\n  password?: PasswordOptions;\n}\n" : ""}
/** The user as clients see it. The password hash never leaves the service. */
const publicUser = (u${t(": User")}) => ({ id: u.id, email: u.email, roles: u.roles, createdAt: u.createdAt });

function createAuthService(repo${t(": UserRepository")}, { jwt, password }${t(": AuthDeps")}) {
  const issue = async (u${t(": User")}) => ({ accessToken: await jwt.sign({ sub: u.id, roles: u.roles }), tokenType: "Bearer" });

  return {
    async register({ email, password: plain }${t(": Credentials")}) {
      // Cheap duplicate check first, so a repeated email does not cost a full password hash. The unique index still decides races.
      if (await repo.findByEmail(email)) throw new ConflictError("Email already registered", { code: "EMAIL_TAKEN" });
      const user = await repo.create({ email, passwordHash: await hashPassword(plain, password), roles: ["user"] });
      return { user: publicUser(user), ...(await issue(user)) };
    },

    async login({ email, password: plain }${t(": Credentials")}) {
      const user = await repo.findByEmail(email);
      // Verifies against a dummy hash when the user does not exist, so timing does not reveal registered emails.
      const ok = await verifyPassword(plain, user?.passwordHash ?? null);
      if (!user || !ok) throw new UnauthorizedError("Invalid email or password", { code: "INVALID_CREDENTIALS" });
      if (needsRehash(user.passwordHash, password)) await repo.updatePasswordHash(user.id, await hashPassword(plain, password));
      return { user: publicUser(user), ...(await issue(user)) };
    },

    async me(id${t(": string")}) {
      const user = await repo.findById(id);
      if (!user) throw new NotFoundError("User not found");
      return publicUser(user);
    },
  };
}

${exp(["createAuthService"])}
`);

  const schema = tidy(`${imp(["z"], "@rheajs/core")}

const email = z.string().trim().toLowerCase().pipe(z.email().max(254));

const registerSchema = z.object({
  email,
  // At least 12 characters. Length matters more than symbols. Hashing allows up to 128.
  password: z.string().min(12, "must be at least 12 characters").max(128),
});

const loginSchema = z.object({
  email,
  password: z.string().min(1).max(128),
});

${exp(["registerSchema", "loginSchema"])}
`);

  const routes = tidy(`${imp(["Router", "rateLimiter", "sendSuccess", "validate"], "@rheajs/core")}
${imp(["authenticate"], "@rheajs/auth")}
${impType(["Jwt"], "@rheajs/auth")}
${imp(["jwt"], rel("../../config/auth"))}
${imp(["createAuthService"], rel("./auth.service"))}
${imp(["userRepository"], rel("./auth.repository"))}
${imp(["loginSchema", "registerSchema"], rel("./auth.schema"))}

/** Builds the auth routes. Passing the service and token signer in keeps the routes testable without a database. */
function createAuthRouter(service${t(": ReturnType<typeof createAuthService>")}, tokens${t(": Jwt")}) {
  const router = Router();
  // Slow down password guessing and mass sign-ups. Counters are per process: pass a shared store to rateLimiter() when you run several instances.
  const attempts = { limit: 10, windowMs: 15 * 60_000 };

  router.post("/register", rateLimiter(attempts), validate(registerSchema), async (req, res) =>
    sendSuccess(res, await service.register(req.body), "Registered", 201),
  );
  router.post("/login", rateLimiter(attempts), validate(loginSchema), async (req, res) => sendSuccess(res, await service.login(req.body), "Logged in"));
  router.get("/me", authenticate(tokens), async (req, res) => sendSuccess(res, await service.me(req.user${bang}.id)));
  return router;
}

const authRouter = createAuthRouter(createAuthService(userRepository, { jwt }), jwt);

${exp(["authRouter", "createAuthRouter"])}
`);

  const test = tidy(`import { randomUUID } from "node:crypto";
import { createApp } from "@rheajs/core";
import { createJwt } from "@rheajs/auth";
import request from "supertest";
import { beforeAll, describe, expect, it } from "vitest";
import { createAuthRouter } from "../../src/modules/auth/auth.routes.js";
import { createAuthService } from "../../src/modules/auth/auth.service.js";
${s.ts ? 'import type { UserRepository, User } from "../../src/modules/auth/auth.types.js";\nimport type { RheaApp } from "@rheajs/core";' : ""}

// In-memory users, so these tests need no database. A low hashing cost keeps them fast: never do that in real code.
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
      const user = { id: randomUUID(), email, passwordHash, roles, createdAt: new Date() };
      users.push(user);
      return user;
    },
    async updatePasswordHash(id, passwordHash) {
      const u = users.find((x) => x.id === id);
      if (u) u.passwordHash = passwordHash;
    },
  };
}

describe("auth module", () => {
  let app${t(": RheaApp")};
  const jwt = createJwt({ secret: "t".repeat(40), issuer: "test", audience: "test-clients" });
  const pw = "a-long-test-" + "pass";
  const wrongPw = "not-the-" + "right-one";
  const good = { email: "Ada@Example.com", password: pw };

  beforeAll(async () => {
    const service = createAuthService(memoryRepository(), { jwt, password: { cost: 1024 } });
    app = createApp({ env: "test" });
    app.mount("/api/auth", createAuthRouter(service, jwt));
    await app.ready();
  });

  it("registers, normalises the email and never returns the password hash", async () => {
    const res = await request(app.express).post("/api/auth/register").send(good);
    expect(res.status).toBe(201);
    expect(res.body.data.user.email).toBe("ada@example.com");
    expect(res.body.data.user.roles).toEqual(["user"]);
    expect(res.body.data.tokenType).toBe("Bearer");
    expect(res.body.data.accessToken).toBeTruthy();
    expect(JSON.stringify(res.body)).not.toMatch(/scrypt|passwordHash/);
  });

  it("rejects a duplicate email with 409", async () => {
    const res = await request(app.express).post("/api/auth/register").send(good);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("EMAIL_TAKEN");
  });

  it("rejects short passwords and bad emails with 422", async () => {
    const a = await request(app.express).post("/api/auth/register").send({ email: "x@example.com", password: "short" });
    const b = await request(app.express).post("/api/auth/register").send({ email: "not-an-email", password: pw });
    expect(a.status).toBe(422);
    expect(b.status).toBe(422);
  });

  it("logs in and returns a token that unlocks /me", async () => {
    const login = await request(app.express).post("/api/auth/login").send({ email: "ada@example.com", password: good.password });
    expect(login.status).toBe(200);
    const me = await request(app.express).get("/api/auth/me").set("Authorization", \`Bearer \${login.body.data.accessToken}\`);
    expect(me.status).toBe(200);
    expect(me.body.data.email).toBe("ada@example.com");
  });

  it("gives the same 401 for a wrong password and an unknown email", async () => {
    const wrong = await request(app.express).post("/api/auth/login").send({ email: "ada@example.com", password: wrongPw });
    const unknown = await request(app.express).post("/api/auth/login").send({ email: "nobody@example.com", password: wrongPw });
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
`);

  return {
    [`src/config/auth.${E}`]: tidy(`${imp(["createJwt"], "@rheajs/auth")}
${imp(["env"], rel("./env"))}

/** Signs and verifies access tokens. The secret comes from JWT_SECRET (at least 32 characters). */
const jwt = createJwt({
  secret: env.JWT_SECRET,
  issuer: env.JWT_ISSUER,
  audience: env.JWT_AUDIENCE,
  expiresIn: env.JWT_EXPIRES_IN,
});

${exp(["jwt"])}
`),
    ...(s.ts ? { [`src/modules/auth/auth.types.${E}`]: types } : {}),
    [`src/modules/auth/auth.repository.${E}`]: repository,
    [`src/modules/auth/auth.service.${E}`]: service,
    [`src/modules/auth/auth.schema.${E}`]: schema,
    [`src/modules/auth/auth.routes.${E}`]: routes,
    [`tests/integration/auth.test.${T}`]: test,
  };
}

# Authentication

`@rheajs/auth` adds password hashing, JWT access tokens and route guards. It is alpha: the API can change, and it has had no independent security review.

```bash
npm install @rheajs/auth
```

It needs `@rheajs/core`, which your project already has.

## Add it to a new project

With a database chosen, `npx create-rhea my-api` asks "Add authentication?". Or pass `--db mysql --auth` (or `--db mongodb --auth`). You get:

- `POST /api/auth/register`, `POST /api/auth/login` and `GET /api/auth/me`, in `src/modules/auth/`.
- A `users` collection (MongoDB, unique email index) or table (MySQL), created on start.
- `JWT_SECRET` generated into your `.env`. `.env.example` leaves it empty, and the app refuses to start without 32 or more characters. `rhea doctor` checks it.
- Passwords of 12 to 128 characters. Emails are trimmed and lower-cased. Wrong password and unknown email give the same 401.
- Register and login limited to 10 requests per 15 minutes per IP, per process. Pass a shared store when you run several instances.
- An integration test that runs without a database.

New users get the role `user`. Nobody can register as admin: grant roles yourself in the database. Existing projects can install `@rheajs/auth` and follow the rest of this page by hand.

## What it does and does not do

Included:

- Password hashing with scrypt, in `node:crypto`, with no native add-on to compile.
- Short-lived signed access tokens (JWT, HS256) with issuer, audience and expiry checks.
- Middleware that requires a token, allows anonymous access, or requires a role.

Not included yet: refresh tokens, sessions, OAuth or OIDC, multi-factor authentication, password reset flows, account lockout, and asymmetric keys (RS256, EdDSA). Build those on top, or wait for later releases. Access tokens cannot be revoked before they expire, so keep them short.

## Hash and verify passwords

```ts verify
import { hashPassword, needsRehash, verifyPassword } from "@rheajs/auth";

export async function register(password: string): Promise<string> {
  // Store the returned string in your database as is.
  return hashPassword(password);
}

export async function checkLogin(password: string, stored: string | null): Promise<boolean> {
  // Pass null when the email is unknown. It spends the same time as a real check.
  const ok = await verifyPassword(password, stored);
  if (ok && stored && needsRehash(stored)) {
    // Save `await hashPassword(password)` over the old hash.
  }
  return ok;
}
```

Details that matter:

- The hash string holds the algorithm, cost, salt and hash, so you can raise the cost later and `needsRehash` tells you which users to upgrade at their next login.
- The default cost is scrypt N=2^17, r=8, p=1 (the OWASP minimum for scrypt) and uses about 128 MiB per hash. Size your servers for it: many logins at once use a lot of memory. Add a login rate limit.
- Each hash in progress needs about 128 MiB of memory, and Node.js runs four at a time by default (`UV_THREADPOOL_SIZE`). 24 simultaneous logins peaked at about 600 MiB of resident memory in a test. Give the container at least 1 GiB, and keep the login rate limit.
- Passwords longer than 1024 characters are refused before hashing, so one huge input cannot burn CPU.
- `verifyPassword` never throws for a wrong password or a damaged hash. It returns `false`.
- Visually identical Unicode passwords (for example `é` typed two ways) match.

## Issue and check tokens

```ts verify
import { createJwt } from "@rheajs/auth";

export const jwt = createJwt({
  secret: process.env["JWT_SECRET"]!,
  issuer: "my-api",
  audience: "my-api-clients",
  expiresIn: "15m",
});

export const issueToken = () => jwt.sign({ sub: "user-123", roles: ["admin"] });
```

- `secret` must be at least 32 bytes or `createJwt` throws. Generate one with `openssl rand -base64 48`, keep it in the environment, and never commit it. Add `JWT_SECRET: z.string().min(32)` to your environment schema so a bad deployment fails at startup.
- `issuer` and `audience` are required and checked on every token.
- Only HS256 is accepted, so a token cannot pick its own algorithm. `alg: none` and other algorithms are rejected.
- `verify` throws a 401 `UnauthorizedError` with code `TOKEN_EXPIRED` or `INVALID_TOKEN`. The message never says which part was wrong.
- A JWT is signed, not encrypted. Anyone with a token can read it. Do not put secrets or personal data in claims.
- `iss`, `aud`, `exp`, `iat`, `nbf` and `jti` in your claims are ignored, so the library controls them.

## Protect routes

```ts verify
import { Router, rateLimiter, sendSuccess } from "@rheajs/core";
import { authenticate, createJwt, requireRole } from "@rheajs/auth";

const jwt = createJwt({ secret: process.env["JWT_SECRET"]!, issuer: "my-api", audience: "my-api-clients" });

export const users = Router();

// Any signed-in user.
users.get("/me", authenticate(jwt), (req, res) => sendSuccess(res, req.user));

// Only admins or owners.
users.delete("/:id", authenticate(jwt), requireRole("admin", "owner"), (_req, res) => sendSuccess(res, { deleted: true }));

// Throttle login attempts.
users.post("/login", rateLimiter({ limit: 5, windowMs: 15 * 60_000 }), (_req, res) => sendSuccess(res, { ok: true }));
```

- `authenticate(jwt)` reads `Authorization: Bearer <token>` and sets `req.user` to `{ id, roles, claims }`. A missing token gives 401 `AUTH_REQUIRED`. Tokens are never read from the URL, so they stay out of logs.
- `optionalAuth(jwt)` lets anonymous requests through but still rejects a token that is present and invalid.
- `requireRole(...roles)` gives 403 unless the user has at least one listed role. It must run after `authenticate`.
- `roles` is only trusted if it is an array of strings. Anything else grants no roles.

Authentication answers who is calling. It does not decide what they may do with a specific record. Check ownership in your service code, for example that a user only edits their own profile.

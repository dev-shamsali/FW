# Authentication

`@rheajs/auth` adds password hashing, JWT access tokens, rotating refresh tokens, account lockout and route guards. It is alpha: the API can change, and it has had no independent security review.

```bash
npm install @rheajs/auth
```

It needs `@rheajs/core`, which your project already has.

## Add it to a new project

With a database chosen, `npx create-rhea my-api` asks "Add authentication?". Or pass `--db mysql --auth` (or `--db mongodb --auth`). You get, in `src/modules/auth/`:

| Route                       | What it does                                                           |
| --------------------------- | ---------------------------------------------------------------------- |
| `POST /api/auth/register`   | Creates a user. Returns the user, an access token and a refresh token. |
| `POST /api/auth/login`      | Checks the password. Returns an access token and a refresh token.      |
| `POST /api/auth/refresh`    | Trades a refresh token for a new access token and a new refresh token. |
| `POST /api/auth/logout`     | Ends the session the refresh token belongs to. Answers 204.            |
| `POST /api/auth/logout-all` | Needs an access token. Ends every session of the user. Answers 204.    |
| `GET /api/auth/me`          | Needs an access token. Returns the signed-in user.                     |

Also generated:

- A `users` collection (MongoDB, unique email index) or table (MySQL), and a `refresh_tokens` collection or table, created on start. A users table from an older version gets its new columns added automatically.
- `JWT_SECRET` generated into your `.env`. `.env.example` leaves it empty, and the app refuses to start without 32 or more characters. `rhea doctor` checks it.
- Passwords of 12 to 128 characters that are not on the built-in common-password list. Emails are trimmed and lower-cased. Wrong password and unknown email give the same 401.
- Register and login limited to 10 requests per 15 minutes per IP, refresh and logout to 60, per process. Pass a shared store when you run several instances.
- Every token response carries `Cache-Control: no-store`.
- An integration test that runs without a database.

New users get the role `user`. Nobody can register as admin: grant roles yourself in the database. Existing projects can install `@rheajs/auth` and follow the rest of this page by hand.

## Access and refresh tokens

Two tokens work together:

- The **access token** is a signed JWT that lives 15 minutes. Send it as `Authorization: Bearer <token>` on every API call. Because it expires quickly, a stolen one stops working soon.
- The **refresh token** is a random 43-character string that lives up to 7 days without use and 30 days in total. Keep it somewhere safe and send it only to `/api/auth/refresh` and `/api/auth/logout`. It is stored in your database only as a hash, so a database leak does not leak usable tokens.

When the access token expires, call `POST /api/auth/refresh` with `{ "refreshToken": "..." }`. You get a new access token **and a new refresh token**, and the one you sent stops working. This is called rotation.

### Reuse detection

If an old refresh token is used again after it was rotated, someone has a copy. Rhea.js then ends the whole session: every refresh token from that login is revoked and the answer is `401 REFRESH_REUSED`. The owner has to sign in again, and so does the thief.

Two requests that arrive at the same moment with the same token (a double click, a retry after a timeout) are not theft. A second use within 10 seconds of the rotation answers `401 REFRESH_CONFLICT` and the session stays alive: retry with the newest token. Of simultaneous requests, exactly one succeeds, even across several servers, because the database makes the claim atomic.

| Code               | Meaning                                                             |
| ------------------ | ------------------------------------------------------------------- |
| `REFRESH_INVALID`  | Unknown, malformed or revoked token (also after logout).            |
| `REFRESH_EXPIRED`  | Idle for 7 days, or the 30-day session limit passed. Sign in again. |
| `REFRESH_REUSED`   | An old token came back. The session was ended. Sign in again.       |
| `REFRESH_CONFLICT` | The token was used a moment ago. Retry with the newest token.       |

Change the lifetimes with `REFRESH_TOKEN_IDLE_DAYS` (default 7) and `REFRESH_TOKEN_MAX_DAYS` (default 30) in `.env`, and the access token with `JWT_EXPIRES_IN`.

### Browser apps: the cookie mode

A refresh token kept in `localStorage` can be stolen by any script that runs on your page. For browser apps set this in `.env`:

```bash
AUTH_REFRESH_COOKIE=true
CORS_ORIGIN=https://app.example.com
```

The refresh token then travels in a cookie named `rhea_refresh` that is `HttpOnly` (page scripts cannot read it), `SameSite=Strict`, `Secure` in production, and only sent to `/api/auth`. It is no longer in the JSON. Call `refresh` and `logout` with `credentials: "include"` and an empty body:

```js
await fetch("https://api.example.com/api/auth/refresh", { method: "POST", credentials: "include" });
```

Cookies are sent automatically, so a hostile site could try to trigger a refresh or logout. Two defences stop it: `SameSite=Strict`, and a check that the request's `Origin` header is on your `CORS_ORIGIN` list (otherwise `403 CSRF_ORIGIN`). In cookie mode the body token is ignored, so there is one way in. Mobile apps and scripts leave `AUTH_REFRESH_COOKIE` off and use the JSON body.

## Account lockout

Five wrong passwords in a row lock that account for 15 minutes. While locked, even the correct password gets `429 ACCOUNT_LOCKED` with a `Retry-After` header, and the refused attempts do not extend the lock. A correct password resets the count. This is on top of the per-IP limit, so it also slows an attacker who rotates addresses.

Two things to know. A lock answer shows that the account exists, but only after five failures. And someone who knows an email address can lock that account for 15 minutes by guessing wrong: that is the price of the protection, and it ends by itself.

## What it does and does not do

Included:

- Password hashing with scrypt, in `node:crypto`, with no native add-on to compile.
- Short-lived signed access tokens (JWT, HS256) with issuer, audience and expiry checks.
- Rotating refresh tokens with reuse detection, logout and logout-all, storage-agnostic through a small `RefreshTokenStore` interface.
- httpOnly cookie and CSRF origin helpers for browser apps.
- Pure account-lockout rules and a common-password blocklist.
- Middleware that requires a token, allows anonymous access, or requires a role.

Not included yet: server-side sessions, OAuth or OIDC, multi-factor authentication, password reset and change-password flows, and asymmetric keys (RS256, EdDSA). Build those on top, or wait for later releases. An access token cannot be revoked before it expires (15 minutes by default), but logout and logout-all stop it from being renewed.

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

## Refresh tokens without the generated project

`createRefreshTokens` holds the rules. You give it a store (your database), it does rotation, expiry and reuse detection.

```ts verify
import { createMemoryRefreshStore, createRefreshTokens, type RefreshTokenStore } from "@rheajs/auth";

// In production pass your own store (MongoDB, MySQL, Redis ...). The memory store is for tests.
const store: RefreshTokenStore = createMemoryRefreshStore();

export const refresh = createRefreshTokens({
  store,
  idleSec: 7 * 86_400, // unused for 7 days: expired
  maxSec: 30 * 86_400, // a login session ends after 30 days at most
  graceSec: 10, // a second use within 10 s of rotation is a retry, not theft
});

export async function onLogin(userId: string): Promise<string> {
  const issued = await refresh.issue(userId);
  return issued.token; // give it to the client once; only its hash is stored
}

export async function onRefresh(token: string): Promise<{ userId: string; token: string }> {
  // Throws UnauthorizedError: REFRESH_INVALID, REFRESH_EXPIRED, REFRESH_REUSED or REFRESH_CONFLICT.
  const next = await refresh.rotate(token);
  return { userId: next.userId, token: next.token };
}

export const onLogout = (token: string) => refresh.revoke(token);
export const onLogoutEverywhere = (userId: string) => refresh.revokeAll(userId);
```

A store has five methods: `create`, `findByHash`, `markUsed` (must be atomic: only the first caller gets `true`), `revokeFamily` and `revokeUser`. The generated MongoDB and MySQL stores in `auth.refresh-store` are working examples.

Cookie and lockout helpers:

```ts verify
import { Router, sendSuccess } from "@rheajs/core";
import { assertAllowedOrigin, clearRefreshCookie, createLockout, noStore, readCookie, setRefreshCookie } from "@rheajs/auth";

const lockout = createLockout({ maxFailures: 5, lockSec: 900 });

export const demo = Router();
demo.use(noStore); // never let a browser or proxy keep a token response

demo.post("/cookie-in", (_req, res) => {
  setRefreshCookie(res, "a-refresh-token", { secure: true, maxAgeSec: 7 * 86_400 });
  sendSuccess(res, { ok: true });
});

demo.post("/cookie-use", (req, res) => {
  assertAllowedOrigin(req, ["https://app.example.com"]); // CSRF check: throws 403 CSRF_ORIGIN
  const token = readCookie(req);
  clearRefreshCookie(res, { secure: true });
  sendSuccess(res, { hadToken: token !== undefined });
});

export function afterWrongPassword(user: { failedLogins: number; lockedUntil: Date | null }) {
  if (lockout.status(user).locked) return user; // locked: do not count, do not extend
  return lockout.afterFailure(user); // save this on the user; locks on the 5th failure
}
```

`isCommonPassword(password)` is the blocklist the generated register route uses. It is a small built-in list, not a breach database.

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

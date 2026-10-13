# Refresh tokens, morgan and security essentials (0.1.0-alpha.3)

Status: approved by the owner on 2026-10-13 ("do the changes"). Decisions come from the owner's answers: refresh token delivery is **both** (body by default, cookie by env switch), morgan runs **in development with pino JSON in production**, and the security set is lockout plus the extras listed below.

## Goal

Generated Rhea.js APIs get a complete token flow (short-lived access JWT plus a rotating, revocable refresh token), a morgan access log for development, and a stronger default security posture. Release as `0.1.0-alpha.3`; the owner publishes.

## Tokens

- **Access token:** existing HS256 JWT, 15 minutes.
- **Refresh token:** 32 random bytes (base64url), opaque, never a JWT. Stored only as a SHA-256 hash. Idle lifetime 7 days, absolute lifetime per login session (family) 30 days.
- **Rotation:** each refresh marks the presented token used and issues a new one in the same family, expiring at `min(now + idle, familyExpiresAt)`.
- **Reuse detection:** presenting a used token revokes the whole family and answers 401 `REFRESH_REUSED`. A 10 second grace window after rotation answers 401 `REFRESH_CONFLICT` without revoking, so two parallel requests do not log the user out.
- The claim "used" is an atomic compare-and-set in the store, so two simultaneous requests cannot both succeed.
- Error codes (all 401): `REFRESH_INVALID`, `REFRESH_EXPIRED`, `REFRESH_REUSED`, `REFRESH_CONFLICT`.
- Every response that carries or clears tokens sends `Cache-Control: no-store`.

## Endpoints (generated projects)

- `POST /api/auth/register`, `POST /api/auth/login`: return `accessToken`, `refreshToken` (body mode), user.
- `POST /api/auth/refresh`: rotate. Token from body `{ refreshToken }`, or from the cookie in cookie mode.
- `POST /api/auth/logout`: revoke the token's family. 204.
- `POST /api/auth/logout-all` (needs access token): revoke every refresh token of the user. 204.
- `GET /api/auth/me`: unchanged.

## Cookie mode (`AUTH_REFRESH_COOKIE=true`)

- Cookie `rhea_refresh`: `HttpOnly`, `SameSite=Strict`, `Secure` in production, `Path=/api/auth`, `Max-Age` equals the idle lifetime. The body omits `refreshToken`.
- CSRF guard on refresh and logout when the token comes from the cookie: `Origin` must be present and listed in `CORS_ORIGIN`, otherwise 403 `CSRF_ORIGIN`. The body must be JSON.
- No `cookie-parser` dependency: the cookie header is parsed by a small strict function.

## Account lockout

- 5 consecutive wrong passwords lock the account for 15 minutes. Locked login answers 429 `ACCOUNT_LOCKED` with `Retry-After`. A success resets the counter. Per-IP route limits stay.
- Stored as `failedLogins` and `lockedUntil` on the user. The pure policy lives in `@rheajs/auth` (`createLockout`); persistence is generated.
- Trade-off, documented: a 429 `ACCOUNT_LOCKED` reveals that the account exists, but only after 5 failures.

## Morgan (`@rheajs/core`)

- New dependency `morgan`. New option `accessLog`: `"dev"` (default when `env` is `development`), `"combined"`, `"common"`, `"tiny"`, or `false`. Default is off in production and test, where pino's JSON request line is the log.
- When morgan is on, pino's per-request line is skipped to avoid duplicates.
- Formats are built on a `:path` token (no query string) so tokens in URLs never reach the log. Headers and bodies are never logged.

## Security extras (core)

- `requireJson` (default true): `POST`, `PUT`, `PATCH`, `DELETE` with a body and a content type other than `application/json` (or `+json`) get 415 `UNSUPPORTED_MEDIA_TYPE`. Opt out with `requireJson: false`.
- `Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()` on every response.
- `rejectOperatorKeys` (default false): bodies with keys starting with `$` get 400 `INVALID_BODY`. Generated MongoDB projects switch it on.
- Proxy warning: in production, a request carrying `X-Forwarded-For` while `trustProxy` is off logs one warning, because every client then shares one rate-limit bucket.
- `@rheajs/auth` ships a common-password blocklist (`isCommonPassword`); generated register rejects those passwords.

## Where the code lives

- `@rheajs/core`: morgan, `requireJson`, Permissions-Policy, `rejectOperatorKeys`, proxy warning.
- `@rheajs/auth`: `createRefreshTokens` with a `RefreshTokenStore` interface, cookie and origin helpers, `createLockout`, `isCommonPassword`.
- `@rheajs/cli` generator: MongoDB and MySQL refresh stores (`refresh_tokens`: unique hash index, `familyId` index, expiry cleanup), lockout columns, service and routes, env variables, tests.
- Existing `--auth` projects keep working; new behaviour appears when regenerated or when the packages are upgraded.

## Environment (generated)

`JWT_EXPIRES_IN` (15m), `REFRESH_TOKEN_IDLE_DAYS` (7), `REFRESH_TOKEN_MAX_DAYS` (30), `AUTH_REFRESH_COOKIE` (false).

## Testing

Unit tests: rotation, reuse, grace window, expiry, atomic claim race, cookie parsing, origin guard, lockout, blocklist, morgan formats (no query string), `requireJson`, operator keys, proxy warning. Real MongoDB 7 and MySQL 8.4 end-to-end for both token modes. Existing tests updated where behaviour changed (415).

## Out of scope

Change-password, email flows, OAuth/OIDC, MFA, asymmetric JWT keys, an admin session list.

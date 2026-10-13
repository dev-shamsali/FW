# Changelog

All notable changes are documented here. Format: [Keep a Changelog](https://keepachangelog.com). Versioning: [SemVer](https://semver.org).

## [Unreleased]

## [0.1.0-alpha.3]

### Added

- **Refresh tokens** in `@rheajs/auth`: `createRefreshTokens` (random opaque tokens stored as SHA-256 hashes, rotation on every use, reuse detection that revokes the whole session, a 10 second grace window for parallel requests, 7 day idle and 30 day absolute lifetimes), `createMemoryRefreshStore` for tests, and a small `RefreshTokenStore` interface.
- **Cookie mode** for browser apps: `setRefreshCookie`, `clearRefreshCookie`, `readCookie` (httpOnly, SameSite=Strict, Secure in production) and a CSRF origin check, `assertAllowedOrigin` / `requireAllowedOrigin`. `noStore` keeps token responses out of caches.
- **Account lockout** in `@rheajs/auth` (`createLockout`: 5 failures, 15 minutes) and a **common-password blocklist** (`isCommonPassword`).
- **Generated `--auth` projects** now include `POST /api/auth/refresh`, `/logout` and `/logout-all`, a `refresh_tokens` collection or table, lockout columns (a users table from alpha.2 is upgraded on start), `AUTH_REFRESH_COOKIE`, `REFRESH_TOKEN_IDLE_DAYS` and `REFRESH_TOKEN_MAX_DAYS`, and tests that need no database.
- **Morgan access log** in `@rheajs/core` (`accessLog`): short colored lines in development, off in production where the pino JSON line stays. Query strings, cookies and most headers are never printed.
- `rejectOperatorKeys` option (switched on in generated MongoDB projects), a `Permissions-Policy` header on every response, and a one-time warning when `X-Forwarded-For` arrives while `trustProxy` is off.

### Changed

- **Breaking:** a `POST`, `PUT`, `PATCH` or `DELETE` with a body that is not JSON now gets `415 UNSUPPORTED_MEDIA_TYPE` (`requireJson`, on by default). Set `requireJson: false` for forms or uploads.
- Generated register rejects common passwords (422). Generated login answers `429 ACCOUNT_LOCKED` with `Retry-After` after 5 failures. Login and register responses include `refreshToken` (or set it as a cookie in cookie mode).

### Verified

- Real MongoDB 7 and MySQL 8.4: 74 end-to-end checks over HTTP, including exactly one winner among 10 parallel refreshes with the same token, reuse detection ending the session, logout-all, lockout, operator-key rejection and cookie mode with CSRF checks. An alpha.2 users table and users collection keep working.

## [0.1.0-alpha.2]

### Security

- The prototype-pollution guard no longer lets a forbidden key hide below depth 32: bodies nested deeper than 32 levels are rejected.
- Log redaction now reaches nested values (levels 1 to 4) and covers `jwt`, `idToken`, `clientSecret` and `privateKey`.
- `rhea generate` refuses Windows device names such as `con`.
- Added [SECURITY_AUDIT.md](SECURITY_AUDIT.md): what was probed, found, fixed and left open.

### Added

- `redisRateLimitStore` is tested against a real Redis 7 (shared limit across instances, TTL expiry, concurrency, Redis down). `BENCHMARKS.md`, `npm run bench` and `npm run soak` add a load test and a 180 s soak test with the exact method and caveats.
- `create` offers authentication when a database is chosen (`--auth`, `--no-auth`): users in MongoDB or MySQL, `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/auth/me`, a generated `JWT_SECRET`, and a database-free test. `rhea doctor` checks the secret.
- New package `@rheajs/auth`: scrypt password hashing (`hashPassword`, `verifyPassword`, `needsRehash`), HS256 JWT access tokens (`createJwt`), and route guards (`authenticate`, `optionalAuth`, `requireRole`).
- `rateLimit` accepts `store`, `keyGenerator` and `skip`. `rateLimiter()` protects a single route. `redisRateLimitStore()` shares counters across instances.
- `handleProcessErrors` (default on): an uncaught exception or unhandled rejection logs, shuts down gracefully and exits with code 1.
- `server` option for keep-alive, headers and request timeouts, with defaults suited to load balancers.

## [0.1.0-alpha.1]

### Added

- `create` asks for language (TypeScript or JavaScript), module system (ES Modules or CommonJS), database (None, MongoDB, MySQL) and whether to install. Flags: `--ts --js --esm --cjs --db --install --no-install --yes`.
- MongoDB (`mongodb` driver) and MySQL (`mysql2` pool) setup: connect before listening, close on shutdown, `GET /health/ready`, validated `DATABASE_URL`.
- A working first API: `GET /` and `GET /api/rhea` ("developed by Shams Ali Shaikh") and a startup banner.
- `npm run dev` uses nodemon (graceful restart); `npm start` uses plain node; `npm test` uses Vitest. JavaScript projects have no build step.
- `rhea.config.json`: generators, `docker`, `build`, `start` and `doctor` follow the project's flavour. `rhea docker` adds a database service to compose.
- Generated CI workflow and `.gitattributes`.

### Changed

- `@rheajs/core` can be loaded with `require()` (Node.js 20.19+ / 22.12+), which CommonJS projects need.
- `rhea generate` for JavaScript has no types file.
- `create` checks that `npm install` produced `node_modules` before declaring success.

### Fixed

- Generators write all files or none, refuse reserved words, and no longer duplicate module registrations.

## [0.1.0-alpha.0]

First alpha, published to npm on 2026-10-09 (`@rheajs/core`, `@rheajs/cli`, `create-rhea`) with signed provenance.

### Added

- `@rheajs/core`: `createApp`, request IDs, structured logging with redaction, Helmet, CORS (deny by default), rate limiting, body limit, request timeout, prototype-pollution guard, error classes and standard response shape, Zod validation and environment parsing, lifecycle hooks, graceful shutdown, plugin API.
- `@rheajs/cli`: `create`, `dev`, `build`, `start`, `generate` (module, controller, service, route, middleware, validator), `test`, `doctor`, `security`, `docker`, `info`.
- `create-rhea`: `npx create-rhea` scaffolder.
- Documentation site (24 pages) and website with privacy policy.

### Known limitations

- Rate limiting uses a per-process memory store.
- No authentication or database adapters.
- Tested on Linux with Node.js 20, 22 and 26. macOS and Windows are covered only by the CI matrix once the repository is public.

[Unreleased]: #
[0.1.0-alpha.1]: #
[0.1.0-alpha.0]: #

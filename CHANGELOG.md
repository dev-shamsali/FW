# Changelog

All notable changes are documented here. Format: [Keep a Changelog](https://keepachangelog.com). Versioning: [SemVer](https://semver.org).

## [Unreleased]

### Added

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

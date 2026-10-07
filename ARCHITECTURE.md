# Rhea.js Architecture (Phase 0 draft)

Status: draft. Nothing here is published, reserved, or released.

## Principle

Express is the HTTP engine. Rhea.js is the application architecture and developer experience on top of it.

## Decision: monorepo, few packages

npm workspaces monorepo. Start with three packages only. Split later when a boundary proves real.

| Package | Purpose | Why separate |
|---|---|---|
| `packages/core` | App factory, config, errors, responses, validation, logger, request ID, security middleware, lifecycle, plugin API | Runtime dependency of generated apps |
| `packages/cli` | `rhea` binary, generators, doctor, security scan | Dev-time tool; must not ship in production dependency tree |
| `packages/create-rhea` | `npx create-rhea` thin wrapper over CLI scaffolder | npm `create-*` convention |

Deferred (not created yet): `config`, `security`, `testing`, `auth`, DB adapters. Security and config live inside `core` for v0.x. They become packages only when a consumer needs them alone.

Templates live in `packages/cli/templates/`, not a top-level package, so they ship with the CLI.

## Generated app layout: feature modules

`src/modules/<name>/{controller,service,routes,schema,repository,types}`. Reason: code that changes together lives together; modules map to future plugin/package boundaries.

## Core design

- `createApp(options)` returns `{ express, use(plugin), start(), stop() }`.
- Middleware order is fixed and documented: request ID, logger, security headers, CORS, rate limit, body limit, timeout, routes, 404, error handler.
- Express 5 catches rejected async handlers natively. No wrapper library.
- Errors: `AppError` base (status, code, expose flag); subclasses per spec. Non-`AppError` becomes `INTERNAL_ERROR` with sanitized message in production.
- Responses: `{ success, data, message }` and `{ success: false, error: { code, message } }`, via an overridable formatter.
- Env: Zod schema, fail-fast with the specified message. Production never continues on invalid config.
- Logger: small own wrapper over `pino` (JSON in prod, `pino-pretty` only in dev, optional). Redaction list for passwords, tokens, authorization headers, cookies.
- Lifecycle hooks: `beforeInit, init, afterInit, beforeStart, afterStart, beforeShutdown, afterShutdown`. SIGTERM/SIGINT close server, then run shutdown hooks with a timeout.
- Plugin API: `plugin = { name, setup(ctx) }`. `ctx` exposes a narrow surface (`addMiddleware`, `addRoutes`, `onHook`, `config`, `logger`), not raw internals.
- DB: adapter interface `{ name, connect(), disconnect(), health() }`. Core has zero DB dependency.
- Auth: out of core. Future plugin.

## Dependency policy

Each runtime dependency needs a documented reason.

| Dependency | Reason |
|---|---|
| express@5 | HTTP foundation |
| zod | Env and request validation |
| helmet | Security headers |
| cors | CORS |
| express-rate-limit | Rate limiting |
| pino | Structured logging with redaction |
| commander (cli) | Argument parsing |

Versions verified on 2026-10-07 via `npm view`: express 5.2.1, zod 4.6.5, helmet 8.3.0, cors 2.8.6, express-rate-limit 8.7.1, pino 10.4.0, commander 15.0.0, vitest 5.0.3, supertest 7.3.1, typescript 7.0.2. Re-check compatibility before pinning (TypeScript 7 toolchain support in ESLint/Vitest unverified).

## Naming status

Checked read-only on npm 2026-10-07: `rhea` is TAKEN (existing AMQP library, v3.0.5), so the unscoped package name is unavailable and the name may confuse searches. `rheajs`, `rhea.js`, `create-rhea`, `@rheajs/core`, `@rheajs/cli` returned 404 (unclaimed, not reserved). Plan: publish `rheajs` + `@rheajs/*`; CLI binary named `rhea`. `@rheajs` npm scope, GitHub org, domain, trademark: not checked. Owner approval needed before any claim.

## Non-goals for 0.1.0-alpha

Auth, DB adapters, plugin marketplace, website, Docker generator may land after core+CLI work. Not production-ready.

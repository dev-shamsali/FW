# Introduction

Rhea.js is a convention-driven backend framework for Node.js, built on Express 5. Express stays the HTTP engine. Rhea.js adds the application architecture around it: project layout, security defaults, validation, error handling, logging, a CLI and a plugin API.

Made by Shams Ali Shaikh. MIT licensed.

> **Status: stable (1.0).** Semantic versioning applies from 1.0.0. Rhea.js is used in production by its author. It has not had an independent security review, so read [Known limitations](#known-limitations) and the [self-audit](https://github.com/dev-shamsali/Rhea.js-framework/blob/main/SECURITY_AUDIT.md) before you rely on it for something sensitive.

## What you get

- A project generator that asks for TypeScript or JavaScript, ES Modules or CommonJS, and MongoDB, MySQL or no database, and a `rhea` CLI (`create`, `dev`, `build`, `start`, `generate`, `test`, `doctor`, `security`, `docker`, `info`).
- A working first API (`GET /api/rhea`) and a `dev` script with nodemon, so a new project runs and reloads on the first command.
- Secure defaults: Helmet headers, CORS denied unless configured, rate limiting, body size limit, request timeout, prototype-pollution guard.
- One error model and one response shape across the app.
- Zod-based validation for body, query and params, and Zod-based environment validation that stops startup on bad config.
- Structured JSON logging with secret redaction, request IDs, and graceful shutdown.
- Lifecycle hooks and a narrow plugin API.
- Optional authentication: password hashing, JWT access tokens, rotating refresh tokens, account lockout and route guards in `@rheajs/auth`, with register, login, refresh and logout routes generated when you choose a database. See [Authentication](authentication.html).

## What it does not do (yet)

- No server-side sessions, OAuth/OIDC, multi-factor authentication or password reset yet. `@rheajs/auth` covers passwords, access and refresh tokens, lockout and role checks. See [Authentication](authentication.html).
- No ORM or query layer. MongoDB and MySQL connections (pooling, readiness, clean shutdown) are generated for you, but you write your own queries. See [Databases](databases.html).
- No performance claims beyond the measured, caveated numbers in [BENCHMARKS.md](https://github.com/dev-shamsali/Rhea.js-framework/blob/main/BENCHMARKS.md). Rhea.js is slower than bare Express on a trivial route because of the checks it runs on every request.

## Known limitations

- Rate limiting counts in process memory by default, so limits are per process. For several instances pass a shared store such as `redisRateLimitStore` (see [Security](security.html)).
- Verified on Linux with Node.js 20, 22 and 26 (npm 10 and 12). macOS and Windows are covered by the CI matrix but were not verified when this was written.
- `validate()` is synchronous: Zod schemas with async refinements are not supported.

## Stability and versioning

From 1.0.0 Rhea.js follows [semantic versioning](https://semver.org): a **major** version (2.0.0) may break things, a **minor** (1.1.0) adds features without breaking, a **patch** (1.0.1) fixes bugs and security problems.

**Covered by that promise** (the public API):

- Everything exported from `@rheajs/core` and `@rheajs/auth` and described in these docs, including the plugin API.
- The `rhea` and `create-rhea` commands and their flags.
- The JSON shape of successes and errors, and the error codes (`VALIDATION_ERROR`, `REFRESH_REUSED` and so on).
- The environment variable names that the framework and generated projects read.

**Not covered:**

- The files `create-rhea` writes. They become your code. Later versions may generate different files, and your existing project is never rewritten.
- Anything not exported, the layout inside the packages, log message wording, and development-only output such as the banner and the morgan line.
- Behaviour that was unsafe. A security fix may tighten behaviour in a minor or patch release (the 415 for non-JSON bodies was such a change). Every such change is listed in the changelog and the [migration guides](migration-guides.html).

Support: only the latest 1.x receives fixes. Dropping support for a Node.js version counts as a breaking change. This is a one-maintainer project, and 1.0 does not mean an outside party has reviewed it.

## How the docs are verified

Code blocks marked `ts verify` are type-checked against the real `@rheajs/core` build by the repository test suite. Command names in `bash` blocks are checked against the CLI. Other snippets are illustrative.

# Introduction

Rhea.js is a convention-driven backend framework for Node.js, built on Express 5. Express stays the HTTP engine. Rhea.js adds the application architecture around it: project layout, security defaults, validation, error handling, logging, a CLI and a plugin API.

Made by Shams Ali Shaikh. MIT licensed.

> **Status: alpha (0.1.0-alpha.2).** The API can change between alpha releases. It has had no independent security review, so do not treat it as production-ready yet. See [Known limitations](#known-limitations) and the [self-audit](https://github.com/dev-shamsali/FW/blob/main/SECURITY_AUDIT.md).

## What you get

- A project generator that asks for TypeScript or JavaScript, ES Modules or CommonJS, and MongoDB, MySQL or no database, and a `rhea` CLI (`create`, `dev`, `build`, `start`, `generate`, `test`, `doctor`, `security`, `docker`, `info`).
- A working first API (`GET /api/rhea`) and a `dev` script with nodemon, so a new project runs and reloads on the first command.
- Secure defaults: Helmet headers, CORS denied unless configured, rate limiting, body size limit, request timeout, prototype-pollution guard.
- One error model and one response shape across the app.
- Zod-based validation for body, query and params, and Zod-based environment validation that stops startup on bad config.
- Structured JSON logging with secret redaction, request IDs, and graceful shutdown.
- Lifecycle hooks and a narrow plugin API.
- Optional authentication: password hashing, JWT access tokens and route guards in `@rheajs/auth`, with register and login routes generated when you choose a database. See [Authentication](authentication.html).

## What it does not do (yet)

- No sessions, refresh tokens, OAuth/OIDC, multi-factor authentication or password reset yet. `@rheajs/auth` covers passwords, access tokens and role checks. See [Authentication](authentication.html).
- No ORM or query layer. MongoDB and MySQL connections (pooling, readiness, clean shutdown) are generated for you, but you write your own queries. See [Databases](databases.html).
- No performance claims beyond the measured, caveated numbers in [BENCHMARKS.md](https://github.com/dev-shamsali/FW/blob/main/BENCHMARKS.md). Rhea.js is slower than bare Express on a trivial route because of the checks it runs on every request.

## Known limitations

- Rate limiting counts in process memory by default, so limits are per process. For several instances pass a shared store such as `redisRateLimitStore` (see [Security](security.html)).
- Verified on Linux with Node.js 20, 22 and 26 (npm 10 and 12). macOS and Windows are covered by the CI matrix but were not verified when this was written.
- `validate()` is synchronous: Zod schemas with async refinements are not supported.

## How the docs are verified

Code blocks marked `ts verify` are type-checked against the real `@rheajs/core` build by the repository test suite. Command names in `bash` blocks are checked against the CLI. Other snippets are illustrative.

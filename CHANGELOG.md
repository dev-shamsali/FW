# Changelog

All notable changes are documented here. Format: [Keep a Changelog](https://keepachangelog.com). Versioning: [SemVer](https://semver.org).

## [Unreleased]

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
[0.1.0-alpha.0]: #

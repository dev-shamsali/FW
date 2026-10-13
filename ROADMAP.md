# Rhea.js Roadmap

Draft. Dates intentionally absent. No stage is complete unless verified.

| Stage | Goal                        | Exit criteria                                                                                                                                                       |
| ----- | --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0     | Research, architecture docs | ARCHITECTURE, COMPETITIVE_ANALYSIS, ROADMAP reviewed by owner                                                                                                       |
| 1     | Core                        | `createApp`, env, errors, validate, logger, request ID, security, lifecycle with passing tests                                                                      |
| 2     | CLI                         | create, dev, build, start, generate, test, doctor, security, info working                                                                                           |
| 3     | Template                    | Clean-directory acceptance test passes                                                                                                                              |
| 4     | Test suite                  | CLI, generators, core, built output covered; CI on Linux/macOS/Windows                                                                                              |
| 5     | Docs                        | Docs site content, examples verified                                                                                                                                |
| 6     | Website                     | Done: static Next.js site with live pipeline demo built from real captured output; no fabricated metrics; GitHub/npm shown as "not yet" until they exist            |
| 7     | npm prep                    | `npm pack --dry-run` inspected; owner approves publish                                                                                                              |
| 8     | GitHub prep                 | Community files, workflows; owner approves push                                                                                                                     |
| 9     | 0.1.0-alpha                 | Done: alpha.0, alpha.1 and alpha.2 were published to npm (owner-run releases)                                                                                       |
| 10    | Hardening                   | Done: `@rheajs/auth` with refresh tokens and lockout, shared rate-limit store tested on Redis, self-audit, load and soak tests                                      |
| 11    | 1.0.0                       | Done (2026-10-13): released as stable on the owner's decision, with the public API written down in docs/introduction.md. Still open: an independent security review |

Versions: the alpha line (0.1.0-alpha.0 to .2) led to 1.0.0. The original plan gated 1.0 on an independent security review; the owner released 1.0.0 without one because the project already runs in production. That review is still open and is the first item of the next stage. From 1.0.0, semantic versioning applies (see "Stability and versioning" in docs/introduction.md).

Likely next features: password reset and change-password, server-side sessions, Postgres adapter, SQLite adapter, OpenAPI generation, Docker generator, queue plugin, caching plugin, observability plugin, OIDC, plugin registry docs.

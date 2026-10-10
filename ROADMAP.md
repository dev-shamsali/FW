# Rhea.js Roadmap

Draft. Dates intentionally absent. No stage is complete unless verified.

| Stage | Goal                        | Exit criteria                                                                                                                                            |
| ----- | --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0     | Research, architecture docs | ARCHITECTURE, COMPETITIVE_ANALYSIS, ROADMAP reviewed by owner                                                                                            |
| 1     | Core                        | `createApp`, env, errors, validate, logger, request ID, security, lifecycle with passing tests                                                           |
| 2     | CLI                         | create, dev, build, start, generate, test, doctor, security, info working                                                                                |
| 3     | Template                    | Clean-directory acceptance test passes                                                                                                                   |
| 4     | Test suite                  | CLI, generators, core, built output covered; CI on Linux/macOS/Windows                                                                                   |
| 5     | Docs                        | Docs site content, examples verified                                                                                                                     |
| 6     | Website                     | Done: static Next.js site with live pipeline demo built from real captured output; no fabricated metrics; GitHub/npm shown as "not yet" until they exist |
| 7     | npm prep                    | `npm pack --dry-run` inspected; owner approves publish                                                                                                   |
| 8     | GitHub prep                 | Community files, workflows; owner approves push                                                                                                          |
| 9     | 0.1.0-alpha                 | Done: alpha.0, alpha.1 and alpha.2 are published to npm (owner-run releases)                                                                             |
| 10    | Hardening                   | Done: `@rheajs/auth`, shared rate-limit store tested on Redis, self-audit, load and soak tests. Open: independent security review, real-world use        |

Versions: 0.1.0-alpha, then 0.2.x, 0.3.x, 0.5.x, 1.0.0. 1.0 requires stable API, mature docs, comprehensive tests, migration strategy, security review, stable generated projects.

Likely next features: refresh tokens and sessions, Postgres adapter, SQLite adapter, OpenAPI generation, Docker generator, queue plugin, caching plugin, observability plugin, OIDC, plugin registry docs.

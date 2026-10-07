# Rhea.js Roadmap

Draft. Dates intentionally absent. No stage is complete unless verified.

| Stage | Goal | Exit criteria |
|---|---|---|
| 0 | Research, architecture docs | ARCHITECTURE, COMPETITIVE_ANALYSIS, ROADMAP reviewed by owner |
| 1 | Core | `createApp`, env, errors, validate, logger, request ID, security, lifecycle with passing tests |
| 2 | CLI | create, dev, build, start, generate, test, doctor, security, info working |
| 3 | Template | Clean-directory acceptance test passes |
| 4 | Test suite | CLI, generators, core, built output covered; CI on Linux/macOS/Windows |
| 5 | Docs | Docs site content, examples verified |
| 6 | Website | Homepage, no fabricated metrics |
| 7 | npm prep | `npm pack --dry-run` inspected; owner approves publish |
| 8 | GitHub prep | Community files, workflows; owner approves push |
| 9 | 0.1.0-alpha | Owner-run release |

Versions: 0.1.0-alpha, then 0.2.x, 0.3.x, 0.5.x, 1.0.0. 1.0 requires stable API, mature docs, comprehensive tests, migration strategy, security review, stable generated projects.

Likely next features after alpha: auth plugin, Postgres adapter, SQLite adapter, OpenAPI generation, Docker generator, queue plugin, caching plugin, observability plugin, OIDC, plugin registry docs.

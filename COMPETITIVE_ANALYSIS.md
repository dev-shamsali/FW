# Competitive Analysis (Phase 0 draft)

Status: from general knowledge only. Not yet verified against current docs. Verify each row before publishing any comparison.

| Framework | Positioning | Rhea.js angle |
|---|---|---|
| Express | Minimal HTTP layer, no structure | Rhea.js builds on it; keeps middleware compatibility |
| NestJS | Full DI/decorator architecture, large | Lighter, no decorators, convention over DI |
| Fastify | Fast core, plugin model, schema validation | Rhea.js stays on Express ecosystem |
| Hono | Tiny, multi-runtime, web standards | Rhea.js targets Node only |
| AdonisJS | Batteries-included, Laravel-like | Rhea.js is smaller, security-default focused |

Claim to earn, not assume: "secure by default plus predictable layout on Express". No performance claims without benchmarks run and documented.

TODO: verify feature matrices against each project's current docs (use Context7 or official sites) and record versions and date.

# Security self-audit, 2026-10-10

This is a self-audit by the project's own team and tooling. It is **not** an independent review and does not replace one. It lists what was probed, what was found and fixed, what remains open, and what an outside reviewer should look at first.

Scope: `@rheajs/core`, `@rheajs/auth`, the `rhea` CLI and the generated project template, at the commit that contains this file.

## Findings

| #   | Finding                                                                                                                                                                                        | Severity | Status                                                                       |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ---------------------------------------------------------------------------- |
| 1   | The prototype-pollution guard stopped inspecting at depth 32 and returned "clean". A body with `__proto__` below level 32 was accepted (HTTP 200).                                             | Medium   | **Fixed.** Bodies nested deeper than 32 levels are now rejected with 400.    |
| 2   | Log redaction used one-level wildcards (`*.password`), so a secret nested two or more levels down was logged in clear text. `jwt`, `idToken`, `clientSecret` and `privateKey` were not listed. | Medium   | **Fixed.** Sensitive keys are redacted at nesting levels 1 to 4. Keys added. |
| 3   | `rhea generate module con` created a folder named after a Windows device name that Windows cannot create.                                                                                      | Low      | **Fixed.** Windows device names are refused.                                 |
| 4   | A flaky shutdown test (fixed 30 ms wait) failed under CPU load.                                                                                                                                | Test     | **Fixed.** It now waits for the handler to start.                            |
| 5   | `npm audit` on generated projects and on this repository reports advisories in `vitest` and `@vitest/mocker` (dev dependencies only).                                                          | Low      | **Open, accepted, documented.** See below.                                   |
| 6   | `autocannon` (benchmark tool, dev only) pulled a vulnerable `uuid`.                                                                                                                            | Low      | **Fixed** with an `overrides` entry (`uuid` 11.1.1).                         |

### About finding 5

- Production dependencies: `npm audit --omit=dev` reports **0 vulnerabilities** in this repository and in generated projects.
- The remaining advisories affect Vitest only when its UI server is running (GHSA-5xrq-8626-4rwp) or when a test uses a redirecting mock from untrusted input (GHSA-82fw-gwwq-j7x9). Generated projects use neither.
- The fix is Vitest 4.1.11. It cannot be used yet: it crashes npm 10 (`Cannot read properties of null (reading 'edgesOut')`), and npm 10 is what Node.js 20 ships. Re-tested on 2026-10-10. Vitest 5 needs Node.js 22.12 or newer. The pin stays at `~4.0.18` until npm 10 works with a fixed release, or Node.js 20 support is dropped.

## Probed and held

| Area                | Probe                                                                                                                    | Result                                                              |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------- |
| Prototype pollution | `__proto__` and `constructor.prototype` at top level and inside arrays                                                   | 400                                                                 |
| Query pollution     | `?__proto__[admin]=1&a[b]=2`                                                                                             | Express 5 simple parser: keys stay flat strings, no nesting         |
| Error leakage       | Foreign error with `status: 400` and a secret in the message; plain `Error` with a secret                                | Generic message in production, no secret                            |
| Content types       | `urlencoded`, `text/plain` bodies                                                                                        | Not parsed, empty body                                              |
| Request ID          | CRLF in `X-Request-ID`; `<script>` in `X-Request-ID`                                                                     | Client refuses CRLF; unsafe values are replaced by a generated UUID |
| Oversized input     | 5,000 query parameters; 20 kB URL                                                                                        | 431                                                                 |
| Methods             | `TRACE`, `OPTIONS`                                                                                                       | 404; `OPTIONS` answers with `Allow`                                 |
| Headers             | HSTS, nosniff, CSP, frame, referrer, COOP present; `X-Powered-By` and `ETag` absent                                      | As intended                                                         |
| Request log         | Query string, `Authorization`, `Cookie`                                                                                  | Not logged (path only)                                              |
| JWT                 | `alg: none`, HS512, wrong issuer, wrong audience, tampered payload and signature, other secret                           | All 401 `INVALID_TOKEN`                                             |
| Roles               | `roles` claim as a string instead of an array                                                                            | Grants nothing                                                      |
| Tokens in URLs      | `?token=...`, `Basic`, lower-case `bearer`                                                                               | Ignored                                                             |
| Passwords           | Malformed, truncated and tampered hashes (cost 2^30), oversized input, Unicode forms                                     | `false` quickly, no allocation blow-up, normalised                  |
| Account enumeration | Wrong password vs unknown email on login                                                                                 | Identical response; dummy hash equalises timing                     |
| CLI paths           | `../../evil`, `..\evil`, `/etc/passwd`, `a/b`, `__proto__`, `x;rm -rf`, `$(id)` as names                                 | All refused                                                         |
| Generated project   | `.env` ignored by git and Docker, non-root container, database port not published by compose, secret required at startup | As intended                                                         |
| Shared rate limit   | Real Redis 7: two instances, expiry, 60 concurrent requests, Redis down                                                  | Exact limit held; generic 500 when down                             |
| Soak                | 180 s, 392,475 requests                                                                                                  | 0 errors, memory flat after warm-up                                 |

## Known limits (not fixed, by design or for later)

- **Password hashing memory.** Each in-flight hash needs about 128 MiB. Node.js runs four at a time by default (`UV_THREADPOOL_SIZE`). 24 concurrent verifications peaked at about 609 MiB resident memory. Size containers for this when using `@rheajs/auth`. The per-IP login limit bounds one client, not a distributed attack.
- **No account lockout, MFA, refresh tokens, sessions, password reset or OAuth/OIDC.** Access tokens cannot be revoked before they expire.
- **HS256 only.** One shared secret signs and verifies, so every service that verifies tokens can also forge them.
- **Registration reveals whether an email exists** (409). That is a deliberate usability trade-off.
- **Rate-limit counters are per process** unless you pass a shared store. A failing Redis store returns 500 (it fails closed).
- **Request timeout does not cancel the handler.** After a 503 the handler keeps running until it finishes.
- **Bodies nested deeper than 32 levels are rejected**, even when harmless.
- **Redaction depth is 4 levels.** A secret nested deeper, or under a key not in the list, is logged. Add paths with the `redact` option.
- **Generated MongoDB and MySQL compose files are for development.** No database authentication is configured for MongoDB.
- Windows and macOS were not tested manually for Docker; CI covers the unit and end-to-end tests on both.

## What an independent reviewer should look at first

1. `packages/auth/src/password.ts` and `jwt.ts`: parameter choices, constant-time behaviour, the dummy-hash timing equaliser.
2. `packages/core/src/app.ts` error handler and `security.ts`: information disclosure paths, the timeout behaviour, proxy and IP handling.
3. The generated auth module (`packages/cli/src/templates/auth.ts`): registration and login flows against real MongoDB and MySQL, including injection attempts through the email field.
4. Supply chain: the release workflow, npm provenance and the staged-publish process.
5. Anything this document does not mention.

To report a problem, follow [SECURITY.md](SECURITY.md).

# Security

Rhea.js is secure by default where it can be. Defaults reduce common mistakes. They are not a guarantee, and Rhea.js has had no independent security review.

## Defaults

| Area                | Default                                                                                                    |
| ------------------- | ---------------------------------------------------------------------------------------------------------- |
| Headers             | [Helmet](https://helmetjs.github.io/) defaults, `X-Powered-By` removed                                     |
| CORS                | No CORS headers unless you list origins. `*` is refused in production and refused with credentials         |
| Rate limiting       | 100 requests per minute per IP, in memory                                                                  |
| Body size           | 100 kb JSON limit                                                                                          |
| Timeout             | 30 s, then `503`                                                                                           |
| Prototype pollution | JSON bodies containing `__proto__`, `constructor` or `prototype` keys are rejected with `400 INVALID_BODY` |
| Errors              | No internals or stacks in production                                                                       |
| Logs                | Secret keys redacted, no query strings                                                                     |
| Config              | Invalid environment aborts startup                                                                         |

## CORS

```ts verify
import { createApp } from "@rheajs/core";

export const app = createApp({
  cors: { origin: ["https://app.example.com"], credentials: true },
});
```

Setting `CORS_ORIGIN=*` with `NODE_ENV=production` throws a `ConfigError` at startup, unless you set `allowWildcardInProduction: true`. Do not.

## Behind a proxy

Set `trustProxy` to the number of proxies in front of the app (for example `1`). Otherwise every client appears to share the proxy's IP and one rate-limit bucket, and `express-rate-limit` logs a validation warning when it sees `X-Forwarded-For`. Do not set `trustProxy: true` unless the app is only reachable through your proxy, because clients could spoof their IP.

## Rate limiting

The global limit is 100 requests per 60 seconds per IP. Tune it, key it by user or API key, or exempt routes:

```ts
import { createApp } from "@rheajs/core";

const app = createApp({
  rateLimit: {
    limit: 300,
    windowMs: 60_000,
    keyGenerator: (req) => String(req.headers["x-api-key"] ?? req.ip),
    skip: (req) => req.path === "/health",
  },
});
```

Protect sensitive routes with a stricter limit of their own, such as login:

```ts
import { Router, rateLimiter, sendSuccess } from "@rheajs/core";

export const auth = Router();
auth.post("/login", rateLimiter({ limit: 5, windowMs: 15 * 60_000 }), (_req, res) => sendSuccess(res, { ok: true }));
```

### One limit across several instances

Counters in process memory are per instance. Pass a Redis-backed store so every instance shares them. `redisRateLimitStore` accepts any client with `incr`, `decr`, `pexpire`, `pttl` and `del`, which ioredis provides:

```ts
import { createApp, redisRateLimitStore } from "@rheajs/core";
import { Redis } from "ioredis";

const redis = new Redis(process.env["REDIS_URL"]!);
const app = createApp({ rateLimit: { store: redisRateLimitStore(redis) } });
```

If Redis is unreachable the request fails with a generic 500 and is logged. Plan for that in your deployment. `ioredis` is not a dependency of Rhea.js: install it yourself. The store is tested against Redis 7 with ioredis, including two instances sharing one limit.

## Process errors and timeouts

After an uncaught exception or unhandled rejection the process state is unknown. By default Rhea.js logs it at `fatal`, runs the shutdown hooks and exits with code 1, so your supervisor (Docker, systemd, Kubernetes) restarts a clean process. Turn it off with `handleProcessErrors: false`.

The HTTP server sets `keepAliveTimeout` to 65 s (above the common 60 s load balancer idle timeout), `headersTimeout` to 30 s and `requestTimeout` to 120 s. Change them with the `server` option.

## Prototype pollution and deep bodies

JSON bodies containing `__proto__`, `constructor` or `prototype` keys are rejected with `400 INVALID_BODY`. So are bodies nested deeper than 32 levels, because a forbidden key could hide below the depth that is inspected.

## Logging

The logger replaces these keys with `[REDACTED]` at nesting levels 1 to 4: `password`, `passwordHash`, `token`, `accessToken`, `refreshToken`, `idToken`, `jwt`, `secret`, `clientSecret`, `privateKey`, `apiKey`, `authorization`, `cookie`, plus `headers.authorization`, `headers.cookie` and `headers['x-api-key']`. A secret nested deeper, or under another name, is logged in clear text. Add your own paths with the `redact` option. The request log records the path only: never the query string, headers or body.

## Limits to know about

- By default the rate limiter keeps counters in process memory: they reset on restart and are not shared between instances. For several instances, use a shared store (below) or rate limit at the gateway.
- Rhea.js core has no authentication. Use `@rheajs/auth` (see [Authentication](authentication.html)) or your own, and do not expose sensitive endpoints without it. Authentication says who is calling; checking that they may touch a given record is your code's job.
- Helmet's default Content-Security-Policy is meant for HTML. For a pure JSON API it is harmless; for HTML responses review it.
- Validation protects handlers only where you apply `validate()`.

## Scanning

`rhea security` runs static checks on your source and config. `rhea security --audit` adds `npm audit`. This is not a penetration test or an audit of your application. See [CLI](cli.html).

## Reporting vulnerabilities

See `SECURITY.md` in the repository. Do not open public issues for vulnerabilities.

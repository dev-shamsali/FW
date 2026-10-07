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

## Limits to know about

- The rate limiter keeps counters in process memory: they reset on restart and are not shared between instances. Use a shared store or rate limit at the gateway for multi-instance deployments.
- No authentication or authorization is included. Do not expose sensitive endpoints without adding it.
- Helmet's default Content-Security-Policy is meant for HTML. For a pure JSON API it is harmless; for HTML responses review it.
- Validation protects handlers only where you apply `validate()`.

## Scanning

`rhea security` runs static checks on your source and config. `rhea security --audit` adds `npm audit`. This is not a penetration test or an audit of your application. See [CLI](cli.html).

## Reporting vulnerabilities

See `SECURITY.md` in the repository. Do not open public issues for vulnerabilities.

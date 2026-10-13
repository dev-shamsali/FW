# Logging

`app.logger` is a [pino](https://github.com/pinojs/pino) logger.

```ts verify
import { createApp } from "@rheajs/core";

const app = createApp({ logger: { level: "info" } });
app.logger.info({ userId: "u1" }, "user signed in");
app.logger.warn("slow query");
app.logger.error({ err: new Error("boom") }, "failed");
app.logger.debug("hidden at info level");
```

- Development: readable lines. Production: one JSON object per line.
- Development also prints a short morgan line per request (`GET /api/rhea 200 12.3 ms - 342`) instead of the pino request line. See [Morgan access log](#morgan-access-log).
- Every request logs `requestId`, `method`, `path`, `status` and `durationMs`. The path excludes the query string so tokens in URLs are not logged.
- 5xx responses log at `error`, 4xx at `warn`, others at `info`.
- In the `test` environment the default level is `silent`.

## Morgan access log

In development, [morgan](https://github.com/expressjs/morgan) prints one colored line per request, and Rhea.js skips its own per-request pino line so you do not see every request twice. In production the pino JSON line (with the request ID) stays, because log tools read it.

```ts verify
import { createApp } from "@rheajs/core";

// Force morgan on in any environment, with the classic Apache "combined" layout.
const app = createApp({ accessLog: "combined" });

// Keep both the morgan line and the pino line:
const both = createApp({ accessLog: "dev", requestLogging: true });

// Turn the access log off in development:
const quiet = createApp({ accessLog: false });

export { app, both, quiet };
```

Formats: `"dev"` (short, colored when the terminal supports it and `NO_COLOR` is unset), `"tiny"`, `"common"` and `"combined"`. Every format prints the path only. The query string (where tokens often end up), headers other than the user agent, cookies, and bodies are never printed, and a `Referer` is cut at the `?` too.

## Redaction

These keys are replaced with `[REDACTED]` at nesting levels 1 to 4 (`password`, `passwordHash`, `token`, `accessToken`, `refreshToken`, `idToken`, `jwt`, `secret`, `clientSecret`, `privateKey`, `apiKey`, `authorization`, `cookie`, `headers.authorization`, `headers.cookie`, `DATABASE_URL`, `JWT_SECRET`, `SESSION_SECRET`). Add your own with `logger: { redact: ["creditCard"] }`.

Redaction matches key paths. It cannot detect a secret inside a free-text message, so do not interpolate secrets into log messages.

## Request IDs

A well-formed incoming `X-Request-ID` (letters, digits, `.`, `_`, `-`, up to 128 characters) is kept. Anything else is replaced with a UUID. The ID is returned in the response header and included in error bodies.

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
- Every request logs `requestId`, `method`, `path`, `status` and `durationMs`. The path excludes the query string so tokens in URLs are not logged.
- 5xx responses log at `error`, 4xx at `warn`, others at `info`.
- In the `test` environment the default level is `silent`.

## Redaction

These keys are replaced with `[REDACTED]` at the top level or one level deep (`password`, `token`, `accessToken`, `refreshToken`, `secret`, `apiKey`, `authorization`, `cookie`, `passwordHash`, `*.headers.authorization`, `*.headers.cookie`, `DATABASE_URL`, `JWT_SECRET`, `SESSION_SECRET`). Add your own with `logger: { redact: ["creditCard"] }`.

Redaction matches key paths. It cannot detect a secret inside a free-text message, so do not interpolate secrets into log messages.

## Request IDs

A well-formed incoming `X-Request-ID` (letters, digits, `.`, `_`, `-`, up to 128 characters) is kept. Anything else is replaced with a UUID. The ID is returned in the response header and included in error bodies.

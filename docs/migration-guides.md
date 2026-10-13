# Migration guides

Breaking changes are listed here and in the [changelog](https://github.com/dev-shamsali/FW/blob/main/CHANGELOG.md).

## From 0.1.0-alpha.2 (or earlier) to 1.0.0

**Breaking:** request bodies must be JSON. A `POST`, `PUT`, `PATCH` or `DELETE` with a form or text body now gets `415 UNSUPPORTED_MEDIA_TYPE` instead of reaching your handler empty. Clients that send JSON are not affected. If you accept forms or uploads, create the app with `requireJson: false`.

Behaviour that changed in development only: morgan prints a short line per request, and the pino request line is skipped (`accessLog: false` or `requestLogging: true` change that). Production logging is unchanged.

New, all optional:

- Responses carry a `Permissions-Policy` header.
- `rejectOperatorKeys` (MongoDB `$` keys), `accessLog`, and a one-time warning when `X-Forwarded-For` arrives with `trustProxy` off.
- `@rheajs/auth`: `createRefreshTokens`, `createMemoryRefreshStore`, cookie helpers, `createLockout`, `isCommonPassword`.
- `create-rhea --auth` projects get refresh tokens, logout, logout-all, account lockout and a cookie mode.

Projects generated with an alpha release keep working. Their login does not return a refresh token until you add the new auth module files (create a project with `--auth` in a scratch folder and copy `src/modules/auth/` and `src/config/auth`, then merge the new `.env` keys). The users table or collection is upgraded automatically on the first start: MySQL gets two new columns, MongoDB needs nothing.

## From 0.1.0-alpha.1 to 0.1.0-alpha.2

No API was removed. Two behaviours changed, both for safety:

- JSON bodies nested deeper than 32 levels are now rejected with `400 INVALID_BODY`. Before, a forbidden key (such as `__proto__`) could hide below that depth.
- Log redaction now covers nested values (levels 1 to 4) and more key names, so a field you relied on seeing in logs, such as a property called `token`, may now show `[REDACTED]`.

New and optional: `@rheajs/auth`, `rateLimit` options `store`, `keyGenerator` and `skip`, `rateLimiter()`, `redisRateLimitStore()`, `handleProcessErrors` and `server` timeouts. An uncaught exception or unhandled rejection now shuts the process down and exits with code 1 (set `handleProcessErrors: false` to keep the old behaviour).

## From a raw Express app

Rhea.js uses Express 5, so first make sure the app runs on Express 5 (async errors are forwarded, wildcards need names, `req.query` is read-only).

Before:

```ts
import express from "express";
const app = express();
app.use(express.json());
app.get("/users/:id", async (req, res) => {
  try {
    res.json(await getUser(req.params.id));
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});
app.listen(3000);
```

After:

```ts verify
import { createApp, NotFoundError, Router, sendSuccess } from "@rheajs/core";

async function getUser(id: string) {
  if (id === "0") throw new NotFoundError("User not found", { code: "USER_NOT_FOUND" });
  return { id };
}

const app = createApp();
app.mount(
  "/users",
  Router().get("/:id", async (req, res) => sendSuccess(res, await getUser(String(req.params["id"])))),
);
await app.start(3000);
```

What changes:

- Remove `express.json()`, Helmet, CORS and rate-limit setup you added by hand: `createApp` installs them. Configure through its options instead.
- Remove per-route `try/catch`. Throw errors and let the central handler respond.
- Response bodies now use the standard shape. Clients that depended on the old shape need updating, or set a custom `formatter`.
- Existing Express middleware works: use `app.express.use(...)` before `ready()`, or `ctx.addMiddleware` in a plugin.
- Replace `app.listen` with `app.start(port)` so graceful shutdown and hooks run.

# Migration guides

There are no version migrations yet: 0.1.0-alpha is the first release. Breaking changes between alpha releases will be listed here and in the changelog.

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

# Plugins

A plugin is an object with a `name` and a `setup(ctx)` function.

```ts verify
import { Router, type Plugin } from "@rheajs/core";

export const stats: Plugin = {
  name: "stats",
  setup(ctx) {
    let hits = 0;
    ctx.addMiddleware((_req, _res, next) => {
      hits++;
      next();
    });
    ctx.mount(
      "/stats",
      Router().get("/", (_req, res) => void res.json({ hits })),
    );
    ctx.onHook("afterShutdown", () => ctx.logger.info({ hits }, "final count"));
  },
};
```

Register it: `app.use(stats)`.

## Plugin context

Plugins receive only: `logger` (a child logger tagged with the plugin name), `production`, `addMiddleware(handler)`, `mount(path, router)`, `onHook(name, fn)`. They do not receive the Express app or framework internals, so the API can evolve without breaking plugins.

## Lifecycle hooks

Run in this order: `beforeInit`, plugin setups and mounts (in registration order), `init`, 404 and error handlers installed, `afterInit` (all during `ready()`); `beforeStart`, listen, `afterStart` (during `start()`); `beforeShutdown`, server close, `afterShutdown` (during `stop()`, also triggered by SIGTERM and SIGINT).

Hooks of the same name run in registration order, awaited one by one. Startup hooks that throw abort startup. Shutdown hooks that throw are logged and the rest still run.

## Status

The plugin API is alpha and may change. There is no plugin registry or CLI/generator extension point yet.

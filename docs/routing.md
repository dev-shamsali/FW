# Routing

Routes are plain Express 5 routers. Rhea.js re-exports `Router`.

```ts verify
import { Router, sendSuccess } from "@rheajs/core";

export const router = Router();

router.get("/", (_req, res) => sendSuccess(res, { hello: "rhea" }));
router.get("/:id", (req, res) => sendSuccess(res, { id: req.params["id"] }));
```

Mount routers with `app.mount(path, router)`, or register them in `src/modules/index.ts` in a generated project.

## Register routes before `ready()`

`app.mount` and plugins are applied in order when `ready()` (or `start()`) runs, followed by the 404 and error handlers. If you attach routes directly to `app.express` after `ready()`, they land behind the 404 handler and never match.

## Express 5 notes

- Rejected promises and thrown errors in async handlers reach the error handler automatically. No wrapper needed.
- Wildcards need a name: use `/*splat`, not `*`.
- `req.query` is a getter. Use `validate({ query })` to get a parsed, typed copy.

# Testing

Generated projects use [Vitest](https://vitest.dev/) and [Supertest](https://github.com/forwardemail/supertest).

```bash
rhea test              # run once
rhea test --coverage   # needs @vitest/coverage-v8 (included)
```

Create the app without opening a port and call it directly:

```ts verify
import { createApp, Router, sendSuccess } from "@rheajs/core";
import request from "supertest";

export async function check() {
  const app = createApp();
  app.mount(
    "/ping",
    Router().get("/", (_req, res) => sendSuccess(res, "pong")),
  );
  await app.ready();
  const res = await request(app.express).get("/ping");
  return res.body.data === "pong";
}
```

`await app.ready()` installs plugins, hooks and the 404/error handlers. In the `test` environment (Vitest sets `NODE_ENV=test`) logging is silent and rate limiting is off unless you configure it.

Layout: `tests/unit`, `tests/integration`, `tests/e2e`. `rhea generate module` adds an integration test.

Test a started server (graceful shutdown, real sockets) with `await app.start(0)`: port `0` picks a free port, read it from the returned server's `address()`, and call `await app.stop()` afterwards.

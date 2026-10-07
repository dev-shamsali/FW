# @rheajs/core

Core of **Rhea.js**, a secure, convention-driven backend framework for Node.js on Express 5.

Made by Shams Ali Shaikh. MIT licensed. Alpha: not production-ready.

```ts
import { createApp, Router, sendSuccess } from "@rheajs/core";

const app = createApp({ cors: { origin: ["https://example.com"] } });
app.mount("/hello", Router().get("/", (_req, res) => sendSuccess(res, { hi: "rhea" })));
await app.start(5000);
```

Included: request IDs, structured logging with redaction, Helmet, CORS (deny by default), rate limiting, body size limits, request timeouts, prototype-pollution guard, Zod validation and env parsing, standard error/response shapes, lifecycle hooks, graceful shutdown, plugin API.

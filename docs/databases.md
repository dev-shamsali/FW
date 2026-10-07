# Databases

Core has no database dependency and no database adapter API yet. A database adapter interface (PostgreSQL, MySQL, MongoDB, SQLite) is planned, not implemented. Use any driver today and connect it through [lifecycle hooks](plugins.html#lifecycle-hooks) so it is closed on shutdown.

```ts verify
import { createApp } from "@rheajs/core";

// Stand-in for any client: pg, mysql2, mongodb, better-sqlite3...
const db = {
  async connect() {},
  async close() {},
};

export const app = createApp()
  .hook("beforeStart", () => db.connect())
  .hook("afterShutdown", () => db.close());
```

- `beforeStart` runs before the port opens. If it throws, `start()` rejects and the server never listens.
- Shutdown hooks always all run, even if one fails. Failures are logged.
- The generated modules use an in-memory repository. Replace the repository implementation, keep the service and controller unchanged.
- Add `DATABASE_URL` to `src/config/env.ts` so a missing value aborts startup.

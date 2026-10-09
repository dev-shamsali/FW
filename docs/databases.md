# Databases

Core has no database dependency. `create` can set one up for you, and any other driver works through [lifecycle hooks](plugins.html#lifecycle-hooks).

## MongoDB and MySQL from `create`

```bash
npx create-rhea my-api --db mongodb     # or --db mysql, or pick it in the prompt
```

This adds the official driver (`mongodb` or `mysql2`, nothing else), a `DATABASE_URL` variable, and `src/config/database`:

- **Connect before listening.** The app connects in the `beforeStart` hook. If the database is unreachable, startup fails with one clear message and exit code 1, and the server never opens its port.
- **Pooled connections.** MongoDB: `maxPoolSize: 10`, 5 s server selection timeout. MySQL: a pool of 10 connections, 10 s connect timeout, keep-alive.
- **Close on shutdown.** The connection is closed in the `afterShutdown` hook, after in-flight requests finish.
- **Readiness.** `GET /health/ready` pings the database and returns `503 NOT_READY` when it is unreachable. Point load balancer or orchestrator readiness probes there. `GET /health` stays a plain liveness check.
- **Validated URL.** `DATABASE_URL` must start with `mongodb://` or `mongodb+srv://` (MongoDB) or `mysql://` (MySQL), otherwise startup aborts with the usual environment error.
- **No secrets in logs.** `DATABASE_URL` is in the logger's redaction list, and the connection error shown on failure does not include credentials.

Use the connection in your repositories:

```text
// MongoDB
const users = getDb().collection("users");

// MySQL
const [rows] = await getPool().execute("SELECT * FROM users WHERE id = ?", [id]);
```

The generated `users`-style modules keep an in-memory repository so the example works with no database. Replace the repository functions with queries; the service and controller do not change.

## A local database for development

The `create` summary prints a matching one-liner. For example:

```bash
docker run -d --name my-api-mongo -p 27017:27017 mongo:7
docker run -d --name my-api-mysql -p 3306:3306 -e MYSQL_ROOT_PASSWORD=password -e MYSQL_DATABASE=my_api mysql:8.4
```

The generated `.env` already points at these defaults. They are for local development only: use real credentials and a private network in production.

## Tests do not need a database

Tests build the app without starting it, so no connection is made. The generated tests expect `/health/ready` to answer 503 in that case, and Vitest supplies a placeholder `DATABASE_URL`.

## Any other database

Connect with hooks. This is exactly what the generated code does:

```ts verify
import { createApp } from "@rheajs/core";

// Stand-in for any client: pg, better-sqlite3, redis...
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
- Add the connection string to `src/config/env` so a missing value aborts startup.

A database adapter interface for other engines is planned, not implemented.

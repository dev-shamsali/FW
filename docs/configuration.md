# Configuration

## Environment

`src/config/env.ts` validates `process.env` with Zod at startup:

```ts verify
import { baseEnvShape, loadEnv, z } from "@rheajs/core";

export const env = loadEnv({
  ...baseEnvShape,
  DATABASE_URL: z.string().url(),
  JWT_SECRET: z.string().min(32),
});
```

If anything is missing or invalid the process prints every problem and exits with code 1:

```text
Rhea.js Environment Validation Failed

Missing:
- DATABASE_URL

Invalid:
- JWT_SECRET: Too small: expected string to have >=32 characters

Application startup aborted.
```

`baseEnvShape` provides `NODE_ENV` (`development | test | production`, default `development`), `PORT` (default 5000), `LOG_LEVEL` and `CORS_ORIGIN` (comma-separated, parsed to an array).

Use `parseEnv(shape, source)` instead of `loadEnv` when you want the error thrown (`EnvValidationError`) rather than the process exited, for example in tests.

## .env files

`rhea dev` passes `.env` to Node with `--env-file`. `rhea start` does not load any file: provide real environment variables, or pass `--env-file <path>`. Keep `.env` out of git; the generated `.gitignore` already does.

## createApp options

| Option              | Default                     | Notes                                                            |
| ------------------- | --------------------------- | ---------------------------------------------------------------- |
| `env`               | `NODE_ENV` or `development` | `production` hides internals and rejects wildcard CORS           |
| `logger`            | pretty outside production   | A `Logger` or `{ level, pretty, name, redact }`                  |
| `requestLogging`    | `true`                      | One line per request                                             |
| `cors`              | disabled                    | `{ origin: string[], credentials?, allowWildcardInProduction? }` |
| `rateLimit`         | 100 per 60 s                | `{ limit, windowMs, enabled }`                                   |
| `bodyLimit`         | `"100kb"`                   | Passed to the JSON parser                                        |
| `requestTimeoutMs`  | `30000`                     | `0` disables. Responds `503 REQUEST_TIMEOUT`                     |
| `trustProxy`        | `false`                     | Express `trust proxy`                                            |
| `formatter`         | standard shape              | See [Errors](errors.html)                                        |
| `shutdownTimeoutMs` | `10000`                     | Then open connections are closed                                 |
| `handleSignals`     | `true`                      | SIGTERM and SIGINT                                               |

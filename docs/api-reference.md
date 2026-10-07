# API reference

Everything is exported from `@rheajs/core`.

## createApp(options?)

Returns a `RheaApp`. Options are listed in [Configuration](configuration.html#createapp-options).

| Member                | Description                                                                                            |
| --------------------- | ------------------------------------------------------------------------------------------------------ |
| `express`             | The underlying Express 5 app.                                                                          |
| `logger`              | pino logger.                                                                                           |
| `production`          | `true` when env is `production`.                                                                       |
| `use(plugin)`         | Queue a plugin. Returns the app.                                                                       |
| `mount(path, router)` | Queue a router. Returns the app.                                                                       |
| `hook(name, fn)`      | Add a lifecycle hook. Returns the app.                                                                 |
| `ready()`             | Run init steps, install 404 and error handlers. Idempotent.                                            |
| `start(port?, host?)` | `ready()`, listen, install signal handlers. Resolves with the `http.Server`. Rejects on listen errors. |
| `stop()`              | Graceful shutdown. Idempotent.                                                                         |

## Errors

`AppError`, `BadRequestError`, `UnauthorizedError`, `ForbiddenError`, `NotFoundError`, `ConflictError`, `ValidationError`, `InternalServerError`, `ConfigError`.

`new AppError(status, code, message, { details?, cause?, expose? })`. The subclasses take `(message?, { code?, details?, cause? })`.

## Responses

`sendSuccess(res, data, message?, status?)`, `defaultFormatter`, and the types `ResponseFormatter`, `SuccessBody`, `ErrorBody`.

## Validation

`validate(schema | { body?, query?, params? })`, type `ValidationSchemas`, and `z` (Zod).

## Environment

`parseEnv(shape, source?)` throws `EnvValidationError` (`missing`, `invalid`, `format()`). `loadEnv(shape, source?)` prints and exits with code 1. `baseEnvShape`.

## Logging

`createLogger(config?)`, `DEFAULT_REDACT`, types `Logger`, `LoggerConfig`, `LogLevel`.

## Request ID

`requestId(header?)` middleware factory. Installed automatically by `createApp`.

## Types and re-exports

`Plugin`, `PluginContext`, `HookName`, `HookFn`, `CorsConfig`, `RateLimitConfig`, `RheaApp`, `RheaOptions`, and from Express: `Router`, `Request`, `Response`, `NextFunction`, `RequestHandler`.

`HookName` is one of `beforeInit`, `init`, `afterInit`, `beforeStart`, `afterStart`, `beforeShutdown`, `afterShutdown`.

import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import express, { type Express, type ErrorRequestHandler, type RequestHandler, type Router } from "express";
import { AppError, ConfigError } from "./errors.js";
import { Hooks, type HookFn, type HookName } from "./lifecycle.js";
import { createLogger, requestLogger, type Logger, type LoggerConfig } from "./logger.js";
import type { Plugin, PluginContext } from "./plugin.js";
import { requestId } from "./request-id.js";
import { defaultFormatter, type ErrorBody, type ResponseFormatter } from "./response.js";
import {
  corsMiddleware,
  helmetMiddleware,
  rateLimitMiddleware,
  rejectPrototypePollution,
  timeoutMiddleware,
  type CorsConfig,
  type RateLimitConfig,
} from "./security.js";

export interface RheaOptions {
  /** Defaults to NODE_ENV or "development". */
  env?: "development" | "test" | "production";
  logger?: Logger | LoggerConfig;
  /** Log one line per request. Default true. */
  requestLogging?: boolean;
  cors?: CorsConfig;
  rateLimit?: RateLimitConfig;
  /** Max body size passed to express.json. Default "100kb". */
  bodyLimit?: string;
  /** Per-request timeout in ms. Default 30000. 0 disables. */
  requestTimeoutMs?: number;
  /** Express "trust proxy" setting. Default false. */
  trustProxy?: boolean | number | string;
  formatter?: ResponseFormatter;
  /** Max ms to wait for in-flight requests on shutdown. Default 10000. */
  shutdownTimeoutMs?: number;
  /** Install SIGTERM/SIGINT handlers on start(). Default true. */
  handleSignals?: boolean;
}

export interface RheaApp {
  readonly express: Express;
  readonly logger: Logger;
  readonly production: boolean;
  /** Register a plugin. Applied in order during ready(). */
  use(plugin: Plugin): RheaApp;
  /** Mount a router. Applied in order with plugins during ready(). */
  mount(path: string, router: Router): RheaApp;
  hook(name: HookName, fn: HookFn): RheaApp;
  /** Runs init hooks and installs 404 + error handlers. Idempotent. Use in tests with supertest(app.express). */
  ready(): Promise<RheaApp>;
  start(port?: number, host?: string): Promise<Server>;
  stop(): Promise<void>;
}

interface HttpLikeError {
  status?: number;
  statusCode?: number;
  type?: string;
  expose?: boolean;
}

const BODY_PARSER_CODES: Record<string, [string, string]> = {
  "entity.too.large": ["PAYLOAD_TOO_LARGE", "Request body too large"],
  "entity.parse.failed": ["INVALID_JSON", "Malformed JSON body"],
  "encoding.unsupported": ["UNSUPPORTED_ENCODING", "Unsupported content encoding"],
  "charset.unsupported": ["UNSUPPORTED_CHARSET", "Unsupported charset"],
};

export function createApp(options: RheaOptions = {}): RheaApp {
  const env = options.env ?? (process.env["NODE_ENV"] as RheaOptions["env"]) ?? "development";
  const production = env === "production";
  const formatter = options.formatter ?? defaultFormatter;
  const given = options.logger;
  const logger: Logger =
    given && "info" in given && typeof given.info === "function"
      ? (given as Logger)
      : createLogger({ pretty: !production, ...(given as LoggerConfig | undefined), level: (given as LoggerConfig | undefined)?.level ?? (env === "test" ? "silent" : undefined) });
  const hooks = new Hooks();
  const queue: Array<() => void | Promise<void>> = [];
  const app = express();
  app.disable("x-powered-by");
  app.set("etag", false);
  app.set("trust proxy", options.trustProxy ?? false);
  app.locals["rheaFormatter"] = formatter;

  // Fixed order: id -> logging -> security headers -> cors -> rate limit -> timeout -> body -> sanitize
  app.use(requestId());
  if (options.requestLogging !== false) app.use(requestLogger(logger));
  app.use(helmetMiddleware());
  const corsMw = corsMiddleware(options.cors ?? {}, production);
  if (corsMw) app.use(corsMw);
  const rl = rateLimitMiddleware(options.rateLimit);
  // Rate limiting is on by default except in the test env, unless explicitly configured.
  if (rl && (env !== "test" || options.rateLimit)) app.use(rl);
  const timeout = options.requestTimeoutMs ?? 30_000;
  if (timeout > 0) app.use(timeoutMiddleware(timeout));
  app.use(express.json({ limit: options.bodyLimit ?? "100kb", strict: true }));
  app.use(rejectPrototypePollution);

  const errorHandler: ErrorRequestHandler = (err: unknown, req, res, _next) => {
    let status = 500;
    let code = "INTERNAL_ERROR";
    let message = "Internal server error";
    let details: unknown;

    if (err instanceof AppError) {
      status = err.status;
      code = err.code;
      details = err.details;
      message = err.expose || !production ? err.message : "Internal server error";
      if (!err.expose) code = production ? "INTERNAL_ERROR" : err.code;
    } else {
      const h = (err ?? {}) as HttpLikeError & Error;
      const s = h.status ?? h.statusCode;
      if (typeof s === "number" && s >= 400 && s < 500) {
        status = s;
        const known = h.type ? BODY_PARSER_CODES[h.type] : undefined;
        code = known?.[0] ?? "BAD_REQUEST";
        message = known?.[1] ?? "Bad request";
      } else if (!production && err instanceof Error) {
        message = err.message;
      }
    }

    if (status >= 500) logger.error({ err, requestId: req.id }, "unhandled error");
    if (res.headersSent) return res.end();

    const body: ErrorBody["error"] = { code, message };
    if (details !== undefined) body.details = details;
    if (req.id) body.requestId = req.id;
    if (!production && status >= 500 && err instanceof Error && err.stack) body.stack = err.stack;
    res.status(status).json(formatter.error(body));
  };

  let readyPromise: Promise<void> | undefined;
  let server: Server | undefined;
  let stopping: Promise<void> | undefined;
  const signalHandlers: Array<[NodeJS.Signals, () => void]> = [];

  const self: RheaApp = {
    express: app,
    logger,
    production,
    use(plugin) {
      queue.push(async () => {
        const ctx: PluginContext = {
          logger: logger.child({ plugin: plugin.name }),
          production,
          addMiddleware: (h: RequestHandler) => void app.use(h),
          mount: (p, r) => void app.use(p, r),
          onHook: (n, f) => hooks.on(n, f),
        };
        await plugin.setup(ctx);
      });
      return self;
    },
    mount(path, router) {
      queue.push(() => void app.use(path, router));
      return self;
    },
    hook(name, fn) {
      hooks.on(name, fn);
      return self;
    },
    ready() {
      readyPromise ??= (async () => {
        await hooks.run("beforeInit");
        for (const step of queue.splice(0)) await step();
        await hooks.run("init");
        app.use((req, _res, next) => next(new AppError(404, "NOT_FOUND", `Route ${req.method} ${req.path} not found`)));
        app.use(errorHandler);
        await hooks.run("afterInit");
      })();
      return readyPromise.then(() => self);
    },
    async start(port = Number(process.env["PORT"] ?? 5000), host) {
      if (server) throw new ConfigError("Server already started");
      await self.ready();
      await hooks.run("beforeStart");
      const srv = createServer(app);
      server = srv;
      await new Promise<void>((resolve, reject) => {
        srv.once("error", reject);
        srv.listen(port, host, () => {
          srv.off("error", reject);
          resolve();
        });
      });
      const addr = srv.address() as AddressInfo;
      logger.info({ port: addr.port, env }, "server started");
      await hooks.run("afterStart");
      if (options.handleSignals !== false) {
        for (const sig of ["SIGTERM", "SIGINT"] as const) {
          const h = () => {
            logger.info({ signal: sig }, "shutting down");
            self.stop().then(
              () => process.exit(0),
              () => process.exit(1),
            );
          };
          process.once(sig, h);
          signalHandlers.push([sig, h]);
        }
      }
      return srv;
    },
    stop() {
      stopping ??= (async () => {
        for (const [sig, h] of signalHandlers.splice(0)) process.off(sig, h);
        const onError = (e: unknown) => logger.error({ err: e }, "shutdown hook failed");
        await hooks.run("beforeShutdown", { continueOnError: true, onError });
        const srv = server;
        if (srv) {
          await new Promise<void>((resolve) => {
            const force = setTimeout(() => srv.closeAllConnections(), options.shutdownTimeoutMs ?? 10_000);
            force.unref();
            srv.close(() => {
              clearTimeout(force);
              resolve();
            });
            srv.closeIdleConnections();
          });
        }
        await hooks.run("afterShutdown", { continueOnError: true, onError });
        logger.info("shutdown complete");
      })();
      return stopping;
    },
  };
  return self;
}

import { pino, type Logger as PinoLogger, type LoggerOptions, type DestinationStream } from "pino";
import type { RequestHandler } from "express";

export type Logger = PinoLogger;
export type LogLevel = "fatal" | "error" | "warn" | "info" | "debug" | "trace" | "silent";

const SENSITIVE_KEYS = [
  "password",
  "passwordHash",
  "token",
  "accessToken",
  "refreshToken",
  "idToken",
  "jwt",
  "secret",
  "clientSecret",
  "privateKey",
  "apiKey",
  "authorization",
  "cookie",
];
/** A sensitive key is caught at this many nesting levels, counting the top level of the logged object as 1. pino wildcards match exactly one level each. */
const REDACT_DEPTH = 4;
const prefixes = Array.from({ length: REDACT_DEPTH }, (_, n) => "*.".repeat(n));

/** Keys redacted from every log line, at nesting levels 1 to 4. Extend via `redact` option. */
export const DEFAULT_REDACT = [
  ...prefixes.flatMap((p) => SENSITIVE_KEYS.map((k) => `${p}${k}`)),
  ...prefixes.flatMap((p) => [`${p}*.headers.authorization`, `${p}*.headers.cookie`, `${p}*.headers['x-api-key']`]),
  "DATABASE_URL",
  "JWT_SECRET",
  "SESSION_SECRET",
  "*.DATABASE_URL",
  "*.JWT_SECRET",
  "*.SESSION_SECRET",
];

const COLORS: Record<number, [string, string]> = {
  10: ["TRACE", "\x1b[90m"],
  20: ["DEBUG", "\x1b[36m"],
  30: ["INFO ", "\x1b[32m"],
  40: ["WARN ", "\x1b[33m"],
  50: ["ERROR", "\x1b[31m"],
  60: ["FATAL", "\x1b[35m"],
};

/** Dependency-free readable stream for development. Production uses raw JSON. */
function prettyStream(): DestinationStream {
  return {
    write(line: string) {
      try {
        const {
          level,
          time,
          msg,
          pid: _p,
          hostname: _h,
          name: _n,
          ...rest
        } = JSON.parse(line) as Record<string, unknown> & { level: number; time: number; msg?: string };
        const [label, color] = COLORS[level] ?? ["LOG  ", ""];
        const t = new Date(time).toISOString().slice(11, 23);
        const extra = Object.keys(rest).length ? ` \x1b[90m${JSON.stringify(rest)}\x1b[0m` : "";
        process.stdout.write(`\x1b[90m${t}\x1b[0m ${color}${label}\x1b[0m ${msg ?? ""}${extra}\n`);
      } catch {
        process.stdout.write(line);
      }
    },
  };
}

export interface LoggerConfig {
  level?: LogLevel;
  /** Human readable output. Defaults to true outside production. */
  pretty?: boolean;
  name?: string;
  redact?: string[];
  destination?: DestinationStream;
}

export function createLogger(config: LoggerConfig = {}): Logger {
  const pretty = config.pretty ?? process.env["NODE_ENV"] !== "production";
  const options: LoggerOptions = {
    level: config.level ?? (process.env["NODE_ENV"] === "production" ? "info" : "debug"),
    redact: { paths: [...DEFAULT_REDACT, ...(config.redact ?? [])], censor: "[REDACTED]" },
    base: pretty ? undefined : { pid: process.pid },
    ...(config.name ? { name: config.name } : {}),
  };
  return pino(options, config.destination ?? (pretty ? prettyStream() : undefined));
}

/** Logs one line per finished request: id, method, path (no query string), status, duration. */
export function requestLogger(logger: Logger): RequestHandler {
  return (req, res, next) => {
    const start = process.hrtime.bigint();
    res.once("close", () => {
      const ms = Number(process.hrtime.bigint() - start) / 1e6;
      const url = req.originalUrl;
      const q = url.indexOf("?");
      const status = res.statusCode;
      const level = status >= 500 ? "error" : status >= 400 ? "warn" : "info";
      logger[level](
        { requestId: req.id, method: req.method, path: q === -1 ? url : url.slice(0, q), status, durationMs: Math.round(ms * 100) / 100 },
        "request",
      );
    });
    next();
  };
}

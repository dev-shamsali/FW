import cors from "cors";
import helmet from "helmet";
import { rateLimit, type Store } from "express-rate-limit";
import type { Request, RequestHandler } from "express";
import { BadRequestError, AppError, ConfigError } from "./errors.js";

export interface CorsConfig {
  /** Allowed origins. Empty/false disables CORS headers (secure default). "*" is rejected in production. */
  origin?: string[] | false;
  credentials?: boolean;
  /** Explicitly allow "*" in production. Not recommended. */
  allowWildcardInProduction?: boolean;
}
export interface RateLimitConfig {
  windowMs?: number;
  limit?: number;
  /** Set false to disable (not recommended). */
  enabled?: boolean;
  /**
   * Where hit counters live. The default is in process memory, so with several instances each keeps its own count.
   * Use a shared store such as `redisRateLimitStore` to enforce one limit across all instances.
   */
  store?: Store;
  /** Bucket key per request. Default is the client IP. Use it to limit per user or API key. */
  keyGenerator?: (req: Request) => string;
  /** Return true to exempt a request, for example health checks. */
  skip?: (req: Request) => boolean;
}

export function corsMiddleware(c: CorsConfig, production: boolean): RequestHandler | null {
  const origin = c.origin;
  if (!origin || origin.length === 0) return null;
  if (production && origin.includes("*") && !c.allowWildcardInProduction) {
    throw new ConfigError('CORS origin "*" is not allowed in production. List explicit origins.');
  }
  if (origin.includes("*") && c.credentials) {
    throw new ConfigError('CORS origin "*" cannot be combined with credentials.');
  }
  return cors({ origin: origin.includes("*") ? "*" : origin, credentials: c.credentials ?? false });
}

export function rateLimitMiddleware(c: RateLimitConfig = {}): RequestHandler | null {
  if (c.enabled === false) return null;
  return rateLimit({
    windowMs: c.windowMs ?? 60_000,
    limit: c.limit ?? 100,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    ...(c.store ? { store: c.store } : {}),
    ...(c.keyGenerator ? { keyGenerator: c.keyGenerator } : {}),
    ...(c.skip ? { skip: c.skip } : {}),
    handler: (_req, _res, next) => next(new AppError(429, "RATE_LIMITED", "Too many requests")),
  });
}

/**
 * A stricter limiter for one route, for example login or password reset.
 * Same 429 error shape as the global limiter. Always enabled; give it its own store when running several instances.
 */
export function rateLimiter(c: Omit<RateLimitConfig, "enabled"> = {}): RequestHandler {
  return rateLimitMiddleware(c)!;
}

export const helmetMiddleware = (): RequestHandler => helmet();

/** Aborts requests that exceed ms with a 503 if no response has started. */
export function timeoutMiddleware(ms: number): RequestHandler {
  return (_req, res, next) => {
    const t = setTimeout(() => {
      if (!res.headersSent) next(new AppError(503, "REQUEST_TIMEOUT", "Request timed out", { expose: true }));
    }, ms);
    t.unref();
    res.once("close", () => clearTimeout(t));
    next();
  };
}

const FORBIDDEN = new Set(["__proto__", "constructor", "prototype"]);
function polluted(v: unknown, depth: number): boolean {
  if (depth > 32 || v === null || typeof v !== "object") return false;
  if (Array.isArray(v)) return v.some((x) => polluted(x, depth + 1));
  for (const k of Object.keys(v)) {
    if (FORBIDDEN.has(k) || polluted((v as Record<string, unknown>)[k], depth + 1)) return true;
  }
  return false;
}

/** Rejects JSON bodies carrying __proto__/constructor/prototype keys (prototype pollution vectors). */
export const rejectPrototypePollution: RequestHandler = (req, _res, next) => {
  if (req.body && typeof req.body === "object" && polluted(req.body, 0)) {
    return next(new BadRequestError("Invalid request body", { code: "INVALID_BODY" }));
  }
  next();
};

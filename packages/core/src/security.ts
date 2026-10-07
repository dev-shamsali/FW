import cors from "cors";
import helmet from "helmet";
import { rateLimit } from "express-rate-limit";
import type { RequestHandler } from "express";
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
    handler: (_req, _res, next) => next(new AppError(429, "RATE_LIMITED", "Too many requests")),
  });
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

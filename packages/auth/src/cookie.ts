import type { NextFunction, Request, RequestHandler, Response } from "@rheajs/core";
import { ForbiddenError } from "@rheajs/core";

export interface RefreshCookieOptions {
  /** Cookie name. Default "rhea_refresh". */
  name?: string;
  /** Only sent to these URLs. Default "/api/auth". */
  path?: string;
  /** Send only over HTTPS. Turn on in production. */
  secure: boolean;
  /** Lifetime in seconds, normally the refresh token's idle lifetime. */
  maxAgeSec: number;
}

const DEFAULT_NAME = "rhea_refresh";
const DEFAULT_PATH = "/api/auth";

/** Sets the refresh token as an httpOnly, SameSite=Strict cookie. JavaScript in the page cannot read it. */
export function setRefreshCookie(res: Response, token: string, o: RefreshCookieOptions): void {
  const parts = [
    `${o.name ?? DEFAULT_NAME}=${token}`,
    `Max-Age=${Math.max(0, Math.floor(o.maxAgeSec))}`,
    `Path=${o.path ?? DEFAULT_PATH}`,
    "HttpOnly",
    "SameSite=Strict",
  ];
  if (o.secure) parts.push("Secure");
  res.append("Set-Cookie", parts.join("; "));
}

/** Removes the refresh cookie (logout). */
export function clearRefreshCookie(res: Response, o: Pick<RefreshCookieOptions, "name" | "path" | "secure">): void {
  const parts = [`${o.name ?? DEFAULT_NAME}=`, "Max-Age=0", `Path=${o.path ?? DEFAULT_PATH}`, "HttpOnly", "SameSite=Strict"];
  if (o.secure) parts.push("Secure");
  res.append("Set-Cookie", parts.join("; "));
}

/** Reads one cookie from the Cookie header. Returns the first match, or undefined. No cookie-parser needed. */
export function readCookie(req: Request, name = DEFAULT_NAME): string | undefined {
  const header = req.headers.cookie;
  if (typeof header !== "string" || header.length > 4096) return undefined;
  for (const part of header.split(";")) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    if (part.slice(0, eq).trim() === name) return part.slice(eq + 1).trim();
  }
  return undefined;
}

/**
 * CSRF check for requests authenticated by a cookie. The browser always sends Origin on cross-site POSTs, so the request
 * must carry an Origin that is on your allow-list. Together with SameSite=Strict this blocks forged requests.
 * Throws ForbiddenError (CSRF_ORIGIN).
 */
export function assertAllowedOrigin(req: Request, allowed: readonly string[]): void {
  const origin = req.headers.origin;
  if (typeof origin !== "string" || !allowed.includes(origin)) throw new ForbiddenError("Request origin is not allowed", { code: "CSRF_ORIGIN" });
}

/** Middleware form of `assertAllowedOrigin`, for routes that are always cookie-authenticated. */
export function requireAllowedOrigin(allowed: readonly string[]): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction) => {
    try {
      assertAllowedOrigin(req, allowed);
      next();
    } catch (e) {
      next(e);
    }
  };
}

/** Sets `Cache-Control: no-store` so tokens are never kept by browsers, proxies or CDNs. */
export const noStore: RequestHandler = (_req, res, next) => {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Pragma", "no-cache");
  next();
};

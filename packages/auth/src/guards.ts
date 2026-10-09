import type { NextFunction, Request, RequestHandler, Response } from "@rheajs/core";
import { ForbiddenError, UnauthorizedError } from "@rheajs/core";
import type { Jwt, TokenClaims } from "./jwt.js";

export interface AuthUser {
  id: string;
  roles: string[];
  claims: TokenClaims;
}

declare global {
  namespace Express {
    interface Request {
      /** Set by `authenticate()` after a valid access token. */
      user?: AuthUser;
    }
  }
}

function bearer(req: Request): string | undefined {
  const h = req.headers.authorization;
  if (typeof h !== "string") return undefined;
  const m = /^Bearer ([A-Za-z0-9\-._~+/]+=*)$/.exec(h);
  return m?.[1];
}

function toUser(claims: TokenClaims): AuthUser {
  const roles = Array.isArray(claims.roles) ? claims.roles.filter((r): r is string => typeof r === "string") : [];
  return { id: claims.sub, roles, claims };
}

/**
 * Requires a valid `Authorization: Bearer <token>` header and sets `req.user`.
 * Tokens are read from the header only, never from the URL, so they do not end up in logs.
 */
export function authenticate(jwt: Jwt): RequestHandler {
  return async (req: Request, res: Response, next: NextFunction) => {
    const token = bearer(req);
    if (!token) {
      res.setHeader("WWW-Authenticate", 'Bearer realm="api"');
      return next(new UnauthorizedError("Authentication required", { code: "AUTH_REQUIRED" }));
    }
    try {
      req.user = toUser(await jwt.verify(token));
      next();
    } catch (e) {
      res.setHeader("WWW-Authenticate", 'Bearer error="invalid_token"');
      next(e);
    }
  };
}

/** Like `authenticate`, but a missing token is allowed. A present but invalid token is still rejected. */
export function optionalAuth(jwt: Jwt): RequestHandler {
  const strict = authenticate(jwt);
  return (req, res, next) => (bearer(req) ? strict(req, res, next) : next());
}

/** Allows the request only if `req.user` has at least one of the roles. Use after `authenticate()`. */
export function requireRole(...roles: string[]): RequestHandler {
  if (roles.length === 0) throw new Error("requireRole needs at least one role");
  return (req, _res, next) => {
    if (!req.user) return next(new UnauthorizedError("Authentication required", { code: "AUTH_REQUIRED" }));
    if (!roles.some((r) => req.user!.roles.includes(r))) return next(new ForbiddenError("You do not have access to this resource"));
    next();
  };
}

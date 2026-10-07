import { randomUUID } from "node:crypto";
import type { RequestHandler } from "express";

const SAFE_ID = /^[A-Za-z0-9._-]{1,128}$/;

declare global {
  namespace Express {
    interface Request {
      id: string;
    }
  }
}

/** Propagates a well-formed X-Request-ID, otherwise generates one. Untrusted input is never echoed unless it matches a strict charset. */
export function requestId(header = "x-request-id"): RequestHandler {
  return (req, res, next) => {
    const incoming = req.headers[header];
    const id = typeof incoming === "string" && SAFE_ID.test(incoming) ? incoming : randomUUID();
    req.id = id;
    res.setHeader(header, id);
    next();
  };
}

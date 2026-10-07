import type { RequestHandler } from "express";
import type { ZodType } from "zod";
import { ValidationError } from "./errors.js";

type Target = "body" | "query" | "params";
export type ValidationSchemas = Partial<Record<Target, ZodType>>;

function isSchema(x: unknown): x is ZodType {
  return typeof (x as ZodType | undefined)?.safeParse === "function";
}

/**
 * validate(schema) validates req.body. validate({ body, query, params }) validates several parts.
 * Parsed output replaces the raw value, so unknown keys stripped by Zod never reach handlers.
 * Uses synchronous parsing: schemas with async refinements are not supported.
 */
export function validate(schemaOrMap: ZodType | ValidationSchemas, target: Target = "body"): RequestHandler {
  const entries = (isSchema(schemaOrMap) ? [[target, schemaOrMap]] : Object.entries(schemaOrMap)) as [Target, ZodType][];
  return (req, _res, next) => {
    const errors: { in: Target; path: string; message: string }[] = [];
    for (const [where, schema] of entries) {
      const r = schema.safeParse(req[where]);
      if (r.success) {
        if (where === "query") Object.defineProperty(req, "query", { value: r.data, writable: true, configurable: true, enumerable: true });
        else (req as unknown as Record<string, unknown>)[where] = r.data;
      } else {
        for (const i of r.error.issues) errors.push({ in: where, path: i.path.join("."), message: i.message });
      }
    }
    if (errors.length) return next(new ValidationError("Invalid request", { details: errors }));
    next();
  };
}

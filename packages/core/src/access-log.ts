import morgan from "morgan";
import type { Request, RequestHandler } from "express";

/** Morgan formats Rhea.js offers. All of them print the path only, never the query string. */
export type AccessLogFormat = "dev" | "combined" | "common" | "tiny";

const pathOf = (req: Request): string => {
  const url = req.originalUrl ?? req.url ?? "";
  const q = url.indexOf("?");
  return q === -1 ? url : url.slice(0, q);
};

/** A referrer can carry a query string with tokens in it, so it is cut at the "?" like the request path. */
const referrerPath = (req: Request): string => {
  const r = req.headers.referer ?? req.headers.referrer;
  if (typeof r !== "string") return "-";
  const q = r.indexOf("?");
  return q === -1 ? r : r.slice(0, q);
};

const useColor = (): boolean => process.stdout.isTTY === true && process.env["NO_COLOR"] === undefined;

function paint(status: number, text: string): string {
  if (!useColor()) return text;
  const code = status >= 500 ? 31 : status >= 400 ? 33 : status >= 300 ? 36 : status >= 200 ? 32 : 0;
  return `\x1b[${code}m${text}\x1b[0m`;
}

/**
 * Morgan access log with query strings, headers (except user agent and a path-only referrer) and bodies kept out.
 * Output goes to stdout unless a stream is given.
 */
export function accessLog(format: AccessLogFormat, stream?: { write(line: string): void }): RequestHandler {
  return morgan(
    (tokens, req, res) => {
      const r = req as Request;
      const status = Number(tokens["status"]?.(req, res)) || 0;
      const length = tokens["res"]?.(req, res, "content-length") ?? "-";
      const ms = tokens["response-time"]?.(req, res) ?? "-";
      const path = pathOf(r);
      if (format === "dev") return `${r.method} ${path} ${paint(status, String(status))} ${ms} ms - ${length}`;
      if (format === "tiny") return `${r.method} ${path} ${status} ${length} - ${ms} ms`;
      const base = `${tokens["remote-addr"]?.(req, res) ?? "-"} - - [${tokens["date"]?.(req, res, "clf") ?? "-"}] "${r.method} ${path} HTTP/${r.httpVersion}" ${status} ${length}`;
      if (format === "common") return base;
      return `${base} "${referrerPath(r)}" "${tokens["user-agent"]?.(req, res) ?? "-"}"`;
    },
    stream ? { stream } : {},
  );
}

import type { Response } from "express";

export interface SuccessBody<T = unknown> {
  success: true;
  data: T;
  message: string;
}
export interface ErrorBody {
  success: false;
  error: { code: string; message: string; details?: unknown; requestId?: string; stack?: string };
}

/** Override to change the wire format of every response. */
export interface ResponseFormatter {
  success<T>(data: T, message: string): unknown;
  error(error: ErrorBody["error"]): unknown;
}

export const defaultFormatter: ResponseFormatter = {
  success: (data, message) => ({ success: true, data, message }),
  error: (error) => ({ success: false, error }),
};

export function sendSuccess<T>(res: Response, data: T, message = "Success", status = 200): void {
  const f = (res.app.locals["rheaFormatter"] as ResponseFormatter | undefined) ?? defaultFormatter;
  res.status(status).json(f.success(data, message));
}

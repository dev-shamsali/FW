/** Base class for errors that are safe to describe to API clients. */
export class AppError extends Error {
  readonly status: number;
  readonly code: string;
  /** When false the message is hidden from clients in production. */
  readonly expose: boolean;
  readonly details?: unknown;

  constructor(status: number, code: string, message: string, options: { details?: unknown; cause?: unknown; expose?: boolean } = {}) {
    super(message, options.cause === undefined ? undefined : { cause: options.cause });
    this.name = new.target.name;
    this.status = status;
    this.code = code;
    this.expose = options.expose ?? status < 500;
    this.details = options.details;
  }
}

type Opts = { code?: string; details?: unknown; cause?: unknown };

export class BadRequestError extends AppError {
  constructor(message = "Bad request", o: Opts = {}) {
    super(400, o.code ?? "BAD_REQUEST", message, o);
  }
}
export class UnauthorizedError extends AppError {
  constructor(message = "Unauthorized", o: Opts = {}) {
    super(401, o.code ?? "UNAUTHORIZED", message, o);
  }
}
export class ForbiddenError extends AppError {
  constructor(message = "Forbidden", o: Opts = {}) {
    super(403, o.code ?? "FORBIDDEN", message, o);
  }
}
export class NotFoundError extends AppError {
  constructor(message = "Not found", o: Opts = {}) {
    super(404, o.code ?? "NOT_FOUND", message, o);
  }
}
export class ConflictError extends AppError {
  constructor(message = "Conflict", o: Opts = {}) {
    super(409, o.code ?? "CONFLICT", message, o);
  }
}
export class ValidationError extends AppError {
  constructor(message = "Invalid request", o: Opts = {}) {
    super(422, o.code ?? "VALIDATION_ERROR", message, o);
  }
}
export class InternalServerError extends AppError {
  constructor(message = "Internal server error", o: Opts = {}) {
    super(500, o.code ?? "INTERNAL_ERROR", message, { ...o, expose: false });
  }
}
/** Thrown at startup for invalid framework configuration. Never sent to clients. */
export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfigError";
  }
}

# Errors

Throw an `AppError` subclass from anywhere. The central handler converts it to a response.

| Class                 | Status | Default code       |
| --------------------- | ------ | ------------------ |
| `BadRequestError`     | 400    | `BAD_REQUEST`      |
| `UnauthorizedError`   | 401    | `UNAUTHORIZED`     |
| `ForbiddenError`      | 403    | `FORBIDDEN`        |
| `NotFoundError`       | 404    | `NOT_FOUND`        |
| `ConflictError`       | 409    | `CONFLICT`         |
| `ValidationError`     | 422    | `VALIDATION_ERROR` |
| `InternalServerError` | 500    | `INTERNAL_ERROR`   |

```ts verify
import { AppError, NotFoundError } from "@rheajs/core";

export function find(id: string): never {
  throw new NotFoundError("User not found", { code: "USER_NOT_FOUND" });
}

export const teapot = () => new AppError(418, "TEAPOT", "I am a teapot");
```

Response:

```json
{
  "success": false,
  "error": { "code": "USER_NOT_FOUND", "message": "User not found", "requestId": "3f0c…" }
}
```

`requestId` lets you match a client report to the server logs.

## What clients never see in production

- Any error that is not an `AppError` becomes `500 INTERNAL_ERROR` with the message `Internal server error`.
- `InternalServerError` and any `AppError` with `expose: false` are masked the same way.
- Stack traces are included only outside production, and only for 5xx errors.
- Malformed or oversized JSON becomes `INVALID_JSON` (400) or `PAYLOAD_TOO_LARGE` (413) with a fixed message.
- Full details for 5xx errors are written to the log, not the response.

## Custom response format

```ts verify
import { createApp } from "@rheajs/core";

export const app = createApp({
  formatter: {
    success: (data, message) => ({ ok: true, data, message }),
    error: (error) => ({ ok: false, code: error.code, message: error.message }),
  },
});
```

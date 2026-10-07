# Validation

`validate()` checks the request with a Zod schema. `z` is re-exported from `@rheajs/core`.

```ts verify
import { Router, sendSuccess, validate, z } from "@rheajs/core";

const createUser = z.object({ email: z.email(), age: z.number().int().min(0) });
const idParams = z.object({ id: z.uuid() });
const listQuery = z.object({ page: z.coerce.number().int().min(1).default(1) });

export const router = Router();

router.post("/", validate(createUser), (req, res) => sendSuccess(res, req.body, "Created", 201));
router.get("/:id", validate({ params: idParams }), (req, res) => sendSuccess(res, { id: req.params["id"] }));
router.get("/", validate({ query: listQuery }), (req, res) => sendSuccess(res, { page: req.query["page"] }));
```

- `validate(schema)` validates `req.body`. `validate({ body, query, params })` validates several parts and reports all failures together.
- The parsed output replaces the raw value, so keys Zod strips never reach your handler.
- Failure returns `422` with code `VALIDATION_ERROR` and `details`:

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request",
    "details": [{ "in": "body", "path": "email", "message": "Invalid email address" }],
    "requestId": "…"
  }
}
```

Limitation: parsing is synchronous. Schemas with async refinements throw. Do async checks (like uniqueness) in the service.

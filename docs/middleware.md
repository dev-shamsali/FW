# Middleware

Rhea.js installs this fixed order:

1. Request ID (`X-Request-ID`)
2. Request logging
3. Helmet security headers
4. CORS (only when origins are configured)
5. Rate limiting (disabled in the `test` environment unless configured)
6. Request timeout
7. JSON body parser with size limit
8. Prototype-pollution guard
9. Your routes and plugins
10. 404 handler, then error handler

Write your own middleware as normal Express middleware and generate a stub with `rhea generate middleware auth`.

```ts verify
import { UnauthorizedError, type NextFunction, type Request, type Response } from "@rheajs/core";

export function requireApiKey(expected: string) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (req.header("x-api-key") !== expected) return next(new UnauthorizedError("Invalid API key"));
    next();
  };
}
```

To add middleware globally from a plugin use `ctx.addMiddleware`. See [Plugins](plugins.html).

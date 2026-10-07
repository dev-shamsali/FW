# Deployment

General checklist for any host:

1. `npm ci && npm run build` (or build in Docker).
2. Set `NODE_ENV=production`. `rhea start` does this for you.
3. Provide every variable from `src/config/env.ts`. Startup aborts with a list if any is missing or invalid.
4. Set `CORS_ORIGIN` to explicit origins.
5. Behind a load balancer or reverse proxy, set `trustProxy` (see [Security](security.html)).
6. Route the platform's stop signal (SIGTERM) to the Node process. Avoid wrappers that swallow signals. Running `node dist/server.js` directly is safest.
7. Use `/health` for liveness checks.
8. Collect stdout: production logs are JSON, one object per line.
9. Run `rhea doctor` and `rhea security` in CI.

Graceful shutdown waits for in-flight requests up to `shutdownTimeoutMs` (10 s by default), then closes remaining connections. Make sure your platform's termination grace period is longer.

Rhea.js is alpha. Evaluate carefully before running it in production.

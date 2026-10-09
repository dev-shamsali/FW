# Troubleshooting

**`rhea: command not found` or `nodemon: command not found` when running `npm run dev`.**
Dependencies are not installed. Run `npm install` inside the project folder. `npx rhea doctor` reports "Dependencies are not installed" when `node_modules` is missing.

**`Cannot find "tsx" in this project. Run "npm install" first.`**
Dependencies are not installed. Run `npm install`. The same message appears for `typescript` and `vitest`.

**`No package.json here. Run this inside a Rhea.js project`**
Run the command from the project root.

**`dist/server.js not found. Run "rhea build" first.`**
Run `rhea build` before `rhea start`.

**Startup prints `Rhea.js Environment Validation Failed`.**
Fix the listed variables. In development copy `.env.example` to `.env`. In production set real environment variables, since `rhea start` does not read `.env`.

**My routes return 404 even though they are registered.**
Routes added to `app.express` after `ready()` or `start()` are behind the 404 handler. Register before, or use `app.mount`.

**`EADDRINUSE`.**
Another process uses the port. Change `PORT` or stop the other process.

**`ConfigError: CORS origin "*" is not allowed in production`.**
List explicit origins in `CORS_ORIGIN`.

**Every client is rate limited together behind a proxy, or `ERR_ERL_UNEXPECTED_X_FORWARDED_FOR` is logged.**
Set `trustProxy` to the number of proxies. See [Security](security.html).

**429 in tests.**
Rate limiting is off in the `test` environment unless you pass `rateLimit` explicitly.

**npm warns that `esbuild` install scripts were skipped (npm 11+).**
`tsx` depends on esbuild, which ships its binary through platform packages, so `rhea dev` and tests still worked when this was checked on Linux. If esbuild fails to run, approve its script with the command npm prints.

**`npm install` fails with `Cannot read properties of null (reading 'edgesOut')`.**
Reproduced on npm 10.8 and 10.9 when the project uses `vitest` 4.1.x. Generated projects pin `vitest` and `@vitest/coverage-v8` to `~4.0.18`, which installs cleanly. If you upgraded Vitest and hit this, pin it back or upgrade npm.

**Startup fails with `Could not connect to MongoDB` or `Could not connect to MySQL`.**
The database is not reachable at `DATABASE_URL`. Start one (the `create` summary prints a `docker run` one-liner), or fix the URL. The app deliberately refuses to start without its database.

**`Environment Validation Failed: DATABASE_URL must start with mongodb://`.**
`DATABASE_URL` has the wrong scheme for the database you chose (`mongodb://`, `mongodb+srv://` or `mysql://`).

**`/health/ready` returns 503.**
The database ping failed. `/health` (liveness) is separate and stays 200.

**CommonJS project fails with `ERR_REQUIRE_ESM` or `ERR_PACKAGE_PATH_NOT_EXPORTED`.**
`@rheajs/core` is an ES module and CommonJS loads it with `require()`. That needs Node.js 20.19+ or 22.12+ (on by default there). Upgrade Node.

**`rhea build` fails with type errors.**
`rhea build` emits nothing on type errors by design. Fix them, or run `npm run typecheck` to see them with tests included.

**Windows or macOS problems.**
Cross-platform support is untested at the time of writing. Please open an issue with the output of `rhea info`.

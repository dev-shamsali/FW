# Troubleshooting

**`rhea: command not found` or `nodemon: command not found` when running `npm run dev`.**
Dependencies are not installed. Run `npm install` inside the project folder. `npx rhea doctor` reports "Dependencies are not installed" when `node_modules` is missing.

**`create` says "git does not know who you are" or "the first commit was skipped".**
The project is fine and `git init` already ran. Set your identity once with `git config --global user.name "Your Name"` and `git config --global user.email "you@example.com"`, then in the project run `git add -A && git commit -m "Initial commit"`.

**`create` did not create a repository, or the GitHub step did nothing.**
No repository is created inside an existing repository, when git is missing, or with `--no-git`. The GitHub step needs the GitHub CLI: install it from https://cli.github.com and run `gh auth login`. A name that already exists on your account is refused by GitHub; choose another folder name or create the repository by hand and run `git remote add origin <url> && git push -u origin main`.

**`415 UNSUPPORTED_MEDIA_TYPE` after upgrading, or from a form or curl call.**
Since 1.0.0 (and 0.1.0-alpha.3) a request body must be JSON. Send `Content-Type: application/json` (curl: `-H "content-type: application/json" -d '{"a":1}'`). If a route really needs form or multipart bodies, create the app with `requireJson: false`.

**`AUTH_REFRESH_COOKIE=true needs CORS_ORIGIN`.**
Cookie mode checks the request's `Origin` against `CORS_ORIGIN` (a CSRF defence). Set `CORS_ORIGIN=https://your-frontend.example` in `.env`.

**`403 CSRF_ORIGIN` on `/api/auth/refresh`.**
In cookie mode the browser must send an `Origin` header that is listed in `CORS_ORIGIN`. Call from the real frontend origin with `credentials: "include"`. Postman and curl send no `Origin`: use body mode (`AUTH_REFRESH_COOKIE=false`) for them.

**`429 ACCOUNT_LOCKED`.**
Five wrong passwords lock an account for 15 minutes. It unlocks by itself; `Retry-After` says how many seconds remain. To unlock now, set `failedLogins` to 0 and `lockedUntil` to null on the user.

**`npm audit` reports vitest advisories in a generated project.**
Generated projects pin Vitest 4.0.x. `npm audit` flags it and `@vitest/mocker`, because the fix (Vitest 4.1.11) crashes npm 10, which Node.js 20 ships. `npm audit --omit=dev` is clean. The advisories affect Vitest only when its UI server runs or a test uses a redirecting mock from untrusted input. On Node.js 22.12 or newer you can upgrade Vitest. Details: [SECURITY_AUDIT.md](https://github.com/dev-shamsali/FW/blob/main/SECURITY_AUDIT.md).

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

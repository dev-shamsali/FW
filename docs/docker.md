# Docker

```bash
rhea docker
```

Writes `Dockerfile`, `.dockerignore` and `docker-compose.yml` (existing files are not overwritten without `--force`). It reads `rhea.config.json`, so the files match your project:

- **TypeScript:** a build stage compiles to `dist/`, and the image runs `node dist/server.js`.
- **JavaScript:** no build stage; the image runs `node src/server.js`.
- **MongoDB or MySQL:** `docker-compose.yml` also defines the database service (`mongo:7` or `mysql:8.4`) with a health check, a named volume, and `depends_on: condition: service_healthy`, and sets `DATABASE_URL` for the app. For MySQL, set `MYSQL_ROOT_PASSWORD` in `.env` or the shell (compose refuses to start without it) and use a URL-safe value because it is embedded in the URL. The compose database is a development convenience without authentication for MongoDB; harden it for real deployments.

The TypeScript Dockerfile has three stages: build (installs all dependencies, runs `npm run build`), production dependencies only (`npm ci --omit=dev`), and the runtime stage on `node:22-alpine` that copies `dist/` and runs as the non-root `node` user with `NODE_ENV=production`. The JavaScript one has the last two.

Requirements: a `package-lock.json` (the Dockerfile uses `npm ci`).

```bash
docker build -t my-api .
docker run --rm -p 5000:5000 -e CORS_ORIGIN=https://app.example.com my-api
```

`.env` files are excluded from the image by `.dockerignore`. Pass configuration with environment variables at runtime.

The container runs `node dist/server.js` directly, so SIGTERM from `docker stop` reaches the app and triggers graceful shutdown.

## Verification status

Checked on Linux with Docker 29.8.1: the TypeScript image (earlier alpha) and the JavaScript image (this release, run against a real MySQL 8.4 container) build, serve requests, run as the `node` user, contain no dev dependencies, and `docker stop` produced "shutdown complete" with exit code 0. The database health-check commands (`mongosh` ping, `mysqladmin ping`) were run against real containers. `docker compose` itself was not available when this was written, so the compose files were checked structurally (valid YAML, services, dependencies) but not started with Compose. Other platforms and builders are untested.

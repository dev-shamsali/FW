# Docker

```bash
rhea docker
```

Writes `Dockerfile`, `.dockerignore` and `docker-compose.yml` (existing files are not overwritten without `--force`).

The Dockerfile has three stages: build (installs all dependencies, runs `npm run build`), production dependencies only (`npm ci --omit=dev`), and the runtime stage on `node:22-alpine` that copies `dist/` and runs as the non-root `node` user with `NODE_ENV=production`.

Requirements: a `package-lock.json` (the Dockerfile uses `npm ci`).

```bash
docker build -t my-api .
docker run --rm -p 5000:5000 -e CORS_ORIGIN=https://app.example.com my-api
```

`.env` files are excluded from the image by `.dockerignore`. Pass configuration with environment variables at runtime.

The container runs `node dist/server.js` directly, so SIGTERM from `docker stop` reaches the app and triggers graceful shutdown.

## Verification status

Checked once on Linux with Docker 29.8.1: the image builds, serves `/health`, runs as the `node` user, contains no dev dependencies such as `typescript` or `vitest`, and `docker stop` produced "shutdown complete" with exit code 0. The check used local package tarballs because the packages are not on npm yet. Other platforms and builders are untested.

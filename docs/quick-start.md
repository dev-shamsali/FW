# Quick start

```bash
npx create-rhea my-api
cd my-api
npm install
npm run dev
```

The terminal shows:

```text
  Rhea.js  |  developed by Shams Ali Shaikh

  Local:  http://localhost:5000
  Try:    http://localhost:5000/api/rhea
```

Open `http://localhost:5000/api/rhea`. This is your first API:

```json
{
  "success": true,
  "data": {
    "name": "Rhea.js",
    "message": "Rhea.js is running. This is your first API.",
    "developedBy": "Shams Ali Shaikh",
    "environment": "development",
    "node": "v22.0.0",
    "endpoints": { "rhea": "/api/rhea", "health": "/health", "ready": "/health/ready" },
    "docs": "https://rhea.devcodehub.cloud/docs/introduction/"
  },
  "message": "Hello from Rhea.js"
}
```

`npm run dev` uses nodemon: edit a file and the server restarts, shutting down gracefully first.

## Add a resource

```bash
npx rhea generate module users
```

This creates a controller, service, repository, routes, schema, types (TypeScript only) and an integration test for `users`, and registers the module. Try it:

```bash
curl -X POST localhost:5000/users -H 'content-type: application/json' -d '{"name":"Ada"}'
curl localhost:5000/users
```

## Test, build, run

```bash
npm test                  # Vitest + Supertest
npm run build             # TypeScript only: type check and compile to dist/
npm start                 # node dist/server.js (TypeScript) or node src/server.js (JavaScript)
npx rhea doctor
npx rhea security
```

`npm start` does not read `.env`: it expects real environment variables, as in production. Use `npm run start:env` to load `.env` locally.

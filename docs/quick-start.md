# Quick start

```bash
npx create-rhea my-api
cd my-api
npm install
npm run dev
```

Open `http://localhost:5000/health`:

```json
{ "success": true, "data": { "status": "ok", "uptime": 1.2 }, "message": "Success" }
```

Generate a resource:

```bash
npx rhea generate module users
```

This creates a controller, service, repository, routes, schema and types for `users`, adds an integration test, and registers the module in `src/modules/index.ts`. Try it:

```bash
curl -X POST localhost:5000/users -H 'content-type: application/json' -d '{"name":"Ada"}'
curl localhost:5000/users
```

Then run the checks and the production build:

```bash
npm test
npx rhea build
npx rhea start
npx rhea doctor
npx rhea security
```

`rhea start` runs `dist/server.js` with `NODE_ENV=production`.

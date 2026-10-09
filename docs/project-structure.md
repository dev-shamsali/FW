# Project structure

```text
my-api/
├── src/
│   ├── config/
│   │   ├── env.ts             validated environment
│   │   └── database.ts        only when you chose MongoDB or MySQL
│   ├── modules/
│   │   ├── index.ts           module registry
│   │   ├── rhea/              your first API: GET / and GET /api/rhea
│   │   └── health/            GET /health and GET /health/ready
│   ├── middleware/
│   ├── utils/
│   ├── app.ts                 buildApp(): creates and wires the app
│   └── server.ts              starts the server and prints the banner
├── tests/{unit,integration,e2e}/
├── .env  .env.example  .gitignore  .gitattributes
├── nodemon.json  rhea.config.json
├── eslint.config.mjs  prettier.config.mjs  vitest.config.ts
├── tsconfig.json  tsconfig.build.json     TypeScript only
├── .github/workflows/ci.yml
└── package.json
```

JavaScript projects use `.js` instead of `.ts` and have no `tsconfig` files. CommonJS JavaScript projects write their tests as `.mjs` files.

## rhea.config.json

```json
{ "language": "ts", "module": "esm", "database": "none" }
```

Written by `create`. Generators (`rhea generate ...`) and `rhea docker` read it so that new files use the same language and module system. Delete it and generators fall back to TypeScript with ES Modules.

## Why feature modules

Each feature lives in `src/modules/<name>/` with its controller, service, repository, routes, schema and types side by side. Code that changes together stays together, and a module can later become its own package or plugin without untangling layers.

The cost: shared code needs a home. Put it in `src/utils`.

## app and server

`app` exports `buildApp()` so tests can create an app without opening a port. `server` only starts it. If startup fails (for example the database is down), it logs one clear message and exits with code 1.

# Project structure

```text
my-api/
├── src/
│   ├── config/env.ts          validated environment
│   ├── modules/
│   │   ├── index.ts           module registry
│   │   └── health/health.routes.ts
│   ├── middleware/
│   ├── core/
│   ├── utils/
│   ├── types/
│   ├── app.ts                 buildApp(): creates and wires the app
│   └── server.ts              starts the server
├── tests/{unit,integration,e2e}/
├── .env  .env.example  .gitignore
├── eslint.config.js  prettier.config.js
├── tsconfig.json  tsconfig.build.json  vitest.config.ts
└── package.json
```

## Why feature modules

Each feature lives in `src/modules/<name>/` with its controller, service, repository, routes, schema and types side by side. Code that changes together stays together, and a module can later become its own package or plugin without untangling layers.

The cost: shared code needs a home. Put it in `src/core` or `src/utils`.

## app.ts and server.ts

`app.ts` exports `buildApp()` so tests can create an app without opening a port. `server.ts` only calls `buildApp().start(env.PORT)`.

# Rhea.js

**The secure, convention-driven backend framework for Node.js.**

Build Express 5 APIs with TypeScript, security-first defaults, a CLI and a predictable project layout. Express stays the HTTP engine. Rhea.js adds the architecture around it.

Made by **Shams Ali Shaikh**. MIT licensed.

> **Alpha (0.1.0-alpha).** The API can change between alpha releases. It is not production-ready and has had no independent security review.

Website: https://rhea.devcodehub.cloud · Docs: https://rhea.devcodehub.cloud/docs/introduction/

## Quick start

```bash
npx create-rhea my-api
cd my-api
npm install
npm run dev          # http://localhost:5000/health
npx rhea generate module users
npm test
npx rhea build && npx rhea start
```

Requires Node.js 20.19 or newer (generated projects use Vite 7 through Vitest).

## What is in the box

- `createApp()`: request IDs, request logging with secret redaction, Helmet, CORS (denied by default), rate limiting, body size limit, request timeout, prototype-pollution guard, standard error and response shapes, lifecycle hooks, graceful shutdown, plugin API.
- Zod validation for body, query and params, and Zod environment validation that stops startup on bad config.
- `rhea` CLI: `create`, `dev`, `build`, `start`, `generate`, `test`, `doctor`, `security`, `docker`, `info`.

## Packages

| Package        | Purpose                      |
| -------------- | ---------------------------- |
| `@rheajs/core` | The framework runtime        |
| `@rheajs/cli`  | The `rhea` command           |
| `create-rhea`  | `npx create-rhea` scaffolder |

## Not included yet

Authentication, database adapters, a shared rate-limit store. See the roadmap in [ROADMAP.md](ROADMAP.md).

## Develop

```bash
git clone <this repository>
cd <repository>
npm install
npm run verify       # lint, typecheck, unit tests, build
npm run test:e2e     # scaffolds, installs, builds and starts a real app (slow)
```

See [CONTRIBUTING.md](CONTRIBUTING.md). Security reports: [SECURITY.md](SECURITY.md).

## License

[MIT](LICENSE) © 2026 Shams Ali Shaikh

# Rhea.js

**The secure, convention-driven backend framework for Node.js.**

Build Express 5 APIs with TypeScript, security-first defaults, a CLI and a predictable project layout. Express stays the HTTP engine. Rhea.js adds the architecture around it.

Made by **Shams Ali Shaikh**. MIT licensed.

> **Alpha (0.1.0-alpha.2).** The API can change between alpha releases. It is not production-ready and has had no independent security review. See [SECURITY_AUDIT.md](SECURITY_AUDIT.md) for what was tested and what is still open.

Website: https://rhea.devcodehub.cloud · Docs: https://rhea.devcodehub.cloud/docs/introduction/

## Quick start

```bash
npx create-rhea my-api    # asks: TypeScript or JavaScript, ESM or CommonJS, MongoDB / MySQL / none
cd my-api
npm install
npm run dev               # nodemon, then open http://localhost:5000/api/rhea
npx rhea generate module users
npm test
npm run build && npm start
```

Requires Node.js 20.19 or newer (generated projects use Vite 7 through Vitest).

## What is in the box

- `createApp()`: request IDs, request logging with secret redaction, Helmet, CORS (denied by default), rate limiting, body size limit, request timeout, prototype-pollution guard, standard error and response shapes, lifecycle hooks, graceful shutdown, plugin API.
- Zod validation for body, query and params, and Zod environment validation that stops startup on bad config.
- `rhea` CLI: `create`, `dev`, `build`, `start`, `generate`, `test`, `doctor`, `security`, `docker`, `info`.
- Generated projects in TypeScript or JavaScript, ES Modules or CommonJS, with optional MongoDB or MySQL (pooled connection, readiness endpoint, clean shutdown), a working first API and nodemon for development.

## Packages

| Package        | Purpose                      |
| -------------- | ---------------------------- |
| `@rheajs/core` | The framework runtime        |
| `@rheajs/auth` | Passwords, JWT, route guards |
| `@rheajs/cli`  | The `rhea` command           |
| `create-rhea`  | `npx create-rhea` scaffolder |

## Not included yet

Sessions, refresh tokens, OAuth/OIDC and MFA, an ORM or query layer. The rate limit is per process unless you pass a shared store. See [ROADMAP.md](ROADMAP.md).

## Develop

```bash
git clone https://github.com/dev-shamsali/FW.git
cd FW
npm install
npm run verify       # lint, typecheck, unit tests, build
npm run test:e2e     # scaffolds, installs, builds and starts a real app (slow)
```

See [CONTRIBUTING.md](CONTRIBUTING.md). Security reports: [SECURITY.md](SECURITY.md).

## License

[MIT](LICENSE) © 2026 Shams Ali Shaikh

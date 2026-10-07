# CLI

```bash
rhea <command> [options]
```

| Command                       | What it does                                                                                                 |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `rhea create <name>`          | Scaffold a project. Flags: `--install`, `--core-spec`, `--cli-spec`.                                         |
| `rhea dev`                    | Run `src/server.ts` in watch mode via tsx. Loads `.env` if present.                                          |
| `rhea build`                  | Type check and compile `src/` to `dist/` in one `tsc` pass. No output on type errors.                        |
| `rhea start`                  | Run `dist/server.js` with `NODE_ENV=production`. Does not load `.env` unless `--env-file <path>` is passed.  |
| `rhea generate <kind> <name>` | Kinds: `module`, `controller`, `service`, `route`, `middleware`, `validator`. Alias: `rhea g`.               |
| `rhea test [args]`            | Run Vitest once. Extra args pass through, e.g. `rhea test --coverage`.                                       |
| `rhea doctor`                 | Check Node, npm, TypeScript, configuration and security setup. Exit 1 on errors.                             |
| `rhea security`               | Static security scan. Flags: `--audit` (runs `npm audit`, needs network), `--strict` (medium findings fail). |
| `rhea docker`                 | Generate `Dockerfile`, `.dockerignore`, `docker-compose.yml`.                                                |
| `rhea info`                   | Print versions and platform.                                                                                 |

Exit codes: `0` success, `1` failure, `2` usage error (unknown command, missing or invalid name).

Generators validate names: lowercase letters, digits and hyphens only. They refuse to overwrite files unless you pass `--force`.

## rhea security

A basic static check: hard-coded credentials (file and line only, values are never printed), wildcard CORS, disabled rate limiting, large body limits, insecure cookie options, `.env` not ignored or tracked by git, raw `express()` without `createApp`. **It is not a penetration test or a security audit.** A clean result does not mean the app is secure.

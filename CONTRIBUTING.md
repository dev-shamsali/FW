# Contributing to Rhea.js

Thanks for helping. This guide gets you from clone to pull request.

## Setup

Requirements: Node.js 20.19+ and npm.

```bash
git clone https://github.com/dev-shamsali/FW.git
cd FW
npm install
npm run verify
```

`verify` runs lint, typecheck, unit tests and the build. It must pass before you open a pull request.

## Layout

```text
packages/core         framework runtime (@rheajs/core)
packages/cli          rhea CLI, generators, templates (@rheajs/cli)
packages/create-rhea  npx create-rhea wrapper
apps/docs             docs site generator (reads /docs/*.md)
apps/website          marketing site (Next.js, static export)
tests/                e2e journey, docs checks, website checks
```

## Everyday commands

| Command                 | What it does                                                                                                                         |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `npm run lint`          | ESLint                                                                                                                               |
| `npm run typecheck`     | TypeScript for core, cli and website                                                                                                 |
| `npm test`              | Unit and integration tests (Vitest)                                                                                                  |
| `npm run test:coverage` | Same, with coverage                                                                                                                  |
| `npm run test:e2e`      | Packs the packages, scaffolds a project in a temp directory, installs, generates, tests, builds, starts, stops (slow, needs network) |
| `npm run build`         | Builds core, cli and create-rhea                                                                                                     |
| `npm run build:website` | Builds docs and the website into `apps/website/out`                                                                                  |
| `npm run format`        | Prettier                                                                                                                             |

## Making changes

- Write a failing test first where practical, and run the test that covers your change.
- Keep dependencies minimal. A new runtime dependency needs a documented reason in `ARCHITECTURE.md`.
- Docs: edit `docs/*.md`. Code blocks marked `ts verify` are type-checked by the test suite, so they must compile against the real build.
- Never log or print secret values. Generators must not overwrite existing files without `--force`.
- Do not claim performance numbers without a documented benchmark, and do not add fabricated statistics anywhere.

## Commits and pull requests

Use [Conventional Commits](https://www.conventionalcommits.org): `feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`, `security:`.

1. Fork, then branch from `main` (`feature/...` or `fix/...`).
2. Open a pull request against `main` and fill in the template.
3. CI must pass on Linux, macOS and Windows.

## Reporting issues

Use the issue templates. Include the output of `npx rhea info`. For security problems, follow [SECURITY.md](SECURITY.md) and do not open a public issue.

By contributing you agree that your contributions are licensed under the MIT license. Please follow the [Code of Conduct](CODE_OF_CONDUCT.md).

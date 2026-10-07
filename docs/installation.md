# Installation

Requirements: Node.js 20.19 or newer (the generated project's tooling needs it) and npm 10 or newer. The runtime packages `@rheajs/core` and `@rheajs/cli` declare `node >=20`.

```bash
npx create-rhea my-api
cd my-api
npm install
npm run dev
```

> The packages are not published to npm yet. Until the first alpha release, build from source: clone the repository, run `npm install && npm run build`, then pack the packages and point `RHEA_CORE_SPEC` and `RHEA_CLI_SPEC` at the tarballs before running `create`.

`create` does not install dependencies unless you pass `--install`. It refuses to write into a non-empty directory.

Check your setup at any time:

```bash
npx rhea doctor
npx rhea info
```

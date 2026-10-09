# Installation

Requirements: Node.js 20.19 or newer (the generated project's tooling needs it) and npm 10 or newer. The runtime packages `@rheajs/core` and `@rheajs/cli` declare `node >=20`.

```bash
npx create-rhea my-api
cd my-api
npm install
npm run dev
```

> Rhea.js is published to npm as an alpha (`0.1.0-alpha.0`). The API can change between alpha releases.

`create` does not install dependencies unless you pass `--install`. It refuses to write into a non-empty directory.

Check your setup at any time:

```bash
npx rhea doctor
npx rhea info
```

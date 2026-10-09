# Installation

Requirements: Node.js 20.19 or newer and npm 10 or newer. (Generated projects use tooling that needs 20.19+. CommonJS projects rely on Node loading the ES-module build of `@rheajs/core` through `require()`, which is on by default from 20.19.)

> Rhea.js is published to npm as an alpha (`0.1.0-alpha.1`). The API can change between alpha releases.

```bash
npx create-rhea my-api
```

`create` asks four questions. Use the arrow keys (or number keys) and Enter:

1. **Language**: TypeScript (recommended) or JavaScript.
2. **Module system**: ES Modules (`import`/`export`, recommended) or CommonJS (`require`/`module.exports`).
3. **Database**: None, MongoDB or MySQL.
4. **Install dependencies now?** Yes or No.

Then:

```bash
cd my-api
npm install        # skip if you answered Yes
npm run dev
```

Open `http://localhost:5000/api/rhea`.

## Skip the questions

Every question has a flag, so scripts and CI never block:

| Flag                         | Meaning                                               |
| ---------------------------- | ----------------------------------------------------- |
| `--ts` / `--js`              | TypeScript or JavaScript (default TypeScript)         |
| `--esm` / `--cjs`            | ES Modules or CommonJS (default ES Modules)           |
| `--db none\|mongodb\|mysql`  | Database (default none)                               |
| `--auth` / `--no-auth`       | Add register, login and JWT routes (needs a database) |
| `--install` / `--no-install` | Run `npm install` after creating                      |
| `--yes`, `-y`                | Accept defaults for anything not given, ask nothing   |

```bash
npx create-rhea my-api --js --cjs --db mongodb --install
```

When there is no terminal (a CI job, a pipe) `create` behaves as if `--yes` was passed. It refuses to write into a non-empty directory.

Check your setup at any time:

```bash
npx rhea doctor
npx rhea info
```

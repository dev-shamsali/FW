# Publishing Rhea.js

Everything here is done by you, the owner. Claude and CI never hold your credentials. Nothing has been published, pushed or deployed yet.

## 0. Decide the names (do this first)

| Thing                       | Plan                                                | Status when checked (2026-10-07)                                                                                                                                                            |
| --------------------------- | --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| npm scope                   | `@rheajs` (packages `@rheajs/core`, `@rheajs/cli`)  | No packages exist under it. I could not tell whether someone already owns the scope itself, because npm's website blocks automated checks. You find out when you try to create it (step 2). |
| npm unscoped                | `create-rhea`                                       | Free                                                                                                                                                                                        |
| npm `rhea`                  | not usable                                          | Taken by an unrelated AMQP library                                                                                                                                                          |
| GitHub account/org `rheajs` | not usable                                          | **Taken** by someone else                                                                                                                                                                   |
| GitHub repository           | your account, for example `dev-shamsali/FW` | Pick any free name                                                                                                                                                                          |

If the `@rheajs` scope is not available to you on npm, tell Claude the scope you do own (your npm username scope, for example `@yourname`). It is a find-and-replace across packages, templates, docs and tests, and the test suite will verify it.

## 1. GitHub

1. Create an empty **public** repository named e.g. `rhea-js` (no README, no license; they exist locally). Enable 2FA on your account.
2. From the project folder:
   ```bash
   npm run set-repo -- dev-shamsali/FW     # writes the real repo URL into package.json files and the site
   npm run build && npm run build:website
   git add -A && git commit -m "chore: set repository url"
   git branch -M main
   git remote add origin git@github.com:dev-shamsali/FW.git
   git push -u origin main
   git checkout -b develop && git push -u origin develop
   ```
3. Repository settings:
   - **Security** → enable _Private vulnerability reporting_ (SECURITY.md relies on it).
   - **Discussions** → enable (community Q&A).
   - **Branches** → protect `main`: require pull request, require the CI checks to pass.
   - **Environments** → create `npm-publish`, add yourself as _Required reviewer_. The release job pauses until you approve.
4. Check that **Actions → CI** passes on Linux, macOS and Windows. This is the first time the Windows and macOS runs happen. If one fails, send me the log.

## 2. npm

1. Create an npm account and **enable 2FA** (required for publishing).
2. Create the organization: https://www.npmjs.com/org/create , name `rheajs`, free plan (public packages). If the name is taken, see step 0.
3. Create an automation token: _Profile → Access Tokens → Generate New Token → Granular_. Give it **publish** permission only for `@rheajs/*` and `create-rhea`, short expiry.
4. In GitHub: _Settings → Environments → npm-publish → Secrets → add `NPM_TOKEN`_ and paste the token there. **Never paste the token into chat, a file, or a commit.**
5. (First publish only) `create-rhea` and the `@rheajs` packages must not exist yet. The first publish creates them.

## 3. Pre-flight

```bash
npm ci
npm run verify
npm run test:e2e
npm run build:website
node scripts/check-release.mjs --strict
```

`check-release` inspects exactly what would be published: file lists, secrets scan, versions, then installs the real tarballs into an empty project and imports them. It must say `Release check passed`. Also read the dry-run yourself:

```bash
npm pack --dry-run -w @rheajs/core -w @rheajs/cli -w create-rhea
```

You should see only `dist/*.js`, `dist/*.d.ts`, `README.md`, `LICENSE` and `package.json`.

## 4. Release

```bash
git checkout main && git pull
git tag v0.1.0-alpha.0
git push origin v0.1.0-alpha.0
```

Pushing the tag starts **Release**. It re-runs every check, then waits for you to approve the `npm-publish` environment. After you approve, it publishes `@rheajs/core`, `@rheajs/cli` and `create-rhea` with npm provenance. It never runs on pull requests.

Then create the GitHub Release: _Releases → Draft a new release → choose tag `v0.1.0-alpha.0` → tick "Set as a pre-release" → paste `release-notes/v0.1.0-alpha.md`_.

Manual alternative (not recommended, no provenance): `npm login` then `npm publish -w @rheajs/core -w @rheajs/cli -w create-rhea --access public`.

## 5. Verify the published packages

In an empty directory:

```bash
npx create-rhea@latest my-api && cd my-api && npm install && npm run dev
```

If that works, only then announce it. Do not claim downloads, users or stars.

## 6. If something goes wrong

- A published version cannot be republished. Fix, bump to `0.1.0-alpha.1`, update `CHANGELOG.md`, tag again.
- Within 72 hours you can `npm unpublish <pkg>@<version>`; otherwise use `npm deprecate`.
- If a token leaks: revoke it on npmjs.com immediately, then create a new one.

## 7. Deploy the website

See [DEPLOY.md](DEPLOY.md).

import type { Files } from "./module.js";

export interface AppTemplateOptions {
  name: string;
  coreSpec: string;
  cliSpec: string;
}

export function appFiles({ name, coreSpec, cliSpec }: AppTemplateOptions): Files {
  const pkg = {
    name,
    version: "0.1.0",
    private: true,
    type: "module",
    engines: { node: ">=20" },
    scripts: {
      dev: "rhea dev",
      build: "rhea build",
      start: "rhea start",
      test: "rhea test",
      "test:coverage": "rhea test --coverage",
      typecheck: "tsc --noEmit",
      lint: "eslint .",
      format: "prettier --write .",
      doctor: "rhea doctor",
      security: "rhea security",
    },
    dependencies: { "@rheajs/core": coreSpec },
    devDependencies: {
      "@rheajs/cli": cliSpec,
      "@eslint/js": "^10.0.0",
      "@types/node": "^22.0.0",
      "@types/supertest": "^6.0.3",
      "@vitest/coverage-v8": "^5.0.3",
      eslint: "^10.12.0",
      prettier: "^3.9.9",
      supertest: "^7.3.1",
      tsx: "^4.23.15",
      typescript: "~5.9.3",
      "typescript-eslint": "^8.71.1",
      vitest: "^5.0.3",
    },
  };
  return {
    "package.json": JSON.stringify(pkg, null, 2) + "\n",
    "tsconfig.json":
      JSON.stringify(
        {
          compilerOptions: {
            target: "ES2022",
            module: "NodeNext",
            moduleResolution: "NodeNext",
            strict: true,
            noUncheckedIndexedAccess: true,
            skipLibCheck: true,
            isolatedModules: true,
            esModuleInterop: true,
            noEmit: true,
            types: ["node"],
          },
          include: ["src", "tests", "vitest.config.ts"],
        },
        null,
        2,
      ) + "\n",
    "tsconfig.build.json":
      JSON.stringify(
        {
          extends: "./tsconfig.json",
          compilerOptions: { noEmit: false, outDir: "dist", rootDir: "src", noEmitOnError: true, sourceMap: true },
          include: ["src"],
        },
        null,
        2,
      ) + "\n",
    "vitest.config.ts": `import { defineConfig } from "vitest/config";

export default defineConfig({
  test: { include: ["tests/**/*.test.ts"], coverage: { provider: "v8", include: ["src/**"] } },
});
`,
    "eslint.config.js": `import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist", "coverage", "node_modules"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
);
`,
    "prettier.config.js": `export default { printWidth: 100, singleQuote: false, trailingComma: "all" };
`,
    ".env": "NODE_ENV=development\nPORT=5000\nCORS_ORIGIN=\n",
    ".env.example":
      "# Copy to .env. Never commit real secrets.\nNODE_ENV=development\nPORT=5000\n# Comma-separated list of allowed origins. Empty disables CORS. Never use * in production.\nCORS_ORIGIN=\n# LOG_LEVEL=info\n",
    ".gitignore": "node_modules\ndist\ncoverage\n.env\n.env.*\n!.env.example\n*.tsbuildinfo\n",
    "README.md": `# ${name}

Built with [Rhea.js](https://github.com/) (made by Shams Ali Shaikh).

\`\`\`bash
npm install
npm run dev        # http://localhost:5000/health
npm test
npm run build && npm start
npx rhea generate module users
npx rhea doctor
npx rhea security
\`\`\`
`,
    "src/app.ts": `import { createApp, type RheaApp } from "@rheajs/core";
import { env } from "./config/env.js";
import { modules } from "./modules/index.js";

export function buildApp(): RheaApp {
  const app = createApp({
    env: env.NODE_ENV,
    logger: { level: env.LOG_LEVEL },
    cors: { origin: env.CORS_ORIGIN },
  });
  for (const m of modules) app.mount(m.path, m.router);
  return app;
}
`,
    "src/server.ts": `import { buildApp } from "./app.js";
import { env } from "./config/env.js";

await buildApp().start(env.PORT);
`,
    "src/config/env.ts": `import { baseEnvShape, loadEnv } from "@rheajs/core";

// Add your own variables here, e.g. DATABASE_URL: z.string().url(). Startup aborts if invalid.
export const env = loadEnv({ ...baseEnvShape });
`,
    "src/modules/index.ts": `import type { Router } from "@rheajs/core";
import { healthRouter } from "./health/health.routes.js";
// rhea:imports

export interface ModuleEntry {
  path: string;
  router: Router;
}

export const modules: ModuleEntry[] = [
  { path: "/health", router: healthRouter },
  // rhea:modules
];
`,
    "src/modules/health/health.routes.ts": `import { Router, sendSuccess } from "@rheajs/core";

export const healthRouter = Router();

healthRouter.get("/", (_req, res) => sendSuccess(res, { status: "ok", uptime: process.uptime() }));
`,
    "src/middleware/.gitkeep": "",
    "src/core/.gitkeep": "",
    "src/utils/.gitkeep": "",
    "src/types/.gitkeep": "",
    "tests/unit/.gitkeep": "",
    "tests/e2e/.gitkeep": "",
    "tests/integration/health.test.ts": `import request from "supertest";
import { describe, expect, it } from "vitest";
import { buildApp } from "../../src/app.js";

describe("GET /health", () => {
  it("returns ok", async () => {
    const app = await buildApp().ready();
    const res = await request(app.express).get("/health");
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe("ok");
    expect(res.headers["x-request-id"]).toBeTruthy();
  });
});
`,
  };
}

export const dockerFiles = (): Files => ({
  Dockerfile: `# syntax=docker/dockerfile:1
FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev

FROM node:22-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package.json ./
USER node
EXPOSE 5000
CMD ["node", "dist/server.js"]
`,
  ".dockerignore": "node_modules\ndist\ncoverage\n.env\n.env.*\n!.env.example\n.git\nDockerfile\ndocker-compose.yml\n",
  "docker-compose.yml": `services:
  app:
    build: .
    ports:
      - "5000:5000"
    environment:
      NODE_ENV: production
      PORT: "5000"
      CORS_ORIGIN: \${CORS_ORIGIN:-}
    restart: unless-stopped
`,
});

export const workflowFiles = (): Files => ({
  ".github/workflows/ci.yml": `name: CI
on:
  push:
    branches: [main]
  pull_request:
permissions:
  contents: read
jobs:
  test:
    runs-on: \${{ matrix.os }}
    strategy:
      matrix:
        os: [ubuntu-latest, windows-latest, macos-latest]
        node: [20, 22]
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: \${{ matrix.node }}
          cache: npm
      - run: npm ci
      - run: npm run lint
      - run: npm run typecheck
      - run: npm test
      - run: npm run build
`,
});

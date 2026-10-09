import { randomBytes } from "node:crypto";
import { authFiles } from "./auth.js";
import { CONFIG_FILE, LABEL, configJson, type Database, type ProjectOptions } from "./options.js";
import type { Files } from "./parts.js";
import { syntax, tidy, type Syntax } from "./syntax.js";

export interface ProjectInput extends ProjectOptions {
  name: string;
  coreSpec: string;
  cliSpec: string;
  /** Version range of @rheajs/auth. Used when auth is on. */
  authSpec?: string;
}

/** Third-party versions written into generated projects. Chosen for Node 20.19+ support (see docs/troubleshooting). */
const V = {
  nodemon: "^3.1.14",
  vitest: "~4.0.18",
  supertest: "^7.3.1",
  eslint: "^9.39.5",
  prettier: "^3.9.9",
  typescript: "~5.9.3",
  tsx: "^4.23.15",
  tseslint: "^8.71.1",
  globals: "^17.13.0",
  mongodb: "^7.7.0",
  mysql2: "^3.24.5",
};

/** Placeholder the generated vitest config uses so tests can import the env module. Never a real secret. */
const TEST_ONLY = "test-only-value-";

const dbName = (name: string): string => name.replace(/[^A-Za-z0-9_]/g, "_");

const localDatabaseUrl = (db: Database, name: string): string =>
  db === "mongodb" ? `mongodb://127.0.0.1:27017/${dbName(name)}` : `mysql://root:password@127.0.0.1:3306/${dbName(name)}`;
const exampleDatabaseUrl = (db: Database): string =>
  db === "mongodb" ? "mongodb://USER:PASSWORD@HOST:27017/DATABASE" : "mysql://USER:PASSWORD@HOST:3306/DATABASE";

function packageJson(i: ProjectInput, s: Syntax): string {
  const dependencies: Record<string, string> = { "@rheajs/core": i.coreSpec };
  if (i.auth) dependencies["@rheajs/auth"] = i.authSpec ?? i.coreSpec;
  if (i.database === "mongodb") dependencies["mongodb"] = V.mongodb;
  if (i.database === "mysql") dependencies["mysql2"] = V.mysql2;
  const dev: Record<string, string> = {
    "@eslint/js": V.eslint,
    "@rheajs/cli": i.cliSpec,
    "@vitest/coverage-v8": V.vitest,
    eslint: V.eslint,
    nodemon: V.nodemon,
    prettier: V.prettier,
    supertest: V.supertest,
    vitest: V.vitest,
  };
  if (s.ts)
    Object.assign(dev, { "@types/node": "^22.0.0", "@types/supertest": "^6.0.3", tsx: V.tsx, typescript: V.typescript, "typescript-eslint": V.tseslint });
  else dev["globals"] = V.globals;
  const sorted = (o: Record<string, string>) => Object.fromEntries(Object.entries(o).sort(([a], [b]) => a.localeCompare(b)));

  const entry = s.ts ? "dist/server.js" : "src/server.js";
  const scripts: Record<string, string> = {
    dev: "nodemon",
    ...(s.ts ? { build: "rhea build" } : {}),
    start: `node ${entry}`,
    "start:env": `node --env-file=.env ${entry}`,
    test: "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage",
    ...(s.ts ? { typecheck: "tsc --noEmit" } : {}),
    lint: "eslint .",
    "lint:fix": "eslint . --fix",
    format: "prettier --write .",
    doctor: "rhea doctor",
    security: "rhea security",
  };
  return (
    JSON.stringify(
      {
        name: i.name,
        version: "0.1.0",
        private: true,
        description: `${i.name}: a ${LABEL.language[i.language]} API built with Rhea.js`,
        type: i.module === "esm" ? "module" : "commonjs",
        main: entry,
        engines: { node: ">=20.19.0" },
        scripts,
        dependencies: sorted(dependencies),
        devDependencies: sorted(dev),
      },
      null,
      2,
    ) + "\n"
  );
}

const nodemonJson = (s: Syntax): string =>
  JSON.stringify(
    s.ts
      ? { watch: ["src", ".env"], ext: "ts,json", ignore: ["**/*.test.ts"], exec: "tsx --env-file=.env src/server.ts", signal: "SIGTERM", delay: 200 }
      : { watch: ["src", ".env"], ext: "js,mjs,cjs,json", ignore: ["**/*.test.js"], exec: "node --env-file=.env src/server.js", signal: "SIGTERM", delay: 200 },
    null,
    2,
  ) + "\n";

function tsconfigs(): Files {
  return {
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
  };
}

function eslintConfig(s: Syntax): string {
  if (s.ts)
    return `import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist", "coverage", "node_modules"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
);
`;
  return `import js from "@eslint/js";
import globals from "globals";

export default [
  { ignores: ["coverage", "node_modules"] },
  js.configs.recommended,
  { files: ["**/*.js"], languageOptions: { sourceType: "${s.o.module === "cjs" ? "commonjs" : "module"}", globals: { ...globals.node } } },
  { files: ["**/*.mjs"], languageOptions: { sourceType: "module", globals: { ...globals.node } } },
  { rules: { "no-unused-vars": ["error", { argsIgnorePattern: "^_" }] } },
];
`;
}

function vitestConfig(i: ProjectInput): string {
  const vars = [
    i.database === "none" ? "" : `DATABASE_URL: "${localDatabaseUrl(i.database, "test")}"`,
    i.auth ? `JWT_SECRET: "${TEST_ONLY.repeat(3)}"` : "",
  ].filter(Boolean);
  const env = vars.length ? `\n    env: { ${vars.join(", ")} },` : "";
  return `import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.{ts,js,mjs}"],${env}
    coverage: { provider: "v8", include: ["src/**"] },
  },
});
`;
}

function envFiles(i: ProjectInput): { env: string; example: string } {
  const authLocal = i.auth
    ? `\n# Signs access tokens. Generated for you. Use a different long random value in production.\nJWT_SECRET=${randomBytes(48).toString("base64url")}\n# JWT_EXPIRES_IN=15m\n`
    : "";
  const authExample = i.auth
    ? `\n# Signs access tokens. At least 32 characters. Generate one with: openssl rand -base64 48\nJWT_SECRET=\n# JWT_ISSUER=\n# JWT_AUDIENCE=\n# JWT_EXPIRES_IN=15m\n`
    : "";
  const common = (url: string, extra: string): string => `NODE_ENV=development
PORT=5000
# Comma-separated list of allowed browser origins. Empty disables CORS. Never use * in production.
CORS_ORIGIN=
# Number of reverse proxies in front of the app (0 = none). Needed for correct client IPs and rate limiting.
TRUST_PROXY=0
# LOG_LEVEL=info
${url}${extra}`;
  if (i.database === "none") {
    const c = common("", "");
    return { env: c, example: `# Copy to .env. Never commit real secrets.\n${c}` };
  }
  const extraLocal = i.database === "mysql" ? "MYSQL_ROOT_PASSWORD=password\n" : "";
  const extraExample = i.database === "mysql" ? "# Used by docker-compose.yml\nMYSQL_ROOT_PASSWORD=change-me\n" : "";
  return {
    env: common(`DATABASE_URL=${localDatabaseUrl(i.database, i.name)}\n`, extraLocal + authLocal),
    example: `# Copy to .env. Never commit real secrets.\n${common(`DATABASE_URL=${exampleDatabaseUrl(i.database)}\n`, extraExample + authExample)}`,
  };
}

function readme(i: ProjectInput, s: Syntax): string {
  const dbLine =
    i.database === "none"
      ? ""
      : `\n## Database (${LABEL.database[i.database]})\n\nSet \`DATABASE_URL\` in \`.env\`. The app connects before it starts listening and closes the connection on shutdown. \`GET /health/ready\` reports whether the database is reachable. The connection code is in \`src/config/database.${s.ext}\`.\n`;
  return `# ${i.name}

${LABEL.language[i.language]} + ${LABEL.module[i.module]}${i.database === "none" ? "" : ` + ${LABEL.database[i.database]}`} API built with [Rhea.js](https://rhea.devcodehub.cloud). Developed with Rhea.js by Shams Ali Shaikh.

## Run it

\`\`\`bash
npm install
npm run dev      # nodemon, restarts on file changes
\`\`\`

Open http://localhost:5000/api/rhea, your first API. Then:

\`\`\`bash
npm test                          # Vitest + Supertest
${s.ts ? "npm run build && npm start      # compile to dist/ and run with node" : "npm start                         # run with node"}
npx rhea generate module users    # controller, service, routes, schema, test
npx rhea doctor
npx rhea security
\`\`\`

## Scripts

| Script | What it does |
| --- | --- |
| \`npm run dev\` | nodemon with ${s.ts ? "tsx" : "node"}, loads \`.env\` |
| \`npm start\` | \`node ${s.ts ? "dist/server.js" : "src/server.js"}\` (no \`.env\` loading: set real environment variables) |
| \`npm run start:env\` | same, loading \`.env\` (handy locally) |
| \`npm test\` | run tests once |
${s.ts ? "| `npm run build` | type check and compile to `dist/` |\n| `npm run typecheck` | `tsc --noEmit` |\n" : ""}| \`npm run lint\` | ESLint |
| \`npm run format\` | Prettier |

## Endpoints

- \`GET /\` and \`GET /api/rhea\`: Rhea.js welcome and info
- \`GET /health\`: liveness
- \`GET /health/ready\`: readiness${i.database === "none" ? "" : " (checks the database)"}
${dbLine}
${i.auth ? `\n## Authentication\n\nUsers live in your ${LABEL.database[i.database]} database (\`users\`, created on start). Passwords are hashed with scrypt. Access tokens are short-lived JWTs signed with \`JWT_SECRET\`.\n\n- \`POST /api/auth/register\` with \`{ "email", "password" }\` (12+ characters)\n- \`POST /api/auth/login\` returns \`{ accessToken }\`\n- \`GET /api/auth/me\` with \`Authorization: Bearer <token>\`\n\nProtect your own routes with \`authenticate(jwt)\` and \`requireRole("admin")\` from \`@rheajs/auth\`. New users get the role \`user\`; grant \`admin\` yourself in the database. Register and login are rate limited per process: use a shared store when you run several instances. Read the authentication guide: https://rhea.devcodehub.cloud/docs/authentication/\n` : ""}
## Production

Set \`NODE_ENV=production\`, provide every variable from \`.env.example\` as a real environment variable, and run behind a reverse proxy with \`TRUST_PROXY=1\`. \`npx rhea docker\` writes a Dockerfile${i.database === "none" ? "" : " and a docker-compose.yml with a database"}.
`;
}

function databaseFile(i: ProjectInput, s: Syntax): string {
  const { t, imp, impType, exp } = s;
  if (i.database === "mongodb")
    return `${impType(["Logger"], "@rheajs/core")}
${imp(["MongoClient"], "mongodb")}
${impType(["Db"], "mongodb")}
${imp(["env"], s.rel("./env"))}

let client${t(": MongoClient | undefined")};

/** Connects before the server starts listening. Fails fast with a clear message if MongoDB is unreachable. */
async function connectDatabase(logger${t(": Logger")})${t(": Promise<void>")} {
  const c = new MongoClient(env.DATABASE_URL, { maxPoolSize: 10, serverSelectionTimeoutMS: 5000, appName: "rhea-app" });
  try {
    await c.connect();
    await c.db().command({ ping: 1 });
  } catch (err) {
    await c.close().catch(() => undefined);
    throw new Error("Could not connect to MongoDB. Check DATABASE_URL and that the server is running.", { cause: err });
  }
  client = c;
  logger.info({ database: c.db().databaseName }, "MongoDB connected");
}

/** The connected database. Use it in your repositories. */
function getDb()${t(": Db")} {
  if (!client) throw new Error("Database is not connected");
  return client.db();
}

async function pingDatabase()${t(": Promise<boolean>")} {
  try {
    await getDb().command({ ping: 1 });
    return true;
  } catch {
    return false;
  }
}

async function disconnectDatabase()${t(": Promise<void>")} {
  const c = client;
  client = undefined;
  if (c) await c.close();
}

${exp(["connectDatabase", "getDb", "pingDatabase", "disconnectDatabase"])}
`;
  return `${impType(["Logger"], "@rheajs/core")}
${imp(["createPool"], "mysql2/promise")}
${impType(["Pool"], "mysql2/promise")}
${imp(["env"], s.rel("./env"))}

let pool${t(": Pool | undefined")};

/** Connects before the server starts listening. Fails fast with a clear message if MySQL is unreachable. */
async function connectDatabase(logger${t(": Logger")})${t(": Promise<void>")} {
  const p = createPool({ uri: env.DATABASE_URL, connectionLimit: 10, waitForConnections: true, connectTimeout: 10_000, enableKeepAlive: true });
  try {
    await p.query("SELECT 1");
  } catch (err) {
    await p.end().catch(() => undefined);
    throw new Error("Could not connect to MySQL. Check DATABASE_URL and that the server is running.", { cause: err });
  }
  pool = p;
  logger.info("MySQL connected");
}

/** The connection pool. Use it in your repositories: await getPool().execute("SELECT ...", [params]). */
function getPool()${t(": Pool")} {
  if (!pool) throw new Error("Database is not connected");
  return pool;
}

async function pingDatabase()${t(": Promise<boolean>")} {
  try {
    await getPool().query("SELECT 1");
    return true;
  } catch {
    return false;
  }
}

async function disconnectDatabase()${t(": Promise<void>")} {
  const p = pool;
  pool = undefined;
  if (p) await p.end();
}

${exp(["connectDatabase", "getPool", "pingDatabase", "disconnectDatabase"])}
`;
}

function ciWorkflow(i: ProjectInput, s: Syntax): string {
  return (
    `name: CI
on:
  push:
    branches: [main]
  pull_request:
permissions:
  contents: read
jobs:
  test:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        node: [20, 22]
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: \${{ matrix.node }}
          cache: npm
      - run: npm ci
      - run: npm run lint
${s.ts ? "      - run: npm run typecheck\n" : ""}      - run: npm test
${s.ts ? "      - run: npm run build\n" : ""}`.replace(/\n+$/, "\n") + (i.name ? "" : "")
  );
}

export function projectFiles(i: ProjectInput): Files {
  const s = syntax(i);
  const { t, imp, rel, exp, impType } = s;
  const db = i.database !== "none";
  const { env, example } = envFiles(i);
  const E = s.ext;
  const T = s.testExt;
  const preamble = (body: string) => tidy(body);

  const files: Files = {
    "package.json": packageJson(i, s),
    [CONFIG_FILE]: configJson(i),
    "nodemon.json": nodemonJson(s),
    [s.ts ? "vitest.config.ts" : "vitest.config.mjs"]: vitestConfig(i),
    "eslint.config.mjs": eslintConfig(s),
    "prettier.config.mjs": `export default { printWidth: 100, singleQuote: false, trailingComma: "all" };\n`,
    ".env": env,
    ".env.example": example,
    ".gitignore": "node_modules\ndist\ncoverage\n.env\n.env.*\n!.env.example\n*.tsbuildinfo\n.DS_Store\n",
    ".gitattributes": "* text=auto eol=lf\n",
    "README.md": readme(i, s),
    ".github/workflows/ci.yml": ciWorkflow(i, s),
    ...(s.ts ? tsconfigs() : {}),

    [`src/config/env.${E}`]: preamble(`${imp(["baseEnvShape", "loadEnv", "z"], "@rheajs/core")}

// Validated at startup. If anything is missing or invalid the app prints every problem and exits.
const env = loadEnv({
  ...baseEnvShape,
  TRUST_PROXY: z.coerce.number().int().min(0).default(0),${
    i.database === "mongodb"
      ? `\n  DATABASE_URL: z.string().regex(/^mongodb(\\+srv)?:\\/\\//, "must start with mongodb:// or mongodb+srv://"),`
      : i.database === "mysql"
        ? `\n  DATABASE_URL: z.string().regex(/^mysql:\\/\\//, "must start with mysql://"),`
        : ""
  }${
    i.auth
      ? `
  JWT_SECRET: z.string().min(32, "must be at least 32 characters. Generate one with: openssl rand -base64 48"),
  JWT_ISSUER: z.string().min(1).default("${i.name}"),
  JWT_AUDIENCE: z.string().min(1).default("${i.name}-clients"),
  JWT_EXPIRES_IN: z.string().regex(/^\\d+[smhd]$/, "use a number and a unit, for example 15m or 1h").default("15m"),`
      : ""
  }
});

${exp(["env"])}
`),
    ...(db ? { [`src/config/database.${E}`]: tidy(databaseFile(i, s)) } : {}),

    [`src/app.${E}`]: preamble(`${imp(["createApp"], "@rheajs/core")}
${impType(["RheaApp"], "@rheajs/core")}
${imp(["env"], rel("./config/env"))}
${imp(["modules"], rel("./modules/index"))}
${db ? imp(["connectDatabase", "disconnectDatabase"], rel("./config/database")) : ""}
${i.auth ? imp(["ensureUserStore"], rel("./modules/auth/auth.repository")) : ""}

function buildApp()${t(": RheaApp")} {
  const app = createApp({
    env: env.NODE_ENV,
    logger: { level: env.LOG_LEVEL },
    cors: { origin: env.CORS_ORIGIN },
    trustProxy: env.TRUST_PROXY > 0 ? env.TRUST_PROXY : false,
  });
${
  db
    ? `
  // Connect before listening (startup fails clearly if the database is down) and close after the server stops.
  app.hook("beforeStart", async () => {
    await connectDatabase(app.logger);${i.auth ? "\n    await ensureUserStore();" : ""}
  });
  app.hook("afterShutdown", () => disconnectDatabase());
`
    : ""
}
  for (const m of modules) app.mount(m.path, m.router);
  return app;
}

${exp(["buildApp"])}
`),

    [`src/server.${E}`]: preamble(`${imp(["buildApp"], rel("./app"))}
${imp(["env"], rel("./config/env"))}

const app = buildApp();

app.start(env.PORT).then(
  () => {
    if (env.NODE_ENV === "production") return;
    const url = \`http://localhost:\${env.PORT}\`;
    console.log(\`\\n  Rhea.js  |  developed by Shams Ali Shaikh\\n\\n  Local:  \${url}\\n  Try:    \${url}/api/rhea\\n\`);
  },
  (err${t(": unknown")}) => {
    app.logger.fatal({ err }, "failed to start");
    process.exit(1);
  },
);
`),

    [`src/modules/index.${E}`]: preamble(`${impType(["Router"], "@rheajs/core")}
${imp(["healthRouter"], rel("./health/health.routes"))}
${imp(["rheaRouter", "welcomeRouter"], rel("./rhea/rhea.routes"))}
${i.auth ? imp(["authRouter"], rel("./auth/auth.routes")) : ""}
// rhea:imports

${s.ts ? "interface ModuleEntry {\n  path: string;\n  router: Router;\n}\n" : ""}
const modules${t(": ModuleEntry[]")} = [
  { path: "/", router: welcomeRouter },
  { path: "/api/rhea", router: rheaRouter },
  { path: "/health", router: healthRouter },${i.auth ? '\n  { path: "/api/auth", router: authRouter },' : ""}
  // rhea:modules
];

${exp(["modules"])}
`),

    [`src/modules/rhea/rhea.routes.${E}`]: preamble(`${imp(["Router", "sendSuccess"], "@rheajs/core")}
${imp(["env"], rel("../../config/env"))}

function info() {
  return {
    name: "Rhea.js",
    message: "Rhea.js is running. This is your first API.",
    developedBy: "Shams Ali Shaikh",
    environment: env.NODE_ENV,
    node: process.version,
    endpoints: { rhea: "/api/rhea", health: "/health", ready: "/health/ready" },
    docs: "https://rhea.devcodehub.cloud/docs/introduction/",
  };
}

const rheaRouter = Router();
rheaRouter.get("/", (_req, res) => sendSuccess(res, info(), "Hello from Rhea.js"));

const welcomeRouter = Router();
welcomeRouter.get("/", (_req, res) => sendSuccess(res, info(), "Welcome to Rhea.js"));

${exp(["rheaRouter", "welcomeRouter"])}
`),

    [`src/modules/health/health.routes.${E}`]: preamble(`${imp(db ? ["Router", "sendSuccess", "AppError"] : ["Router", "sendSuccess"], "@rheajs/core")}
${db ? imp(["pingDatabase"], rel("../../config/database")) : ""}

const healthRouter = Router();

// Liveness: the process is up.
healthRouter.get("/", (_req, res) => sendSuccess(res, { status: "ok", uptime: process.uptime() }));

// Readiness: dependencies are reachable. Point load balancer / orchestrator readiness probes here.
healthRouter.get("/ready", async (_req, res) => {
${db ? `  if (!(await pingDatabase())) throw new AppError(503, "NOT_READY", "Database is not reachable", { expose: true });\n  sendSuccess(res, { status: "ready", database: "up" });` : `  sendSuccess(res, { status: "ready" });`}
});

${exp(["healthRouter"])}
`),

    ...(i.auth ? authFiles(i) : {}),

    "src/middleware/.gitkeep": "",
    "src/utils/.gitkeep": "",
    "tests/unit/.gitkeep": "",
    "tests/e2e/.gitkeep": "",

    [`tests/integration/rhea.test.${T}`]: preamble(`${s.ts ? 'import type { RheaApp } from "@rheajs/core";' : ""}
import request from "supertest";
import { beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "../../src/app.js";

describe("Rhea.js first API", () => {
  let app${t(": RheaApp")};
  beforeAll(async () => {
    app = await buildApp().ready();
  });

  it("GET /api/rhea identifies the framework and its developer", async () => {
    const res = await request(app.express).get("/api/rhea");
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.name).toBe("Rhea.js");
    expect(res.body.data.developedBy).toBe("Shams Ali Shaikh");
  });

  it("GET / welcomes", async () => {
    const res = await request(app.express).get("/");
    expect(res.status).toBe(200);
    expect(res.body.message).toBe("Welcome to Rhea.js");
  });

  it("sends security headers and a request id, and hides the framework header", async () => {
    const res = await request(app.express).get("/api/rhea");
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
    expect(res.headers["x-request-id"]).toBeTruthy();
    expect(res.headers["x-powered-by"]).toBeUndefined();
  });

  it("returns the standard error shape for unknown routes", async () => {
    const res = await request(app.express).get("/nope");
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe("NOT_FOUND");
  });
});
`),

    [`tests/integration/health.test.${T}`]: preamble(`${s.ts ? 'import type { RheaApp } from "@rheajs/core";' : ""}
import request from "supertest";
import { beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "../../src/app.js";

describe("health", () => {
  let app${t(": RheaApp")};
  beforeAll(async () => {
    app = await buildApp().ready();
  });

  it("GET /health is alive", async () => {
    const res = await request(app.express).get("/health");
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe("ok");
  });

${
  db
    ? `  it("GET /health/ready is 503 until the database is connected", async () => {
    // Tests do not start the server, so no database connection exists.
    const res = await request(app.express).get("/health/ready");
    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe("NOT_READY");
  });`
    : `  it("GET /health/ready is ready", async () => {
    const res = await request(app.express).get("/health/ready");
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe("ready");
  });`
}
});
`),
  };
  return files;
}

import { CopyCommand } from "../components/CopyCommand";
import { Pipeline } from "../components/Pipeline";
import { Code, Section } from "../components/Section";
import { Terminal, capturedWith } from "../components/Terminal";
import { site } from "../site";

const features: [string, string][] = [
  ["Express 5 underneath", "Your existing Express middleware and knowledge still apply. app.express is the real Express app."],
  [
    "One error model",
    "Throw NotFoundError, ConflictError and friends from anywhere. Clients always get the same JSON shape and never an internal stack in production.",
  ],
  ["Validation with Zod", "validate() checks body, query and params and reports every problem at once."],
  ["Environment that fails loudly", "A missing or invalid variable stops startup with a list of what to fix."],
  ["Structured logs", "JSON in production, readable in development, secrets redacted, one line per request with a request ID."],
  ["Graceful shutdown", "SIGTERM and SIGINT stop accepting requests, finish in-flight ones, then run your shutdown hooks."],
  ["A CLI that writes the boring parts", "Scaffold a project, generate a module with tests, build, and check your setup."],
  ["Narrow plugin API", "Plugins get a small, stable surface instead of the whole framework."],
];

const roadmap: [string, string][] = [
  ["Done", "Core framework, CLI, project template, test suite with an end-to-end journey, documentation, this website"],
  ["Next", "Package publishing checks, repository and community files, first public alpha"],
  ["After the alpha", "Authentication plugin, database adapters (PostgreSQL, SQLite first), OpenAPI generation, queue and cache plugins, observability, OIDC"],
  ["Before 1.0", "Stable public API, mature docs, migration guides, independent security review, stable generated projects"],
];

export default function Home() {
  return (
    <>
      <a
        href="#main"
        className="absolute -left-[999px] focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-gold focus:px-3 focus:py-2 focus:text-[#0d1b2a]"
      >
        Skip to content
      </a>
      <header className="sticky top-0 z-40 border-b border-line bg-bg/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-5 px-4 py-3 md:px-6">
          <a href="#main" className="text-lg font-semibold tracking-tight">
            {site.name}
          </a>
          <nav aria-label="Primary" className="ml-auto flex gap-4 text-sm text-slate">
            <a href="#why" className="hidden hover:text-ink sm:inline">
              Why
            </a>
            <a href="#cli" className="hidden hover:text-ink sm:inline">
              CLI
            </a>
            <a href="#security" className="hidden hover:text-ink sm:inline">
              Security
            </a>
            <a href="#roadmap" className="hidden hover:text-ink sm:inline">
              Roadmap
            </a>
            <a href="docs/introduction.html" className="font-medium text-ink">
              Docs
            </a>
          </nav>
        </div>
      </header>

      <main id="main">
        <div className="mx-auto grid max-w-6xl grid-cols-[minmax(0,1fr)] gap-10 px-4 pt-12 pb-16 md:px-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-12 lg:pt-20">
          <div>
            <p className="mb-4 inline-block rounded border border-line bg-panel px-2.5 py-1 text-sm text-slate">
              Alpha {site.version}. Not production-ready yet.
            </p>
            <h1 className="text-[2.6rem] leading-[1.04] font-semibold tracking-tight sm:text-5xl lg:text-[3.4rem]">{site.headline}</h1>
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-slate">{site.statement}</p>
            <div className="mt-7 flex flex-wrap items-center gap-3">
              <a href="docs/quick-start.html" className="rounded-md bg-gold px-5 py-2.5 font-semibold text-[#0d1b2a] hover:brightness-95">
                Get started
              </a>
              {site.repoUrl ? (
                <a href={site.repoUrl} className="rounded-md border border-ink px-5 py-2.5 font-semibold hover:bg-ink hover:text-bg">
                  View GitHub
                </a>
              ) : (
                <span aria-disabled="true" className="rounded-md border border-dashed border-line px-5 py-2.5 text-slate">
                  GitHub: not public yet
                </span>
              )}
            </div>
            <div className="mt-6">
              <CopyCommand command={site.installCommand} />
              <p className="mt-2 max-w-md text-sm text-slate">
                The packages are not on npm yet. Until the first alpha is published, build from source as described in the installation guide.
              </p>
            </div>
          </div>
          <div className="min-w-0">
            <p className="mb-2 text-sm text-slate">Pick a request. The responses below come from a real Rhea.js server running in production mode.</p>
            <Pipeline />
          </div>
        </div>

        <Section id="why" title="Why Rhea.js">
          <p>
            Express gives you the HTTP layer and leaves everything else to you. Most teams end up wiring the same things in every project: security headers,
            CORS rules, rate limiting, body limits, request IDs, logging that does not leak secrets, validation, an error handler that hides internals, and a
            folder layout nobody agreed on.
          </p>
          <p>
            Rhea.js makes those decisions once and ships them as defaults. Express stays underneath, so what you know and what you have already written still
            works.
          </p>
          <Code label="A complete app">{`import { createApp, Router, sendSuccess } from "@rheajs/core";

const app = createApp({ cors: { origin: ["https://app.example.com"] } });

app.mount("/hello", Router().get("/", (_req, res) => sendSuccess(res, { hi: "rhea" })));

await app.start(5000);`}</Code>
          <p>That one call sets up everything in the pipeline above. Express can do all of it by hand. Rhea.js is about not having to.</p>
        </Section>

        <Section id="features" title="What is included">
          <dl className="space-y-5">
            {features.map(([term, desc]) => (
              <div key={term}>
                <dt className="font-semibold">{term}</dt>
                <dd className="text-slate">{desc}</dd>
              </div>
            ))}
          </dl>
        </Section>

        <Section id="architecture" title="Architecture">
          <p>
            A project is organised by feature. Each module holds its controller, service, repository, routes, schema and types together, so code that changes
            together stays together.
          </p>
          <Code label="Generated project structure">{`my-api/
├── src/
│   ├── config/env.ts        validated environment
│   ├── modules/
│   │   ├── index.ts         module registry
│   │   ├── health/
│   │   └── users/           generated by: rhea generate module users
│   │       ├── users.controller.ts
│   │       ├── users.service.ts
│   │       ├── users.repository.ts
│   │       ├── users.routes.ts
│   │       ├── users.schema.ts
│   │       └── users.types.ts
│   ├── middleware/  core/  utils/  types/
│   ├── app.ts               buildApp()
│   └── server.ts
├── tests/{unit,integration,e2e}/
└── .env  .env.example  tsconfig*.json  vitest.config.ts`}</Code>
          <p>The app moves through a fixed lifecycle, and you can hook into any step:</p>
          <ol className="list-decimal space-y-1 pl-6 text-slate">
            {["beforeInit", "init", "afterInit", "beforeStart", "afterStart", "beforeShutdown", "afterShutdown"].map((h) => (
              <li key={h}>
                <code className="text-ink">{h}</code>
              </li>
            ))}
          </ol>
        </Section>

        <Section id="cli" title="Command line">
          <p>
            <code>rhea</code> creates, runs, builds, tests and checks your project. Commands: <code>create</code>, <code>dev</code>, <code>build</code>,{" "}
            <code>start</code>, <code>generate</code>, <code>test</code>, <code>doctor</code>, <code>security</code>, <code>docker</code>, <code>info</code>.
          </p>
          <Terminal />
          <p className="text-sm text-slate">{capturedWith()}</p>
        </Section>

        <Section id="security" title="Security">
          <p>Defaults aim to prevent common mistakes. They are not a guarantee, and Rhea.js has not had an independent security review.</p>
          <div className="grid gap-6 sm:grid-cols-2">
            <div>
              <h3 className="mb-2 font-semibold">On by default</h3>
              <ul className="list-disc space-y-1 pl-5 text-slate">
                <li>Helmet security headers</li>
                <li>CORS off until you list origins; wildcard refused in production</li>
                <li>Rate limit, body size limit, request timeout</li>
                <li>Prototype-pollution payloads rejected</li>
                <li>No stack traces or internal messages in production</li>
                <li>Secrets redacted from logs</li>
                <li>Startup aborts on invalid configuration</li>
              </ul>
            </div>
            <div>
              <h3 className="mb-2 font-semibold">Not included</h3>
              <ul className="list-disc space-y-1 pl-5 text-slate">
                <li>Authentication and authorization</li>
                <li>A shared rate-limit store: counters live in each process</li>
                <li>Protection for routes where you skip validate()</li>
                <li>An independent audit</li>
              </ul>
            </div>
          </div>
          <p>
            <code>rhea security</code> runs static checks on your project. It is not a penetration test. Read the{" "}
            <a href="docs/security.html">security guide</a>.
          </p>
        </Section>

        <Section id="examples" title="Code examples">
          <p>Validate input and throw typed errors:</p>
          <Code label="Route with validation">{`import { Router, sendSuccess, validate, z, NotFoundError } from "@rheajs/core";

const createUser = z.object({ email: z.email() });

export const users = Router();

users.post("/", validate(createUser), (req, res) => sendSuccess(res, req.body, "Created", 201));

users.get("/:id", () => {
  throw new NotFoundError("User not found", { code: "USER_NOT_FOUND" });
});`}</Code>
          <p>Validate the environment so a bad deployment fails at startup:</p>
          <Code label="Environment validation">{`import { baseEnvShape, loadEnv, z } from "@rheajs/core";

export const env = loadEnv({ ...baseEnvShape, DATABASE_URL: z.string().url() });`}</Code>
        </Section>

        <Section id="plugins" title="Plugins">
          <p>
            A plugin receives a small context: a logger, <code>addMiddleware</code>, <code>mount</code> and <code>onHook</code>. It never touches framework
            internals, so the API can grow without breaking plugins. The plugin API is alpha and may change.
          </p>
          <Code label="A plugin">{`import { Router, type Plugin } from "@rheajs/core";

export const stats: Plugin = {
  name: "stats",
  setup(ctx) {
    let hits = 0;
    ctx.addMiddleware((_req, _res, next) => { hits++; next(); });
    ctx.mount("/stats", Router().get("/", (_req, res) => void res.json({ hits })));
  },
};`}</Code>
        </Section>

        <Section id="testing" title="Testing">
          <p>
            Generated projects use Vitest and Supertest. <code>rhea generate module</code> adds an integration test. The framework&apos;s own test suite
            includes an end-to-end run that scaffolds a project, installs it, builds it, starts it, checks real HTTP responses and confirms graceful shutdown.
          </p>
          <Code label="An integration test">{`const app = await buildApp().ready();
const res = await request(app.express).get("/health");
expect(res.status).toBe(200);`}</Code>
        </Section>

        <Section id="deployment" title="Production deployment">
          <p>
            <code>rhea docker</code> writes a multi-stage Dockerfile that installs production dependencies only and runs as a non-root user. It was built and
            run once on Linux: the image served requests and exited cleanly on <code>docker stop</code>. Other platforms are untested. The{" "}
            <a href="docs/deployment.html">deployment guide</a> has the full checklist, including proxy settings that affect rate limiting.
          </p>
        </Section>

        <Section id="documentation" title="Documentation">
          <p>
            24 pages covering installation, every part of the framework, security, Docker and troubleshooting. Code examples in the docs are type-checked
            against the real build by the test suite. <a href="docs/introduction.html">Read the docs</a>.
          </p>
        </Section>

        <Section id="project" title="GitHub, npm and community">
          <p>None of these exist yet, and this page will not link to anything that does not.</p>
          <ul className="list-disc space-y-1 pl-5 text-slate">
            <li>
              <span className="text-ink">GitHub:</span>{" "}
              {site.repoUrl ? <a href={site.repoUrl}>{site.repoUrl}</a> : "not public yet. The source is currently private."}
            </li>
            <li>
              <span className="text-ink">npm:</span> {site.npmUrl ? <a href={site.npmUrl}>{site.npmUrl}</a> : "not published yet."}
            </li>
            <li>
              <span className="text-ink">Community:</span> issues and discussions will open with the public repository. There is no chat server.
            </li>
          </ul>
        </Section>

        <Section id="roadmap" title="Roadmap">
          <dl className="space-y-5">
            {roadmap.map(([term, desc]) => (
              <div key={term}>
                <dt className="font-semibold">{term}</dt>
                <dd className="text-slate">{desc}</dd>
              </div>
            ))}
          </dl>
          <p className="text-sm text-slate">No dates are promised. Version 1.0 waits until the items above are true.</p>
        </Section>
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto max-w-6xl px-4 py-8 text-sm text-slate md:px-6">
          {site.name} {site.version}. Made by {site.author}. MIT licensed. Alpha software.
        </div>
      </footer>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "SoftwareSourceCode",
            name: site.name,
            description: site.description,
            programmingLanguage: "TypeScript",
            license: "https://opensource.org/licenses/MIT",
            author: { "@type": "Person", name: site.author },
          }),
        }}
      />
    </>
  );
}

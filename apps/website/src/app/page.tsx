import fixtures from "../data/fixtures.json";
import { CopyCommand } from "../components/CopyCommand";
import { Pipeline } from "../components/Pipeline";
import { Code, Section } from "../components/Section";
import { Terminal, capturedWith } from "../components/Terminal";
import { Footer, Header } from "../components/SiteChrome";
import { site } from "../site";

const features: [string, string][] = [
  [
    "Your stack, your choice",
    "TypeScript or JavaScript, ES Modules or CommonJS, and MongoDB, MySQL or no database. Pooled connections, a readiness endpoint and clean shutdown come generated.",
  ],
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

const onByDefault = [
  "Helmet security headers",
  "CORS off until you list origins; wildcard refused in production",
  "Rate limit, body size limit, request timeout",
  "Prototype-pollution payloads rejected",
  "No stack traces or internal messages in production",
  "Secrets redacted from logs",
  "Startup aborts on invalid configuration",
];
const notIncluded = [
  "Authentication and authorization",
  "A shared rate-limit store: counters live in each process",
  "Protection for routes where you skip validate()",
  "An independent audit",
];

const stackChoices: [string, string, string[]][] = [
  ["Language", "--ts  --js", ["TypeScript", "JavaScript"]],
  ["Modules", "--esm  --cjs", ["ES Modules", "CommonJS"]],
  ["Database", "--db none|mongodb|mysql", ["None", "MongoDB", "MySQL"]],
  ["Authentication", "--auth  (needs a database)", ["Register and login", "JWT tokens", "Role guards"]],
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
      <Header />

      <main id="main">
        <div className="relative overflow-hidden border-b border-line">
          <div className="grid-bg absolute inset-0" aria-hidden="true" />
          <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-4 pt-14 pb-16 md:px-6 md:pt-20 md:pb-24 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)] lg:gap-10">
            <div>
              <p className="mb-6 inline-block rounded-full border border-line bg-bg px-3.5 py-1 text-sm text-slate">
                Alpha {site.version}. Not production-ready yet.
              </p>
              <h1 className="text-[clamp(2.2rem,5vw,3.7rem)] leading-[1.03] font-bold tracking-[-0.035em] text-balance">{site.headline}</h1>
              <p className="mt-6 max-w-xl text-lg leading-relaxed text-slate">{site.statement}</p>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <a href="/docs/quick-start/" className="rounded-lg bg-ink px-6 py-3 font-semibold text-bg hover:opacity-85">
                  Get started
                </a>
                {site.repoUrl ? (
                  <a href={site.repoUrl} className="rounded-lg border border-line bg-bg px-6 py-3 font-semibold hover:border-ink">
                    View GitHub
                  </a>
                ) : (
                  <span aria-disabled="true" className="rounded-lg border border-dashed border-line px-6 py-3 text-slate">
                    GitHub: not public yet
                  </span>
                )}
              </div>
              <p className="mt-8 text-sm text-slate">Built on</p>
              <ul className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-[0.95rem] font-semibold">
                {["Express 5", "TypeScript", "Zod", "Helmet", "pino"].map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
            </div>

            <div className="min-w-0 rounded-2xl border border-line bg-code shadow-[0_30px_80px_-30px_rgba(0,0,0,0.45)]">
              <div className="flex items-center justify-between border-b border-white/10 px-4 py-2.5 text-xs text-code-ink/60">
                <span>Terminal</span>
                <span>{site.version}</span>
              </div>
              <div className="border-b border-white/10 p-4">
                <CopyCommand command={site.installCommand} />
              </div>
              <pre className="overflow-x-auto p-5 text-[13px] leading-relaxed whitespace-pre-wrap text-code-ink/85">{fixtures.cli[0]!.output}</pre>
            </div>
          </div>
        </div>

        <section id="demo" aria-labelledby="demo-h" className="mx-auto max-w-6xl px-4 py-16 md:px-6 md:py-24">
          <div className="mb-8 max-w-3xl">
            <h2 id="demo-h" className="text-[clamp(1.85rem,4.4vw,3rem)] leading-[1.08] font-bold tracking-tight text-balance">
              Watch a request go through the pipeline
            </h2>
            <p className="mt-4 text-lg leading-relaxed text-slate">Pick a request. The responses come from a real Rhea.js server running in production mode.</p>
          </div>
          <Pipeline />
        </section>

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

        <Section id="features" title="What is included" lead="Everything a team ends up wiring by hand, decided once.">
          <dl className="grid gap-px overflow-hidden rounded-2xl border border-line bg-line sm:grid-cols-2 lg:grid-cols-3">
            {features.map(([term, desc]) => (
              <div key={term} className="bg-panel p-6">
                <dt className="font-bold tracking-tight">{term}</dt>
                <dd className="mt-2 text-[0.95rem] leading-relaxed text-slate">{desc}</dd>
              </div>
            ))}
          </dl>
        </Section>

        <Section id="stack" title="Choose your stack" lead="npx create-rhea my-api asks a few questions, then writes a project that matches your answers.">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {stackChoices.map(([q, flags, opts]) => (
              <div key={q} className="rounded-2xl border border-line bg-panel p-6">
                <h3 className="text-lg font-bold tracking-tight">{q}</h3>
                <p className="mt-1 font-mono text-xs text-slate">{flags}</p>
                <ul className="mt-5 flex flex-wrap gap-2">
                  {opts.map((o) => (
                    <li key={o} className="rounded-full border border-line bg-bg px-3 py-1 text-sm">
                      {o}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <p className="text-slate">
            Use the arrow keys and Enter, or pass flags to skip the questions. Your first API is already at <code>/api/rhea</code>, and <code>npm run dev</code>{" "}
            restarts gracefully on every change through nodemon.
          </p>
        </Section>

        <Section id="architecture" title="Architecture">
          <p>
            A project is organised by feature. Each module holds its controller, service, repository, routes, schema and types together, so code that changes
            together stays together.
          </p>
          <Code label="Generated project structure">{`my-api/
├── src/
│   ├── config/
│   │   ├── env.ts           validated environment
│   │   └── database.ts      only if you chose MongoDB or MySQL
│   ├── modules/
│   │   ├── index.ts         module registry
│   │   ├── rhea/            your first API: GET /api/rhea
│   │   ├── health/          GET /health and /health/ready
│   │   └── users/           generated by: rhea generate module users
│   │       ├── users.controller.ts
│   │       ├── users.service.ts
│   │       ├── users.repository.ts
│   │       ├── users.routes.ts
│   │       ├── users.schema.ts
│   │       └── users.types.ts
│   ├── middleware/  utils/
│   ├── app.ts               buildApp()
│   └── server.ts
├── tests/{unit,integration,e2e}/
└── .env  .env.example  nodemon.json  rhea.config.json  vitest.config.ts`}</Code>
          <p>
            JavaScript projects use the same layout with <code>.js</code> files and no <code>tsconfig</code>.
          </p>
          <p>The app moves through a fixed lifecycle, and you can hook into any step:</p>
          <ol className="list-decimal space-y-1 pl-6 text-slate">
            {["beforeInit", "init", "afterInit", "beforeStart", "afterStart", "beforeShutdown", "afterShutdown"].map((h) => (
              <li key={h}>
                <code className="text-ink">{h}</code>
              </li>
            ))}
          </ol>
        </Section>

        <Section id="cli" title="Command line" tone="inverse" lead="rhea creates, runs, builds, tests and checks your project.">
          <p>
            Commands: <code>create</code>, <code>dev</code>, <code>build</code>, <code>start</code>, <code>generate</code>, <code>test</code>,{" "}
            <code>doctor</code>, <code>security</code>, <code>docker</code>, <code>info</code>.
          </p>
          <Terminal />
          <p className="text-sm text-code-ink/60">{capturedWith()} Captured with the default choices (TypeScript, ES Modules, no database).</p>
        </Section>

        <Section id="security" title="Security">
          <p>Defaults aim to prevent common mistakes. They are not a guarantee, and Rhea.js has not had an independent security review.</p>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-line bg-panel p-6">
              <h3 className="mb-4 text-lg font-bold tracking-tight text-pass">On by default</h3>
              <ul className="space-y-2.5">
                {onByDefault.map((t) => (
                  <li key={t} className="flex gap-3">
                    <span aria-hidden="true" className="mt-0.5 font-bold text-pass">
                      +
                    </span>
                    {t}
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-2xl border border-line bg-panel p-6">
              <h3 className="mb-4 text-lg font-bold tracking-tight text-block">Not included</h3>
              <ul className="space-y-2.5">
                {notIncluded.map((t) => (
                  <li key={t} className="flex gap-3">
                    <span aria-hidden="true" className="mt-0.5 font-bold text-block">
                      &minus;
                    </span>
                    {t}
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <p>
            <code>rhea security</code> runs static checks on your project. It is not a penetration test. Read the <a href="/docs/security/">security guide</a>.
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
            <a href="/docs/deployment/">deployment guide</a> has the full checklist, including proxy settings that affect rate limiting.
          </p>
        </Section>

        <Section id="documentation" title="Documentation">
          <p>
            24 pages covering installation, every part of the framework, security, Docker and troubleshooting. Code examples in the docs are type-checked
            against the real build by the test suite. <a href="/docs/introduction/">Read the docs</a>.
          </p>
        </Section>

        <Section id="project" title="GitHub, npm and community">
          <p>The project is public. Everything below is real and links to where it lives.</p>
          <ul className="list-disc space-y-1 pl-5 text-slate">
            <li>
              <span className="text-ink">GitHub:</span> {site.repoUrl ? <a href={site.repoUrl}>{site.repoUrl}</a> : "not public yet."}
            </li>
            <li>
              <span className="text-ink">npm:</span> {site.npmUrl ? <a href={site.npmUrl}>{site.npmUrl}</a> : "not published yet."}
            </li>
            <li>
              <span className="text-ink">Community:</span>{" "}
              {site.repoUrl ? (
                <>
                  <a href={`${site.repoUrl}/issues`}>Issues</a> and <a href={`${site.repoUrl}/discussions`}>Discussions</a> on GitHub.
                </>
              ) : (
                "not open yet."
              )}{" "}
              There is no chat server.
            </li>
          </ul>
        </Section>

        <Section id="roadmap" title="Roadmap">
          <ol className="grid gap-4 md:grid-cols-4">
            {roadmap.map(([term, desc], i) => (
              <li key={term} className={`rounded-2xl border p-6 ${i === 0 ? "border-pass/50 bg-pass/5" : "border-line bg-panel"}`}>
                <h3 className="font-bold tracking-tight">{term}</h3>
                <p className="mt-2 text-[0.95rem] leading-relaxed text-slate">{desc}</p>
              </li>
            ))}
          </ol>
          <p className="text-sm text-slate">No dates are promised. Version 1.0 waits until the items above are true.</p>
        </Section>
      </main>

      <Footer />

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

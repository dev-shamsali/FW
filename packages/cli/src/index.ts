import { CliError, c, err, out } from "./ui.js";
import { VERSION } from "./version.js";

export { VERSION };

const HELP = `${c.bold("Rhea.js")} ${VERSION} ${c.dim("— made by Shams Ali Shaikh")}

Usage: rhea <command> [options]

Commands:
  create <name>              Scaffold a new project (--install, --core-spec, --cli-spec)
  dev                        Run with watch mode
  build                      Type check and compile to dist/
  start                      Run the production build (--env-file <path>)
  generate <kind> <name>     module | controller | service | route | middleware | validator
  test [vitest args]         Run tests (e.g. --coverage)
  doctor                     Check environment and project health
  security                   Static security scan (--audit, --strict)
  docker                     Generate Dockerfile, .dockerignore, docker-compose.yml
  info                       Show versions and platform
`;

const commands: Record<string, (argv: string[]) => Promise<number>> = {
  create: async (a) => (await import("./commands/create.js")).create(a),
  dev: async () => (await import("./commands/run.js")).dev(),
  build: async () => (await import("./commands/run.js")).build(),
  start: async (a) => (await import("./commands/run.js")).start(a),
  test: async (a) => (await import("./commands/run.js")).test(a),
  generate: async (a) => (await import("./commands/generate.js")).generate(a),
  g: async (a) => (await import("./commands/generate.js")).generate(a),
  doctor: async () => (await import("./commands/doctor.js")).doctor(),
  security: async (a) => (await import("./commands/security.js")).security(a),
  docker: async (a) => (await import("./commands/docker.js")).docker(a),
  info: async () => (await import("./commands/info.js")).info(),
};

/** Runs the CLI and returns the exit code. Commands are lazy-loaded to keep startup fast. */
export async function run(argv: string[]): Promise<number> {
  const [cmd, ...rest] = argv;
  if (!cmd || cmd === "help" || cmd === "--help" || cmd === "-h") {
    out(HELP);
    return 0;
  }
  if (cmd === "--version" || cmd === "-v") {
    out(VERSION);
    return 0;
  }
  const handler = commands[cmd];
  if (!handler) {
    err(`Unknown command "${cmd}".\n`);
    err(HELP);
    return 2;
  }
  try {
    return await handler(rest);
  } catch (e) {
    if (e instanceof CliError) {
      err(`${c.red("error")} ${e.message}`);
      return e.exitCode;
    }
    err(`${c.red("error")} Unexpected failure: ${e instanceof Error ? e.message : String(e)}`);
    return 1;
  }
}

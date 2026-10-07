export interface Parsed {
  positionals: string[];
  flags: Record<string, string | boolean>;
}

/** Minimal argv parser: --flag, --key=value, and --key value for keys listed in `strings`. */
export function parseArgs(argv: string[], strings: string[] = []): Parsed {
  const positionals: string[] = [];
  const flags: Record<string, string | boolean> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (a === "--") {
      positionals.push(...argv.slice(i + 1));
      break;
    }
    if (!a.startsWith("--")) {
      positionals.push(a);
      continue;
    }
    const eq = a.indexOf("=");
    if (eq !== -1) flags[a.slice(2, eq)] = a.slice(eq + 1);
    else if (strings.includes(a.slice(2)) && i + 1 < argv.length) flags[a.slice(2)] = argv[++i]!;
    else flags[a.slice(2)] = true;
  }
  return { positionals, flags };
}

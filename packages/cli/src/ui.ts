const useColor = !process.env["NO_COLOR"] && (process.stdout.isTTY || process.env["FORCE_COLOR"] !== undefined);
const wrap = (open: number, close: number) => (s: string) => (useColor ? `\x1b[${open}m${s}\x1b[${close}m` : s);
export const c = { bold: wrap(1, 22), dim: wrap(2, 22), red: wrap(31, 39), green: wrap(32, 39), yellow: wrap(33, 39), cyan: wrap(36, 39) };

export const out = (s = "") => void process.stdout.write(s + "\n");
export const err = (s = "") => void process.stderr.write(s + "\n");
export const ok = (s: string) => out(`${c.green("✓")} ${s}`);
export const warn = (s: string) => out(`${c.yellow("⚠")} ${s}`);
export const fail = (s: string) => out(`${c.red("✗")} ${s}`);

/** Error with a user-facing message and an exit code. Never prints a stack. */
export class CliError extends Error {
  constructor(
    message: string,
    readonly exitCode = 1,
  ) {
    super(message);
  }
}

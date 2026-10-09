import { emitKeypressEvents } from "node:readline";
import { createInterface } from "node:readline/promises";
import { CliError, c } from "./ui.js";

export interface Choice<T extends string> {
  value: T;
  label: string;
  hint?: string;
}

export const interactive = (): boolean => Boolean(process.stdin.isTTY && process.stdout.isTTY);

/** Arrow-key (or number-key) single choice. Falls back to `initial` when not interactive. */
export async function select<T extends string>(message: string, choices: Choice<T>[], initial = 0): Promise<T> {
  if (!interactive()) return choices[initial]!.value;
  const out = process.stdout;
  let index = initial;
  const render = (first: boolean) => {
    if (!first) out.write(`\x1b[${choices.length}A`);
    for (const [i, ch] of choices.entries()) {
      const on = i === index;
      out.write(`\x1b[2K${on ? c.cyan("❯") : " "} ${on ? c.bold(ch.label) : ch.label}${ch.hint ? c.dim(`  ${ch.hint}`) : ""}\n`);
    }
  };
  out.write(`${c.bold("?")} ${message} ${c.dim("(use arrow keys, Enter to select)")}\n`);
  render(true);
  emitKeypressEvents(process.stdin);
  process.stdin.setRawMode(true);
  process.stdin.resume();
  return new Promise<T>((resolve) => {
    const done = (v: T) => {
      process.stdin.off("keypress", onKey);
      process.stdin.setRawMode(false);
      process.stdin.pause();
      out.write(`\x1b[${choices.length + 1}A\x1b[0J${c.green("✓")} ${message} ${c.cyan(choices.find((x) => x.value === v)!.label)}\n`);
      resolve(v);
    };
    const onKey = (_: string, key: { name?: string; ctrl?: boolean; sequence?: string }) => {
      if (key.ctrl && key.name === "c") {
        process.stdin.setRawMode(false);
        out.write("\n");
        process.exit(130);
      }
      if (key.name === "up" || key.name === "k") index = (index + choices.length - 1) % choices.length;
      else if (key.name === "down" || key.name === "j") index = (index + 1) % choices.length;
      else if (key.sequence && /^[1-9]$/.test(key.sequence) && Number(key.sequence) <= choices.length) index = Number(key.sequence) - 1;
      else if (key.name === "return") return done(choices[index]!.value);
      else return;
      render(false);
    };
    process.stdin.on("keypress", onKey);
  });
}

export async function confirm(message: string, initial = true): Promise<boolean> {
  const v = await select<"yes" | "no">(
    message,
    [
      { value: "yes", label: "Yes" },
      { value: "no", label: "No" },
    ],
    initial ? 0 : 1,
  );
  return v === "yes";
}

export async function text(message: string, initial: string): Promise<string> {
  if (!interactive()) return initial;
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const answer = (await rl.question(`${c.bold("?")} ${message} ${c.dim(`(${initial})`)} `)).trim();
    return answer || initial;
  } catch {
    throw new CliError("Cancelled.", 130);
  } finally {
    rl.close();
  }
}

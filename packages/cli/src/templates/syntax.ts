import type { ProjectOptions } from "./options.js";

/**
 * Helpers that let one template produce TypeScript, JavaScript (ESM) and JavaScript (CommonJS).
 * TypeScript always uses import/export syntax (tsc emits CommonJS or ESM depending on package.json "type").
 */
export interface Syntax {
  o: ProjectOptions;
  ts: boolean;
  /** Source file extension: "ts" | "js" */
  ext: "ts" | "js";
  /** Test file extension. CommonJS JavaScript projects write tests as ES modules (.mjs). */
  testExt: "ts" | "js" | "mjs";
  /** True when the file uses `require`/`module.exports`. */
  cjsSyntax: boolean;
  /** Type annotation text. Empty in JavaScript. */
  t(annotation: string): string;
  /** Relative import specifier. `.js` suffix for TypeScript and ESM, none for CommonJS. */
  rel(path: string): string;
  imp(names: string[], from: string): string;
  impDefault(name: string, from: string): string;
  /** Type-only import. Empty in JavaScript. */
  impType(names: string[], from: string): string;
  exp(names: string[]): string;
  /** Joins non-empty lines. */
  lines(...l: (string | false | undefined)[]): string;
}

export function syntax(o: ProjectOptions): Syntax {
  const ts = o.language === "ts";
  const cjsSyntax = !ts && o.module === "cjs";
  return {
    o,
    ts,
    ext: ts ? "ts" : "js",
    testExt: ts ? "ts" : o.module === "cjs" ? "mjs" : "js",
    cjsSyntax,
    t: (a) => (ts ? a : ""),
    rel: (p) => (cjsSyntax ? p : `${p}.js`),
    imp: (names, from) => (cjsSyntax ? `const { ${names.join(", ")} } = require("${from}");` : `import { ${names.join(", ")} } from "${from}";`),
    impDefault: (name, from) => (cjsSyntax ? `const ${name} = require("${from}");` : `import ${name} from "${from}";`),
    impType: (names, from) => (ts ? `import type { ${names.join(", ")} } from "${from}";` : ""),
    exp: (names) => (cjsSyntax ? `module.exports = { ${names.join(", ")} };` : `export { ${names.join(", ")} };`),
    lines: (...l) => l.filter((x): x is string => typeof x === "string" && x !== "").join("\n"),
  };
}

/** Collapses 3+ newlines to 2 and guarantees a trailing newline, so conditional template pieces never leave gaps. */
export const tidy = (s: string): string =>
  s
    .replace(/\n{3,}/g, "\n\n")
    .replace(/^\n+/, "")
    .replace(/\s+$/, "") + "\n";

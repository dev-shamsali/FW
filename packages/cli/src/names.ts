import { CliError } from "./ui.js";

export interface Names {
  /** users */
  kebab: string;
  /** Users */
  pascal: string;
  /** users */
  camel: string;
  /** User */
  singularPascal: string;
  /** user */
  singularCamel: string;
  /** USER */
  singularUpper: string;
}

const VALID = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;

function singular(s: string): string {
  if (s.endsWith("ies") && s.length > 3) return s.slice(0, -3) + "y";
  if (s.endsWith("ss")) return s;
  if (s.endsWith("s") && s.length > 1) return s.slice(0, -1);
  return s;
}
const pascal = (k: string) => k.split("-").map((p) => p[0]!.toUpperCase() + p.slice(1)).join("");
const camel = (k: string) => {
  const p = pascal(k);
  return p[0]!.toLowerCase() + p.slice(1);
};

/** Validates a resource name. Only lowercase letters, digits and hyphens: no path separators, so no traversal. */
export function parseName(raw: string | undefined): Names {
  if (!raw) throw new CliError("Missing name. Example: rhea generate module users", 2);
  const kebab = raw.toLowerCase();
  if (!VALID.test(kebab)) throw new CliError(`Invalid name "${raw}". Use lowercase letters, digits and hyphens, starting with a letter.`, 2);
  const s = singular(kebab);
  return { kebab, pascal: pascal(kebab), camel: camel(kebab), singularPascal: pascal(s), singularCamel: camel(s), singularUpper: s.toUpperCase().replaceAll("-", "_") };
}

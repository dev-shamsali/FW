import { z, type ZodObject, type ZodRawShape } from "zod";

export class EnvValidationError extends Error {
  constructor(
    readonly missing: string[],
    readonly invalid: { key: string; message: string }[],
  ) {
    super("Rhea.js Environment Validation Failed");
    this.name = "EnvValidationError";
  }

  format(): string {
    const lines = ["Rhea.js Environment Validation Failed", ""];
    if (this.missing.length) lines.push("Missing:", ...this.missing.map((k) => `- ${k}`), "");
    if (this.invalid.length) lines.push("Invalid:", ...this.invalid.map((i) => `- ${i.key}: ${i.message}`), "");
    lines.push("Application startup aborted.");
    return lines.join("\n");
  }
}

/** Common variables most apps need. Spread into your own schema. */
export const baseEnvShape = {
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().min(0).max(65535).default(5000),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).optional(),
  CORS_ORIGIN: z
    .string()
    .optional()
    .transform((v) => (v ? v.split(",").map((s) => s.trim()).filter(Boolean) : [])),
};

/** Parse and validate environment. Throws EnvValidationError listing every problem. */
export function parseEnv<S extends ZodRawShape>(shape: S, source: Record<string, string | undefined> = process.env): z.infer<ZodObject<S>> {
  const result = z.object(shape).safeParse(source);
  if (result.success) return result.data;
  const missing = new Set<string>();
  const invalid: { key: string; message: string }[] = [];
  for (const issue of result.error.issues) {
    const key = String(issue.path[0] ?? "(root)");
    if (source[key] === undefined || source[key] === "") missing.add(key);
    else invalid.push({ key, message: issue.message });
  }
  throw new EnvValidationError([...missing], invalid);
}

/** Like parseEnv, but prints a clear message and exits non-zero on failure. Never continues with bad config. */
export function loadEnv<S extends ZodRawShape>(shape: S, source: Record<string, string | undefined> = process.env): z.infer<ZodObject<S>> {
  try {
    return parseEnv(shape, source);
  } catch (e) {
    if (e instanceof EnvValidationError) {
      console.error(e.format());
      process.exit(1);
    }
    throw e;
  }
}

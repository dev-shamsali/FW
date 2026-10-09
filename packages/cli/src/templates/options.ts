export type Language = "ts" | "js";
export type ModuleSystem = "esm" | "cjs";
export type Database = "none" | "mongodb" | "mysql";

export interface ProjectOptions {
  language: Language;
  module: ModuleSystem;
  database: Database;
  /** Register, login and JWT route guards. Needs a database. */
  auth: boolean;
}

export const DEFAULT_OPTIONS: ProjectOptions = { language: "ts", module: "esm", database: "none", auth: false };

/** Contents of rhea.config.json in a generated project. Generators read it so they emit the same flavour. */
export const CONFIG_FILE = "rhea.config.json";

export const configJson = (o: ProjectOptions): string =>
  JSON.stringify({ language: o.language, module: o.module, database: o.database, auth: o.auth }, null, 2) + "\n";

export function parseConfig(text: string): ProjectOptions {
  const j = JSON.parse(text) as Partial<ProjectOptions>;
  return {
    language: j.language === "js" ? "js" : "ts",
    module: j.module === "cjs" ? "cjs" : "esm",
    database: j.database === "mongodb" || j.database === "mysql" ? j.database : "none",
    auth: j.auth === true && (j.database === "mongodb" || j.database === "mysql"),
  };
}

export const LABEL = {
  language: { ts: "TypeScript", js: "JavaScript" },
  module: { esm: "ES Modules", cjs: "CommonJS" },
  database: { none: "None", mongodb: "MongoDB", mysql: "MySQL" },
} as const;

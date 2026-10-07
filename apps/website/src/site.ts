import cfg from "../../../site.config.json";

/** Facts the site states. Edit site.config.json at the repo root. Null means "does not exist yet": the UI says so, it never invents a URL. */
export const site = {
  name: cfg.name,
  author: cfg.author,
  version: cfg.version,
  headline: "The secure, convention-driven backend framework for Node.js.",
  statement: "Build production-ready Express APIs with TypeScript, security-first defaults, powerful CLI tooling, and a predictable architecture.",
  description:
    "Rhea.js is a secure, convention-driven backend framework for Node.js and Express 5, with TypeScript, security defaults, a CLI and a plugin API. Alpha.",
  installCommand: "npx create-rhea my-api",
  repoUrl: cfg.repoUrl as string | null,
  npmUrl: cfg.npmUrl as string | null,
  contactEmail: cfg.contactEmail as string | null,
  siteUrl: (process.env["NEXT_PUBLIC_SITE_URL"] ?? cfg.siteUrl) as string,
} as const;

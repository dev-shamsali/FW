/** Single source of truth for facts the site states. Null means "does not exist yet": the UI must say so, never invent a URL. */
export const site = {
  name: "Rhea.js",
  author: "Shams Ali Shaikh",
  version: "0.1.0-alpha",
  headline: "The secure, convention-driven backend framework for Node.js.",
  statement: "Build production-ready Express APIs with TypeScript, security-first defaults, powerful CLI tooling, and a predictable architecture.",
  description:
    "Rhea.js is a secure, convention-driven backend framework for Node.js and Express 5, with TypeScript, security defaults, a CLI and a plugin API. Alpha.",
  installCommand: "npx create-rhea my-api",
  repoUrl: null as string | null,
  npmUrl: null as string | null,
  siteUrl: process.env["NEXT_PUBLIC_SITE_URL"] ?? null,
} as const;

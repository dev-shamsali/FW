import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["**/dist", "**/coverage", "**/node_modules", "**/.next", "**/out", "**/public/docs", "**/next-env.d.ts"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  { files: ["**/*.mjs"], languageOptions: { globals: { console: "readonly", process: "readonly", fetch: "readonly" } } },
  {
    files: ["apps/docs/assets/*.js"],
    languageOptions: {
      sourceType: "script",
      globals: { document: "readonly", window: "readonly", localStorage: "readonly", navigator: "readonly", fetch: "readonly", setTimeout: "readonly", IntersectionObserver: "readonly", Event: "readonly" },
    },
    rules: { "no-empty": ["error", { allowEmptyCatch: true }], "@typescript-eslint/no-unused-vars": ["error", { caughtErrors: "none" }] },
  },
  {
    rules: {
      "@typescript-eslint/no-namespace": "off",
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_", ignoreRestSiblings: true }],
    },
  },
);

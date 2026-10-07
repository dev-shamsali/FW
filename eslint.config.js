import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["**/dist", "**/coverage", "**/node_modules", "**/.next", "**/out", "**/public/docs", "**/next-env.d.ts"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  { files: ["**/*.mjs"], languageOptions: { globals: { console: "readonly", process: "readonly", fetch: "readonly" } } },
  {
    rules: {
      "@typescript-eslint/no-namespace": "off",
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_", ignoreRestSiblings: true }],
    },
  },
);

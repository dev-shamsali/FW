import { defineConfig } from "vitest/config";
// forks: CLI tests use process.chdir, which worker threads do not support.
export default defineConfig({
  test: { include: ["packages/*/tests/**/*.test.ts"], pool: "forks", coverage: { provider: "v8", include: ["packages/*/src/**"] } },
});

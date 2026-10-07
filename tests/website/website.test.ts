import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(import.meta.dirname, "../..");
const fixtures = JSON.parse(readFileSync(join(root, "apps/website/src/data/fixtures.json"), "utf8")) as {
  scenarios: { id: string; layer: number; response: { status: number; body: { success: boolean; error?: { code: string } } } }[];
  cli: { cmd: string; exit: number; output: string }[];
};

describe("website fixtures are real captured output", () => {
  const expected: Record<string, [number, string | undefined]> = {
    ok: [200, undefined],
    cors: [200, undefined],
    flood: [429, "RATE_LIMITED"],
    slow: [503, "REQUEST_TIMEOUT"],
    big: [413, "PAYLOAD_TOO_LARGE"],
    proto: [400, "INVALID_BODY"],
    invalid: [422, "VALIDATION_ERROR"],
    crash: [500, "INTERNAL_ERROR"],
  };
  it("covers every scenario with the documented status and code", () => {
    expect(fixtures.scenarios.map((s) => s.id).sort()).toEqual(Object.keys(expected).sort());
    for (const s of fixtures.scenarios) {
      expect(s.response.status, s.id).toBe(expected[s.id]![0]);
      expect(s.response.body.error?.code, s.id).toBe(expected[s.id]![1]);
      expect(s.layer).toBeGreaterThanOrEqual(1);
      expect(s.layer).toBeLessThanOrEqual(11);
    }
  });
  it("never contains the secret thrown inside the crash handler", () => {
    expect(JSON.stringify(fixtures)).not.toContain("hunter2");
  });
  it("CLI transcripts all exited 0", () => {
    expect(fixtures.cli.map((c) => c.exit)).toEqual([0, 0, 0, 0, 0]);
    expect(fixtures.cli.find((c) => c.cmd.includes("security"))!.output).toContain("not a penetration test");
  });
});

describe("site content stays honest", () => {
  const src = readFileSync(join(root, "apps/website/src/app/page.tsx"), "utf8") + readFileSync(join(root, "apps/website/src/site.ts"), "utf8");
  it("has no external repo/npm links or invented metrics in source", () => {
    expect(src).not.toMatch(/https?:\/\/(www\.)?(github\.com|npmjs\.com)/);
    expect(src).not.toMatch(/\b\d[\d,.]*\s*(stars|downloads|users|contributors|companies)\b/i);
    expect(src).toContain("Shams Ali Shaikh");
  });
  it("built output (when present) carries the required headline and no dead external links", () => {
    const out = join(root, "apps/website/out/index.html");
    if (!existsSync(out)) return;
    const html = readFileSync(out, "utf8");
    expect(html).toContain("The secure, convention-driven backend framework for Node.js.");
    expect(html).toContain("Get started");
    expect(html).not.toMatch(/href="https?:\/\/(www\.)?(github\.com|npmjs\.com)/);
  });
});

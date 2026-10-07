import { existsSync, readFileSync, readdirSync } from "node:fs";
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
    expect(readFileSync(join(root, "site.config.json"), "utf8")).toContain("Shams Ali Shaikh");
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

describe("privacy claims match the built site", () => {
  const out = join(root, "apps/website/out");
  const built = existsSync(join(out, "index.html"));
  const html = (p: string) => readFileSync(join(out, p), "utf8");

  it("privacy page exists and names the one storage key the site really uses", () => {
    const privacy = readFileSync(join(root, "apps/website/src/app/privacy/page.tsx"), "utf8");
    const toggle = readFileSync(join(root, "apps/website/src/components/ThemeToggle.tsx"), "utf8");
    const docsJs = readFileSync(join(root, "apps/docs/assets/docs.js"), "utf8");
    expect(privacy).toContain("rhea-theme");
    expect(toggle).toContain('"rhea-theme"');
    expect(docsJs).toContain('"rhea-theme"');
    // no other storage keys anywhere
    for (const f of [toggle, docsJs]) expect([...f.matchAll(/(?:get|set|remove)Item\("([^"]+)"/g)].every((m) => m[1] === "rhea-theme")).toBe(true);
  });

  it.skipIf(!built)("no page loads scripts, styles, fonts or images from another origin", () => {
    const pages = ["index.html", "privacy/index.html", "docs/introduction/index.html", "docs/configuration/index.html"];
    for (const p of pages) {
      const h = html(p);
      const external = [...h.matchAll(/<(?:script|img|iframe|source)[^>]+src="(https?:[^"]+)"/g), ...h.matchAll(/<link[^>]+href="(https?:[^"]+)"[^>]*>/g)]
        .filter((m) => !/rel="canonical"|property="og:/.test(m[0]))
        .map((m) => m[1]);
      expect(external, p).toEqual([]);
    }
    expect(html("docs/assets/" + readdirSync(join(out, "docs/assets")).find((f) => f.endsWith(".css"))!)).not.toMatch(/url\(\s*["']?https?:/);
  });

  it.skipIf(!built)("has canonical URLs, sitemap entries for every docs page, robots and a privacy link in the footer", () => {
    const nav = JSON.parse(readFileSync(join(root, "docs/nav.json"), "utf8")) as { pages: string[] }[];
    const sitemap = html("sitemap.xml");
    for (const page of nav.flatMap((s) => s.pages)) expect(sitemap, page).toContain(`/docs/${page}/`);
    expect(html("robots.txt")).toContain("Sitemap: https://rhea.devcodehub.cloud/sitemap.xml");
    expect(html("index.html")).toContain('href="/privacy/"');
    expect(html("docs/security/index.html")).toContain('rel="canonical" href="https://rhea.devcodehub.cloud/docs/security/"');
  });
});

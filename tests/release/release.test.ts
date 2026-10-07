import { spawnSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterAll, describe, expect, it } from "vitest";

const root = resolve(import.meta.dirname, "../..");
const tmp = mkdtempSync(join(tmpdir(), "rhea-rel-"));
afterAll(() => rmSync(tmp, { recursive: true, force: true }));

/** A minimal copy of the repo files the release scripts touch, so tests never modify the real repo. */
function sandbox(name: string) {
  const d = join(tmp, name);
  mkdirSync(join(d, "scripts"), { recursive: true });
  for (const f of ["set-repo.mjs", "check-release.mjs"]) cpSync(join(root, "scripts", f), join(d, "scripts", f));
  for (const p of ["core", "cli", "create-rhea"]) {
    mkdirSync(join(d, "packages", p), { recursive: true });
    const pj = JSON.parse(readFileSync(join(root, "packages", p, "package.json"), "utf8"));
    delete pj.repository;
    delete pj.bugs;
    writeFileSync(join(d, "packages", p, "package.json"), JSON.stringify(pj));
  }
  const cfg = JSON.parse(readFileSync(join(root, "site.config.json"), "utf8"));
  cfg.repoUrl = null;
  writeFileSync(join(d, "site.config.json"), JSON.stringify(cfg));
  cpSync(join(root, "CHANGELOG.md"), join(d, "CHANGELOG.md"));
  return d;
}
const node = (cwd: string, script: string, ...args: string[]) =>
  spawnSync(process.execPath, [join(cwd, "scripts", script), ...args], { cwd, encoding: "utf8" });

describe("set-repo", () => {
  it("writes repository, bugs and site config; rejects bad slugs", () => {
    const d = sandbox("set");
    for (const bad of ["", "noslash", "a/b/c", "../x", "a b/c", "-a/b"]) expect(node(d, "set-repo.mjs", bad).status, bad).toBe(2);
    const ok = node(d, "set-repo.mjs", "some-user/rhea-js");
    expect(ok.status, ok.stderr).toBe(0);
    const core = JSON.parse(readFileSync(join(d, "packages/core/package.json"), "utf8"));
    expect(core.repository).toEqual({ type: "git", url: "git+https://github.com/some-user/rhea-js.git", directory: "packages/core" });
    expect(core.bugs.url).toBe("https://github.com/some-user/rhea-js/issues");
    expect(JSON.parse(readFileSync(join(d, "site.config.json"), "utf8")).repoUrl).toBe("https://github.com/some-user/rhea-js");
  });
});

describe("check-release", () => {
  it("fails on a tag that does not match the version, and on missing repo in --strict", () => {
    const d = sandbox("tag");
    const mismatch = node(d, "check-release.mjs", "--tag", "v9.9.9", "--no-install");
    expect(mismatch.status).toBe(1);
    expect(mismatch.stderr).toContain("does not match package version");
    const strict = node(d, "check-release.mjs", "--strict", "--no-install");
    expect(strict.stderr).toContain("repository/bugs missing");
  });

  it("the repository's real package metadata is consistent", () => {
    const versions = ["core", "cli", "create-rhea"].map((p) => JSON.parse(readFileSync(join(root, "packages", p, "package.json"), "utf8")));
    expect(new Set(versions.map((v) => v.version)).size).toBe(1);
    expect(versions[2].dependencies["@rheajs/cli"]).toBe(versions[0].version);
    for (const v of versions) {
      expect(v.files).toContain("dist");
      expect(v.publishConfig).toEqual({ access: "public" });
      expect(v.engines.node).toBe(">=20");
      expect(v.author).toBe("Shams Ali Shaikh");
    }
  });

  it("release workflow never triggers on pull requests and requires an approval environment", () => {
    const wf = readFileSync(join(root, ".github/workflows/release.yml"), "utf8");
    expect(wf).not.toMatch(/pull_request/);
    expect(wf).toMatch(/environment:\s*npm-publish/);
    expect(wf).toMatch(/tags:\s*\["v\*"\]/);
    writeFileSync(join(tmp, "x"), "");
  });
});

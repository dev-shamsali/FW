// Usage: node scripts/set-repo.mjs <owner>/<repo>
// Writes the real repository URL into every package.json and site.config.json. Run once, after you create the GitHub repository.
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const slug = process.argv[2];
if (!slug || !/^[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?\/[A-Za-z0-9._-]+$/.test(slug)) {
  console.error("Usage: node scripts/set-repo.mjs <owner>/<repo>   (for example: my-user/rhea-js)");
  process.exit(2);
}
const web = `https://github.com/${slug}`;
const edit = (file, fn) => {
  const p = join(root, file);
  const j = JSON.parse(readFileSync(p, "utf8"));
  fn(j);
  writeFileSync(p, JSON.stringify(j, null, 2) + "\n");
  console.log("updated", file);
};
for (const dir of ["core", "cli", "create-rhea"]) {
  edit(`packages/${dir}/package.json`, (j) => {
    j.repository = { type: "git", url: `git+${web}.git`, directory: `packages/${dir}` };
    j.bugs = { url: `${web}/issues` };
  });
}
edit("site.config.json", (j) => {
  j.repoUrl = web;
});
console.log(`\nRepository set to ${web}\nNext: npm run build:website  (rebuilds the site with the GitHub link), then commit.`);

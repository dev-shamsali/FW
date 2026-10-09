import { readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import type { MetadataRoute } from "next";
import { site } from "../site";

export const dynamic = "force-static";

/** Last-modified date of a source file, so the sitemap reports real dates and never invents one. */
function modified(file: string): Date {
  try {
    return statSync(file).mtime;
  } catch {
    return new Date();
  }
}

export default function sitemap(): MetadataRoute.Sitemap {
  const base = site.siteUrl.replace(/\/$/, "");
  const root = join(process.cwd(), "../..");
  const nav = JSON.parse(readFileSync(join(root, "docs/nav.json"), "utf8")) as { pages: string[] }[];
  const docs: MetadataRoute.Sitemap = nav
    .flatMap((s) => s.pages)
    .map((p) => ({
      url: `${base}/docs/${p}/`,
      lastModified: modified(join(root, "docs", `${p}.md`)),
      changeFrequency: "monthly",
      priority: p === "introduction" || p === "quick-start" ? 0.9 : 0.7,
    }));
  return [
    { url: `${base}/`, lastModified: modified(join(root, "apps/website/src/app/page.tsx")), changeFrequency: "weekly", priority: 1 },
    ...docs,
    { url: `${base}/privacy/`, lastModified: modified(join(root, "apps/website/src/app/privacy/page.tsx")), changeFrequency: "yearly", priority: 0.3 },
  ];
}

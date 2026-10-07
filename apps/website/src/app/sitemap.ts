import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { MetadataRoute } from "next";
import { site } from "../site";

export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = site.siteUrl.replace(/\/$/, "");
  const nav = JSON.parse(readFileSync(join(process.cwd(), "../../docs/nav.json"), "utf8")) as { pages: string[] }[];
  const docs = nav.flatMap((s) => s.pages).map((p) => ({ url: `${base}/docs/${p}/` }));
  return [{ url: `${base}/` }, ...docs, { url: `${base}/privacy/` }];
}

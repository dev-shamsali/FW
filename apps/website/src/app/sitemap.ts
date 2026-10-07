import type { MetadataRoute } from "next";
import { site } from "../site";

export const dynamic = "force-static";

// Empty until NEXT_PUBLIC_SITE_URL is set: a sitemap with a guessed domain would be wrong.
export default function sitemap(): MetadataRoute.Sitemap {
  if (!site.siteUrl) return [];
  return [{ url: `${site.siteUrl}/` }, { url: `${site.siteUrl}/docs/introduction.html` }];
}

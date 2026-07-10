import type { MetadataRoute } from "next";

import { SITEMAP_ROUTES } from "@/lib/marketing-content";

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://propertyos.app";
  const now = new Date();

  return SITEMAP_ROUTES.map((route) => ({
    changeFrequency: route.changeFrequency,
    lastModified: now,
    priority: route.priority,
    url: `${baseUrl}${route.path}`,
  }));
}

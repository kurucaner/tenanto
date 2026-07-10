import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://propertyos.app";
  const now = new Date();

  return [
    {
      url: baseUrl,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 1,
    },
    {
      changeFrequency: "yearly",
      lastModified: now,
      priority: 0.3,
      url: `${baseUrl}/privacy-policy`,
    },
    {
      changeFrequency: "yearly",
      lastModified: now,
      priority: 0.3,
      url: `${baseUrl}/terms-of-service`,
    },
    {
      changeFrequency: "never",
      lastModified: now,
      priority: 0.1,
      url: `${baseUrl}/unsubscribe`,
    },
  ];
}

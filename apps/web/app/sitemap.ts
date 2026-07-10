import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://propertyos.app";
  const now = new Date();

  return [
    {
      changeFrequency: "monthly",
      lastModified: now,
      priority: 1,
      url: baseUrl,
    },
    {
      changeFrequency: "monthly",
      lastModified: now,
      priority: 0.8,
      url: `${baseUrl}/welcome`,
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

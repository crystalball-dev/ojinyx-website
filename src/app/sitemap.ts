import type { MetadataRoute } from "next";
import { site } from "@/content/site";
import { sortedReleases } from "@/lib/releases";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const statics: MetadataRoute.Sitemap = [
    { url: `${site.url}/`, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${site.url}/releases`, lastModified: now, changeFrequency: "weekly", priority: 0.9 },
    { url: `${site.url}/wip`, lastModified: now, changeFrequency: "weekly", priority: 0.6 },
    { url: `${site.url}/merch`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    { url: `${site.url}/contact`, lastModified: now, changeFrequency: "yearly", priority: 0.4 },
  ];
  const releases: MetadataRoute.Sitemap = sortedReleases.map((r) => {
    const d = r.releaseDate ? new Date(r.releaseDate) : now;
    return {
      url: `${site.url}/releases/${r.slug}`,
      lastModified: Number.isNaN(d.getTime()) ? now : d,
      changeFrequency: "monthly",
      priority: 0.8,
    };
  });
  return [...statics, ...releases];
}

import type { MetadataRoute } from "next";
import { getAllBlogPosts } from "@/lib/blogPosts";
import { getAllIntegrationGuides } from "@/lib/integrationGuides";
import { absoluteUrl } from "@/lib/seo";

const STATIC_ROUTES = [
  { path: "/", changeFrequency: "daily", priority: 1 },
  { path: "/about", changeFrequency: "monthly", priority: 0.8 },
  { path: "/pricing", changeFrequency: "weekly", priority: 0.9 },
  { path: "/blog", changeFrequency: "weekly", priority: 0.85 },
  { path: "/docs", changeFrequency: "weekly", priority: 0.9 },
  { path: "/docs/api", changeFrequency: "weekly", priority: 0.9 },
  { path: "/docs/ci-cd", changeFrequency: "weekly", priority: 0.9 },
  { path: "/integrations", changeFrequency: "weekly", priority: 0.85 },
  { path: "/contact", changeFrequency: "monthly", priority: 0.75 },
  { path: "/privacy", changeFrequency: "yearly", priority: 0.5 },
  { path: "/terms", changeFrequency: "yearly", priority: 0.5 },
  { path: "/security-headers-guide", changeFrequency: "weekly", priority: 0.85 },
  { path: "/compare", changeFrequency: "daily", priority: 0.8 },
  { path: "/bulk", changeFrequency: "daily", priority: 0.8 },
  { path: "/badge", changeFrequency: "weekly", priority: 0.75 },
  { path: "/changelog", changeFrequency: "monthly", priority: 0.65 }
] as const satisfies ReadonlyArray<{
  path: string;
  changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"];
  priority: number;
}>;

export default function sitemap(): MetadataRoute.Sitemap {
  const generatedAt = new Date();

  const staticEntries = STATIC_ROUTES.map((route) => ({
    url: absoluteUrl(route.path),
    lastModified: generatedAt,
    changeFrequency: route.changeFrequency,
    priority: route.priority
  }));

  const blogEntries = getAllBlogPosts().map((post) => ({
    url: absoluteUrl(`/blog/${post.slug}`),
    lastModified: new Date(`${post.publishedAt}T00:00:00.000Z`),
    changeFrequency: "monthly" as const,
    priority: 0.8
  }));

  const integrationEntries = getAllIntegrationGuides().map((guide) => ({
    url: absoluteUrl(`/integrations/${guide.slug}`),
    lastModified: generatedAt,
    changeFrequency: "monthly" as const,
    priority: 0.75
  }));

  return [...staticEntries, ...blogEntries, ...integrationEntries];
}

import type { MetadataRoute } from "next";
import { absoluteUrl } from "@/lib/seo";

const STATIC_ROUTES = [
  { path: "/", changeFrequency: "daily", priority: 1 },
  { path: "/compare", changeFrequency: "daily", priority: 0.95 },
  { path: "/bulk", changeFrequency: "daily", priority: 0.95 },
  { path: "/pricing", changeFrequency: "weekly", priority: 0.9 },
  { path: "/docs", changeFrequency: "weekly", priority: 0.9 },
  { path: "/security-headers-guide", changeFrequency: "weekly", priority: 0.85 },
  { path: "/about", changeFrequency: "monthly", priority: 0.7 },
  { path: "/changelog", changeFrequency: "monthly", priority: 0.7 }
] as const satisfies ReadonlyArray<{
  path: string;
  changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"];
  priority: number;
}>;

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();

  return STATIC_ROUTES.map((route) => ({
    url: absoluteUrl(route.path),
    lastModified,
    changeFrequency: route.changeFrequency,
    priority: route.priority
  }));
}

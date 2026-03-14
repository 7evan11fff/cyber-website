import type { HeaderResult } from "@/lib/securityHeaders";
import { HEADER_GUIDANCE, type HeaderGuidance } from "@/lib/headerGuidance";
import type { DetectedFramework } from "@/lib/frameworkDetection";

export type FixPlatformId = "express" | "nextjs" | "nginx" | "apache" | "cloudflare-workers";

export type PlatformFixSnippet = {
  id: FixPlatformId;
  title: string;
  description: string;
  snippet: string;
};

type PlatformMeta = Omit<PlatformFixSnippet, "snippet">;

const PLATFORM_META: PlatformMeta[] = [
  {
    id: "express",
    title: "Express.js",
    description: "Add a middleware that sets security headers on every response."
  },
  {
    id: "nextjs",
    title: "Next.js",
    description: "Configure global headers in next.config.js for all routes."
  },
  {
    id: "nginx",
    title: "Nginx",
    description: "Add response headers in your server block."
  },
  {
    id: "apache",
    title: "Apache",
    description: "Use mod_headers with Header always set directives."
  },
  {
    id: "cloudflare-workers",
    title: "Cloudflare Workers",
    description: "Set headers at the edge by mutating the outgoing response."
  }
];

const guidanceByKey = new Map(HEADER_GUIDANCE.map((item) => [item.key, item]));

function apacheEscape(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function buildExpressSnippet(headers: HeaderGuidance[]): string {
  const lines = headers.map((item) => `  "${item.headerName}": "${item.recommendedValue}"`);
  return [
    "// Express.js: apply to all responses",
    "const securityHeaders = {",
    ...lines.map((line, index) => `${line}${index < lines.length - 1 ? "," : ""}`),
    "};",
    "",
    "app.use((_req, res, next) => {",
    "  for (const [key, value] of Object.entries(securityHeaders)) {",
    "    res.setHeader(key, value);",
    "  }",
    "  next();",
    "});"
  ].join("\n");
}

function buildNextSnippet(headers: HeaderGuidance[]): string {
  const lines = headers.map(
    (item) => `  { key: "${item.headerName}", value: "${item.recommendedValue}" }`
  );
  return [
    "// next.config.js",
    "const securityHeaders = [",
    ...lines.map((line, index) => `${line}${index < lines.length - 1 ? "," : ""}`),
    "];",
    "",
    "const nextConfig = {",
    "  async headers() {",
    "    return [",
    "      {",
    '        source: "/(.*)",',
    "        headers: securityHeaders",
    "      }",
    "    ];",
    "  }",
    "};",
    "",
    "module.exports = nextConfig;"
  ].join("\n");
}

function buildNginxSnippet(headers: HeaderGuidance[]): string {
  return [
    "# Add inside your nginx server {} block",
    ...headers.map((item) => `add_header ${item.headerName} "${item.recommendedValue}" always;`)
  ].join("\n");
}

function buildApacheSnippet(headers: HeaderGuidance[]): string {
  return [
    "# Requires mod_headers",
    ...headers.map((item) => `Header always set ${item.headerName} "${apacheEscape(item.recommendedValue)}"`)
  ].join("\n");
}

function buildCloudflareWorkersSnippet(headers: HeaderGuidance[]): string {
  const lines = headers.map((item) => `  headers.set("${item.headerName}", "${item.recommendedValue}");`);
  return [
    "// Cloudflare Workers (module syntax)",
    "export default {",
    "  async fetch(request, env) {",
    "    const upstream = await fetch(request, env.ASSETS ? { cf: request.cf } : undefined);",
    "    const headers = new Headers(upstream.headers);",
    ...lines,
    "",
    "    return new Response(upstream.body, {",
    "      status: upstream.status,",
    "      statusText: upstream.statusText,",
    "      headers",
    "    });",
    "  }",
    "};"
  ].join("\n");
}

function buildSnippetForPlatform(platform: FixPlatformId, headers: HeaderGuidance[]): string {
  if (platform === "express") return buildExpressSnippet(headers);
  if (platform === "nextjs") return buildNextSnippet(headers);
  if (platform === "nginx") return buildNginxSnippet(headers);
  if (platform === "apache") return buildApacheSnippet(headers);
  return buildCloudflareWorkersSnippet(headers);
}

function uniqueGuidanceForResults(results: HeaderResult[]): HeaderGuidance[] {
  const keys = new Set<string>();
  const selected: HeaderGuidance[] = [];

  for (const result of results) {
    if (result.status === "good") continue;
    const guidance = guidanceByKey.get(result.key);
    if (!guidance || keys.has(guidance.key)) continue;
    keys.add(guidance.key);
    selected.push(guidance);
  }

  return selected;
}

export function normalizeFixPlatform(value: string | null | undefined): FixPlatformId | null {
  const normalized = value?.trim().toLowerCase();
  if (!normalized) return null;
  if (
    normalized === "express" ||
    normalized === "nextjs" ||
    normalized === "nginx" ||
    normalized === "apache" ||
    normalized === "cloudflare-workers"
  ) {
    return normalized;
  }
  return null;
}

export function getSuggestedPlatformFromFramework(framework: DetectedFramework | null | undefined): FixPlatformId | null {
  if (!framework) return null;
  if (
    framework.id === "express" ||
    framework.id === "nextjs" ||
    framework.id === "nginx" ||
    framework.id === "apache" ||
    framework.id === "cloudflare-workers"
  ) {
    return framework.id;
  }
  return null;
}

export function buildQuickFixCatalog(): PlatformFixSnippet[] {
  return PLATFORM_META.map((platform) => ({
    ...platform,
    snippet: buildSnippetForPlatform(platform.id, HEADER_GUIDANCE)
  }));
}

export function buildPlatformFixSuggestions(results: HeaderResult[]): {
  headers: HeaderGuidance[];
  snippets: PlatformFixSnippet[];
} {
  const headers = uniqueGuidanceForResults(results);
  const snippets = PLATFORM_META.map((platform) => ({
    ...platform,
    snippet: buildSnippetForPlatform(platform.id, headers)
  }));
  return { headers, snippets };
}

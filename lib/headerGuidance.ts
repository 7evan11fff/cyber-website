import type { HeaderResult } from "@/lib/securityHeaders";

export type HeaderGuidance = {
  key: string;
  label: string;
  headerName: string;
  recommendedValue: string;
  purpose: string;
  commonMisconfigurations: string[];
};

export const HEADER_GUIDANCE: HeaderGuidance[] = [
  {
    key: "content-security-policy",
    label: "Content-Security-Policy",
    headerName: "Content-Security-Policy",
    recommendedValue:
      "default-src 'self'; base-uri 'self'; frame-ancestors 'none'; object-src 'none';",
    purpose: "Limits where scripts, styles, and other resources can load from.",
    commonMisconfigurations: [
      "Using unsafe-inline or unsafe-eval in production policies",
      "Allowing broad wildcards without a strict default-src",
      "Missing frame-ancestors and object-src hardening directives"
    ]
  },
  {
    key: "strict-transport-security",
    label: "Strict-Transport-Security",
    headerName: "Strict-Transport-Security",
    recommendedValue: "max-age=31536000; includeSubDomains; preload",
    purpose: "Forces HTTPS and helps prevent SSL downgrade attacks.",
    commonMisconfigurations: [
      "Low max-age values that expire too quickly",
      "Missing includeSubDomains for full domain coverage",
      "Setting HSTS before HTTPS is reliably enforced everywhere"
    ]
  },
  {
    key: "x-frame-options",
    label: "X-Frame-Options",
    headerName: "X-Frame-Options",
    recommendedValue: "DENY",
    purpose: "Prevents clickjacking by disallowing framing by other sites.",
    commonMisconfigurations: [
      "Using non-standard values that browsers ignore",
      "Leaving legacy ALLOW-FROM values that are not widely supported",
      "Relying only on X-Frame-Options without CSP frame-ancestors"
    ]
  },
  {
    key: "x-xss-protection",
    label: "X-XSS-Protection",
    headerName: "X-XSS-Protection",
    recommendedValue: "1; mode=block",
    purpose: "Legacy protection for older browser XSS filters.",
    commonMisconfigurations: [
      "Explicitly disabling with value 0 when legacy support is needed",
      "Assuming it replaces a robust CSP policy",
      "Using malformed values that fail silently"
    ]
  },
  {
    key: "x-content-type-options",
    label: "X-Content-Type-Options",
    headerName: "X-Content-Type-Options",
    recommendedValue: "nosniff",
    purpose: "Prevents MIME sniffing and content type confusion.",
    commonMisconfigurations: [
      "Using any value other than nosniff",
      "Setting it only on some static asset responses",
      "Omitting it on user-uploaded content routes"
    ]
  },
  {
    key: "referrer-policy",
    label: "Referrer-Policy",
    headerName: "Referrer-Policy",
    recommendedValue: "strict-origin-when-cross-origin",
    purpose: "Controls how much referrer data is shared across requests.",
    commonMisconfigurations: [
      "Using unsafe-url and exposing full paths cross-origin",
      "Mixing route-level policies with conflicting global defaults",
      "Using no policy and relying on browser defaults"
    ]
  },
  {
    key: "permissions-policy",
    label: "Permissions-Policy",
    headerName: "Permissions-Policy",
    recommendedValue: "camera=(), microphone=(), geolocation=()",
    purpose: "Restricts access to powerful browser features.",
    commonMisconfigurations: [
      "Allowing all origins with wildcard feature policies",
      "Forgetting to disable features your app never needs",
      "Using invalid syntax that browsers skip"
    ]
  },
  {
    key: "cross-origin-opener-policy",
    label: "Cross-Origin-Opener-Policy",
    headerName: "Cross-Origin-Opener-Policy",
    recommendedValue: "same-origin",
    purpose: "Isolates top-level browsing context from cross-origin windows.",
    commonMisconfigurations: [
      "Using unsafe-none on sensitive web applications",
      "Setting COOP without considering legitimate popup flows",
      "Expecting COOP benefits without complementary COEP and CORP"
    ]
  },
  {
    key: "cross-origin-embedder-policy",
    label: "Cross-Origin-Embedder-Policy",
    headerName: "Cross-Origin-Embedder-Policy",
    recommendedValue: "require-corp",
    purpose: "Controls what cross-origin resources can be embedded safely.",
    commonMisconfigurations: [
      "Setting require-corp without auditing third-party resources",
      "Using invalid token values not recognized by browsers",
      "Enabling COEP without a rollout strategy, causing breakage"
    ]
  },
  {
    key: "cross-origin-resource-policy",
    label: "Cross-Origin-Resource-Policy",
    headerName: "Cross-Origin-Resource-Policy",
    recommendedValue: "same-origin",
    purpose: "Restricts which origins may read and embed your resources.",
    commonMisconfigurations: [
      "Using cross-origin for sensitive data endpoints",
      "Applying overly strict values to public assets unexpectedly",
      "Confusing CORP with CORS and skipping proper CORS config"
    ]
  }
];

const guidanceByKey = new Map(HEADER_GUIDANCE.map((item) => [item.key, item]));

function apacheEscape(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

export type HeaderFixBundle = {
  headers: HeaderGuidance[];
  nginxSnippet: string;
  apacheSnippet: string;
  cloudflareSnippet: string;
};

export function buildHeaderFixBundle(results: HeaderResult[]): HeaderFixBundle {
  const headers = results
    .filter((result) => result.status !== "good")
    .map((result) => guidanceByKey.get(result.key))
    .filter((item): item is HeaderGuidance => Boolean(item))
    .filter((item, index, list) => list.findIndex((candidate) => candidate.key === item.key) === index);

  const nginxSnippet = [
    "# Add inside your nginx server {} block",
    ...headers.map((item) => `add_header ${item.headerName} "${item.recommendedValue}" always;`)
  ].join("\n");

  const apacheSnippet = [
    "# Requires mod_headers",
    ...headers.map((item) => `Header always set ${item.headerName} "${apacheEscape(item.recommendedValue)}"`)
  ].join("\n");

  const cloudflareSnippet = [
    "# Cloudflare dashboard: Rules > Transform Rules > HTTP Response Header Modification",
    ...headers.map((item) => `Set static ${item.headerName}: ${item.recommendedValue}`)
  ].join("\n");

  return {
    headers,
    nginxSnippet,
    apacheSnippet,
    cloudflareSnippet
  };
}

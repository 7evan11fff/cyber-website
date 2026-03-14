import type { Page } from "@playwright/test";

type MockReportOverrides = Partial<{
  checkedUrl: string;
  finalUrl: string;
  statusCode: number;
  score: number;
  grade: string;
  checkedAt: string;
}>;

const DEFAULT_RESULTS = [
  {
    key: "content-security-policy",
    label: "Content-Security-Policy",
    value: "default-src 'self'",
    present: true,
    status: "good",
    riskLevel: "low",
    whyItMatters: "Limits where scripts, styles, and other resources can load from.",
    guidance: "Policy is present and does not include common unsafe directives."
  },
  {
    key: "strict-transport-security",
    label: "Strict-Transport-Security",
    value: "max-age=31536000; includeSubDomains",
    present: true,
    status: "good",
    riskLevel: "low",
    whyItMatters: "Forces browsers to use HTTPS and prevents downgrade attacks.",
    guidance: "Strong HSTS configuration detected."
  },
  {
    key: "x-frame-options",
    label: "X-Frame-Options",
    value: "DENY",
    present: true,
    status: "good",
    riskLevel: "low",
    whyItMatters: "Mitigates clickjacking by controlling framing by other sites.",
    guidance: "Recommended value detected."
  },
  {
    key: "x-xss-protection",
    label: "X-XSS-Protection",
    value: "1; mode=block",
    present: true,
    status: "good",
    riskLevel: "low",
    whyItMatters:
      "Legacy browser XSS filter control. Deprecated in modern browsers but still useful to document.",
    guidance: "Legacy XSS filter is enabled. Keep CSP as the primary protection."
  },
  {
    key: "x-content-type-options",
    label: "X-Content-Type-Options",
    value: "nosniff",
    present: true,
    status: "good",
    riskLevel: "low",
    whyItMatters: "Prevents MIME sniffing and reduces content type confusion attacks.",
    guidance: "nosniff value detected."
  },
  {
    key: "referrer-policy",
    label: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
    present: true,
    status: "good",
    riskLevel: "low",
    whyItMatters: "Controls how much URL information is sent in the Referer header.",
    guidance: "Policy appears privacy-conscious."
  },
  {
    key: "feature-policy",
    label: "Feature-Policy",
    value: "camera 'none'; microphone 'none'",
    present: true,
    status: "good",
    riskLevel: "low",
    whyItMatters:
      "Legacy precursor to Permissions-Policy used by older browsers to limit camera, microphone, and other features.",
    guidance: "Feature restrictions look explicit for legacy browser compatibility."
  },
  {
    key: "permissions-policy",
    label: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
    present: true,
    status: "good",
    riskLevel: "low",
    whyItMatters: "Limits access to browser features like camera, microphone, and geolocation.",
    guidance: "Policy appears restrictive."
  },
  {
    key: "cross-origin-opener-policy",
    label: "Cross-Origin-Opener-Policy",
    value: "same-origin",
    present: true,
    status: "good",
    riskLevel: "low",
    whyItMatters:
      "Isolates browsing context from cross-origin windows to reduce XS-Leaks and process sharing risks.",
    guidance: "COOP policy supports cross-origin isolation goals."
  },
  {
    key: "cross-origin-embedder-policy",
    label: "Cross-Origin-Embedder-Policy",
    value: "require-corp",
    present: true,
    status: "good",
    riskLevel: "low",
    whyItMatters:
      "Controls which cross-origin resources can be embedded and enables safer high-privilege browser features.",
    guidance: "COEP setting is suitable for cross-origin isolation."
  },
  {
    key: "cross-origin-resource-policy",
    label: "Cross-Origin-Resource-Policy",
    value: "same-origin",
    present: true,
    status: "good",
    riskLevel: "low",
    whyItMatters:
      "Restricts which origins can load your resources, reducing cross-origin data exposure.",
    guidance: "CORP restricts resource sharing appropriately."
  }
];

function normalizeUrlLikeInput(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return "https://example.com/";
  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    return new URL(withProtocol).toString();
  } catch {
    return "https://example.com/";
  }
}

export function buildMockReport(input: string, overrides: MockReportOverrides = {}) {
  const checkedUrl = overrides.checkedUrl ?? normalizeUrlLikeInput(input);
  return {
    checkedUrl,
    finalUrl: overrides.finalUrl ?? checkedUrl,
    statusCode: overrides.statusCode ?? 200,
    score: overrides.score ?? 22,
    grade: overrides.grade ?? "A",
    results: DEFAULT_RESULTS,
    checkedAt: overrides.checkedAt ?? "2026-03-14T00:00:00.000Z"
  };
}

export async function mockSession(page: Page) {
  await page.route("**/api/auth/session", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: "{}"
    });
  });
}

export async function mockCheckEndpoint(
  page: Page,
  resolver: (input: string, callIndex: number) => Record<string, unknown> = (input) => buildMockReport(input)
) {
  let callIndex = 0;
  await page.route("**/api/check", async (route) => {
    callIndex += 1;
    const body = route.request().postDataJSON() as { url?: unknown } | null;
    const input = body && typeof body.url === "string" ? body.url : "example.com";

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(resolver(input, callIndex))
    });
  });
}

export async function mockShareEndpoint(page: Page) {
  let shareIndex = 0;
  await page.route("**/api/reports/share", async (route) => {
    shareIndex += 1;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ path: `/report/mock-${shareIndex}` })
    });
  });
}

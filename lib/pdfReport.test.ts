import { describe, expect, it } from "vitest";
import { collectRecommendationItems } from "@/lib/pdfReport";
import type { HeaderResult } from "@/lib/securityHeaders";

function buildHeader(overrides: Partial<HeaderResult>): HeaderResult {
  return {
    key: "content-security-policy",
    label: "Content-Security-Policy",
    value: null,
    present: false,
    status: "missing",
    riskLevel: "high",
    whyItMatters: "Limits where scripts can load from.",
    guidance: "Add strict CSP.",
    ...overrides
  };
}

describe("pdfReport recommendation prioritization", () => {
  it("returns only weak or missing headers, sorted by status and risk", () => {
    const recommendations = collectRecommendationItems([
      buildHeader({
        key: "x-content-type-options",
        label: "X-Content-Type-Options",
        status: "weak",
        riskLevel: "medium",
        guidance: "Use nosniff."
      }),
      buildHeader({
        key: "permissions-policy",
        label: "Permissions-Policy",
        status: "missing",
        riskLevel: "high",
        guidance: "Add explicit policy."
      }),
      buildHeader({
        key: "x-frame-options",
        label: "X-Frame-Options",
        status: "good",
        riskLevel: "low",
        value: "DENY",
        present: true,
        guidance: "Looks good."
      }),
      buildHeader({
        key: "cross-origin-opener-policy",
        label: "Cross-Origin-Opener-Policy",
        status: "missing",
        riskLevel: "medium",
        guidance: "Use same-origin."
      })
    ]);

    expect(recommendations).toHaveLength(3);
    expect(recommendations.map((item) => item.label)).toEqual([
      "Permissions-Policy",
      "Cross-Origin-Opener-Policy",
      "X-Content-Type-Options"
    ]);
    expect(recommendations.every((item) => item.status !== "good")).toBe(true);
  });

  it("returns empty recommendations when all headers are good", () => {
    const recommendations = collectRecommendationItems([
      buildHeader({
        key: "strict-transport-security",
        label: "Strict-Transport-Security",
        status: "good",
        riskLevel: "low",
        value: "max-age=31536000; includeSubDomains",
        present: true,
        guidance: "Strong HSTS."
      })
    ]);

    expect(recommendations).toEqual([]);
  });
});

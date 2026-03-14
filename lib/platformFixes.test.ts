import { describe, expect, it } from "vitest";
import { buildPlatformFixSuggestions, buildQuickFixCatalog, getSuggestedPlatformFromFramework } from "@/lib/platformFixes";
import type { HeaderResult } from "@/lib/securityHeaders";

function result(key: string, status: HeaderResult["status"]): HeaderResult {
  return {
    key,
    label: key,
    value: null,
    present: status !== "missing",
    status,
    riskLevel: "low",
    whyItMatters: "test",
    guidance: "test"
  };
}

describe("platform fix snippets", () => {
  it("returns snippets for all quick-fix platforms", () => {
    const catalog = buildQuickFixCatalog();
    expect(catalog).toHaveLength(5);
    expect(catalog.map((item) => item.id)).toEqual([
      "express",
      "nextjs",
      "nginx",
      "apache",
      "cloudflare-workers"
    ]);
  });

  it("builds snippets only for missing/weak headers", () => {
    const suggestions = buildPlatformFixSuggestions([
      result("content-security-policy", "missing"),
      result("strict-transport-security", "good"),
      result("x-frame-options", "weak")
    ]);

    expect(suggestions.headers.map((item) => item.key)).toEqual(
      expect.arrayContaining(["content-security-policy", "x-frame-options"])
    );
    expect(suggestions.headers.map((item) => item.key)).not.toContain("strict-transport-security");
    expect(suggestions.snippets[0]?.snippet).toContain("Content-Security-Policy");
    expect(suggestions.snippets[0]?.snippet).toContain("X-Frame-Options");
  });

  it("maps supported framework ids to a platform", () => {
    expect(
      getSuggestedPlatformFromFramework({
        id: "nextjs",
        label: "Next.js",
        reason: "x-powered-by",
        evidence: [{ header: "x-powered-by", value: "Next.js" }]
      })
    ).toBe("nextjs");

    expect(
      getSuggestedPlatformFromFramework({
        id: "nodejs",
        label: "Node.js",
        reason: "x-powered-by",
        evidence: [{ header: "x-powered-by", value: "node" }]
      })
    ).toBeNull();
  });
});

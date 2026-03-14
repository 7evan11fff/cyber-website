import { describe, expect, it } from "vitest";
import { getHeaderDeepDiveDetails } from "@/lib/headerDeepDive";
import type { HeaderResult } from "@/lib/securityHeaders";

function buildHeader(overrides: Partial<HeaderResult> = {}): HeaderResult {
  return {
    key: "content-security-policy",
    label: "Content-Security-Policy",
    value: "default-src 'self'; script-src 'self' https://cdn.example.com",
    present: true,
    status: "good",
    riskLevel: "low",
    whyItMatters: "Limits resource sources.",
    guidance: "Keep directives strict.",
    ...overrides
  };
}

describe("getHeaderDeepDiveDetails", () => {
  it("returns directive explanations for present header values", () => {
    const details = getHeaderDeepDiveDetails(buildHeader());

    expect(details.mdnUrl).toContain("Content-Security-Policy");
    expect(details.directives[0]?.directive).toBe("default-src");
    expect(details.directives[0]?.explanation).toContain("Fallback source list");
    expect(details.directives[1]?.directive).toBe("script-src");
  });

  it("returns a missing-header explanation when no value exists", () => {
    const details = getHeaderDeepDiveDetails(
      buildHeader({
        value: null,
        present: false,
        status: "missing"
      })
    );

    expect(details.directives).toHaveLength(1);
    expect(details.directives[0]?.directive).toBe("Missing header");
  });
});

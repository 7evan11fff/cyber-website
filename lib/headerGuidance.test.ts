import { describe, expect, it } from "vitest";
import { buildHeaderFixBundle, HEADER_GUIDANCE } from "@/lib/headerGuidance";
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

describe("HEADER_GUIDANCE structure", () => {
  it("contains unique entries with complete required fields", () => {
    expect(HEADER_GUIDANCE.length).toBeGreaterThan(0);

    const keys = new Set<string>();
    for (const entry of HEADER_GUIDANCE) {
      expect(entry.key).toBeTruthy();
      expect(entry.label).toBeTruthy();
      expect(entry.headerName).toBeTruthy();
      expect(entry.recommendedValue).toBeTruthy();
      expect(entry.purpose).toBeTruthy();
      expect(Array.isArray(entry.commonMisconfigurations)).toBe(true);
      expect(entry.commonMisconfigurations.length).toBeGreaterThan(0);

      expect(keys.has(entry.key)).toBe(false);
      keys.add(entry.key);
    }
  });

  it("creates fix snippets only for non-good and known headers", () => {
    const firstKey = HEADER_GUIDANCE[0]?.key;
    const secondKey = HEADER_GUIDANCE[1]?.key;
    expect(firstKey).toBeTruthy();
    expect(secondKey).toBeTruthy();

    const bundle = buildHeaderFixBundle([
      result(firstKey as string, "missing"),
      result(firstKey as string, "weak"),
      result(secondKey as string, "good"),
      result("x-unknown-header", "missing")
    ]);

    expect(bundle.headers).toHaveLength(1);
    expect(bundle.headers[0]?.key).toBe(firstKey);
    expect(bundle.nginxSnippet).toContain(bundle.headers[0]?.headerName);
    expect(bundle.apacheSnippet).toContain(bundle.headers[0]?.headerName);
    expect(bundle.cloudflareSnippet).toContain(bundle.headers[0]?.headerName);
  });
});

import { describe, expect, it } from "vitest";
import {
  CORS_MAX_SCORE,
  allowsCredentials,
  analyzeCorsConfiguration,
  computeCorsScore,
  hasWildcardValue,
  normalizeCorsHeaderValue,
  parseCorsList,
  type CorsFinding
} from "@/lib/corsAnalysis";

describe("corsAnalysis helpers", () => {
  it("normalizes header values", () => {
    expect(normalizeCorsHeaderValue("  *  ")).toBe("*");
    expect(normalizeCorsHeaderValue("")).toBeNull();
    expect(normalizeCorsHeaderValue("   ")).toBeNull();
    expect(normalizeCorsHeaderValue(null)).toBeNull();
  });

  it("parses comma-separated cors tokens", () => {
    expect(parseCorsList(" GET, POST ,DELETE ")).toEqual(["get", "post", "delete"]);
    expect(parseCorsList(null)).toEqual([]);
  });

  it("detects wildcard values", () => {
    expect(hasWildcardValue("*")).toBe(true);
    expect(hasWildcardValue("GET, *")).toBe(true);
    expect(hasWildcardValue("GET,POST")).toBe(false);
  });

  it("detects credential allowance", () => {
    expect(allowsCredentials("true")).toBe(true);
    expect(allowsCredentials(" TRUE ")).toBe(true);
    expect(allowsCredentials("false")).toBe(false);
    expect(allowsCredentials(null)).toBe(false);
  });

  it("computes cors score from findings", () => {
    const findings: CorsFinding[] = [
      {
        id: "f-1",
        header: "access-control-allow-origin",
        severity: "high",
        message: "high issue",
        recommendation: "fix",
        value: "*"
      },
      {
        id: "f-2",
        header: "access-control-allow-methods",
        severity: "medium",
        message: "medium issue",
        recommendation: "fix",
        value: "*"
      }
    ];
    expect(computeCorsScore(findings)).toBe(1);
    expect(
      computeCorsScore([
        ...findings,
        {
          id: "f-3",
          header: "access-control-allow-credentials",
          severity: "critical",
          message: "critical",
          recommendation: "fix now",
          value: "true"
        }
      ])
    ).toBe(0);
  });
});

describe("analyzeCorsConfiguration", () => {
  it("flags wildcard origin with credentials as critical", () => {
    const headers = new Headers({
      "access-control-allow-origin": "*",
      "access-control-allow-credentials": "true",
      "access-control-allow-methods": "GET, POST, PUT",
      "access-control-allow-headers": "Authorization, Content-Type"
    });

    const analysis = analyzeCorsConfiguration(headers);

    expect(analysis.allowsAnyOrigin).toBe(true);
    expect(analysis.allowsCredentials).toBe(true);
    expect(analysis.isOverlyPermissive).toBe(true);
    expect(analysis.score).toBe(0);
    expect(analysis.maxScore).toBe(CORS_MAX_SCORE);
    expect(analysis.findings.some((finding) => finding.severity === "critical")).toBe(true);
  });

  it("marks restrictive CORS as healthy", () => {
    const headers = new Headers({
      "access-control-allow-origin": "https://app.example.com",
      "access-control-allow-methods": "GET, POST",
      "access-control-allow-headers": "Content-Type",
      "access-control-allow-credentials": "false"
    });

    const analysis = analyzeCorsConfiguration(headers);

    expect(analysis.findings).toHaveLength(0);
    expect(analysis.score).toBe(CORS_MAX_SCORE);
    expect(analysis.grade).toBe("A");
    expect(analysis.isOverlyPermissive).toBe(false);
    expect(analysis.summary).toContain("reasonably restrictive");
  });

  it("handles absent CORS headers as restricted by default", () => {
    const analysis = analyzeCorsConfiguration(new Headers());
    expect(analysis.findings).toHaveLength(0);
    expect(analysis.score).toBe(CORS_MAX_SCORE);
    expect(analysis.summary).toContain("No CORS headers were returned");
  });

  it("flags wildcard methods and headers as overly permissive", () => {
    const headers = new Headers({
      "access-control-allow-origin": "https://app.example.com",
      "access-control-allow-methods": "*",
      "access-control-allow-headers": "*"
    });

    const analysis = analyzeCorsConfiguration(headers);
    const findingIds = analysis.findings.map((finding) => finding.id);
    expect(findingIds).toContain("wildcard-methods");
    expect(findingIds).toContain("wildcard-headers");
    expect(analysis.isOverlyPermissive).toBe(true);
    expect(analysis.score).toBeLessThan(CORS_MAX_SCORE);
  });
});

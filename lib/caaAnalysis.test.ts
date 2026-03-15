import { describe, expect, it } from "vitest";
import { analyzeCaaConfiguration, buildCaaAnalysisFromProbe, CAA_MAX_SCORE, type CaaProbeResult } from "@/lib/caaAnalysis";

function buildProbe(overrides: Partial<CaaProbeResult> = {}): CaaProbeResult {
  return {
    hostname: "example.com",
    records: [
      {
        critical: 0,
        issue: "letsencrypt.org",
        issuewild: "letsencrypt.org",
        iodef: "mailto:security@example.com"
      }
    ],
    queryError: null,
    ...overrides
  };
}

describe("buildCaaAnalysisFromProbe", () => {
  it("scores highest when CAA restricts issuance to specific CAs", () => {
    const analysis = buildCaaAnalysisFromProbe(buildProbe());
    expect(analysis.hasRecords).toBe(true);
    expect(analysis.restrictsIssuance).toBe(true);
    expect(analysis.specificCaOnly).toBe(true);
    expect(analysis.score).toBe(CAA_MAX_SCORE);
    expect(analysis.maxScore).toBe(CAA_MAX_SCORE);
  });

  it("flags missing CAA records", () => {
    const analysis = buildCaaAnalysisFromProbe(
      buildProbe({
        records: [],
        queryError: "ENODATA"
      })
    );
    expect(analysis.hasRecords).toBe(false);
    expect(analysis.findings.some((finding) => finding.id === "caa-missing")).toBe(true);
    expect(analysis.score).toBe(0);
  });

  it("flags permissive CAA issue directives", () => {
    const analysis = buildCaaAnalysisFromProbe(
      buildProbe({
        records: [
          {
            critical: 0,
            issue: ";",
            iodef: "mailto:security@example.com"
          }
        ]
      })
    );
    expect(analysis.restrictsIssuance).toBe(false);
    expect(analysis.findings.some((finding) => finding.id === "caa-allows-any-ca")).toBe(true);
  });
});

describe("analyzeCaaConfiguration", () => {
  it("returns non-applicable analysis for IP targets", async () => {
    const analysis = await analyzeCaaConfiguration("https://1.1.1.1/");
    expect(analysis.available).toBe(false);
    expect(analysis.maxScore).toBe(0);
    expect(analysis.grade).toBe("N/A");
  });
});

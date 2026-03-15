import { describe, expect, it } from "vitest";
import {
  analyzeDnssecConfiguration,
  buildDnssecAnalysisFromProbe,
  DNSSEC_MAX_SCORE,
  type DnssecProbeResult
} from "@/lib/dnssecAnalysis";

function buildProbe(overrides: Partial<DnssecProbeResult> = {}): DnssecProbeResult {
  return {
    hostname: "example.com",
    dnskeyRecords: [{ flags: 257, protocol: 3, algorithm: 13 }],
    dsRecords: [{ keyTag: 12345, algorithm: 13, digestType: 2 }],
    dnskeyError: null,
    dsError: null,
    ...overrides
  };
}

describe("buildDnssecAnalysisFromProbe", () => {
  it("returns enabled when DNSKEY and DS records are both present", () => {
    const analysis = buildDnssecAnalysisFromProbe(buildProbe());
    expect(analysis.status).toBe("enabled");
    expect(analysis.chainValid).toBe(true);
    expect(analysis.score).toBe(DNSSEC_MAX_SCORE);
    expect(analysis.maxScore).toBe(DNSSEC_MAX_SCORE);
    expect(analysis.findings).toEqual([]);
  });

  it("returns partial when zone is signed but DS is missing", () => {
    const analysis = buildDnssecAnalysisFromProbe(
      buildProbe({
        dsRecords: [],
        dsError: "ENODATA"
      })
    );

    expect(analysis.status).toBe("partial");
    expect(analysis.zoneSigned).toBe(true);
    expect(analysis.parentHasDs).toBe(false);
    expect(analysis.findings.some((finding) => finding.id === "dnssec-chain-incomplete")).toBe(true);
  });

  it("returns disabled when DNSKEY and DS are both missing", () => {
    const analysis = buildDnssecAnalysisFromProbe(
      buildProbe({
        dnskeyRecords: [],
        dsRecords: [],
        dnskeyError: "ENODATA",
        dsError: "ENODATA"
      })
    );

    expect(analysis.status).toBe("disabled");
    expect(analysis.score).toBe(0);
    expect(analysis.findings.some((finding) => finding.id === "dnssec-disabled")).toBe(true);
  });
});

describe("analyzeDnssecConfiguration", () => {
  it("returns non-applicable analysis for IP targets", async () => {
    const analysis = await analyzeDnssecConfiguration("https://1.1.1.1/");
    expect(analysis.available).toBe(false);
    expect(analysis.maxScore).toBe(0);
    expect(analysis.grade).toBe("N/A");
  });
});

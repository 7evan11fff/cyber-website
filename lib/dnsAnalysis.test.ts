import { describe, expect, it } from "vitest";
import { analyzeDnsConfiguration, buildDnsAnalysisFromProbe, DNS_MAX_SCORE, type DnsProbeResult } from "@/lib/dnsAnalysis";

function buildProbe(overrides: Partial<DnsProbeResult> = {}): DnsProbeResult {
  return {
    hostname: "example.com",
    lookupSuccessful: true,
    lookupError: null,
    dnssecStatus: "configured",
    dnssecEvidence: "2 DNSKEY records",
    caaRecords: ["issue letsencrypt.org"],
    spfRecords: ["v=spf1 include:_spf.google.com -all"],
    dmarcRecords: ["v=DMARC1; p=reject; pct=100"],
    mxHosts: ["mx1.example.com"],
    timings: {
      lookupMs: 30,
      dnssecMs: 42,
      caaMs: 35,
      spfMs: 40,
      dmarcMs: 39,
      mxMs: 27,
      averageMs: 36
    },
    ...overrides
  };
}

describe("buildDnsAnalysisFromProbe", () => {
  it("returns an A for strong DNS security controls", () => {
    const analysis = buildDnsAnalysisFromProbe(buildProbe());
    expect(analysis.score).toBe(DNS_MAX_SCORE);
    expect(analysis.maxScore).toBe(DNS_MAX_SCORE);
    expect(analysis.grade).toBe("A");
    expect(analysis.findings).toEqual([]);
  });

  it("flags missing DNSSEC, CAA, SPF, and DMARC for email-capable domains", () => {
    const analysis = buildDnsAnalysisFromProbe(
      buildProbe({
        dnssecStatus: "not-configured",
        dnssecEvidence: "ENODATA",
        caaRecords: [],
        spfRecords: [],
        dmarcRecords: [],
        mxHosts: ["mx1.example.com"]
      })
    );

    const findingIds = analysis.findings.map((finding) => finding.id);
    expect(findingIds).toContain("dnssec-not-configured");
    expect(findingIds).toContain("caa-record-missing");
    expect(findingIds).toContain("spf-missing");
    expect(findingIds).toContain("dmarc-missing");
    expect(analysis.maxScore).toBe(10);
  });

  it("flags permissive SPF and monitor-only DMARC", () => {
    const analysis = buildDnsAnalysisFromProbe(
      buildProbe({
        spfRecords: ["v=spf1 +all"],
        dmarcRecords: ["v=DMARC1; p=none; pct=100"]
      })
    );

    expect(analysis.spfPolicy).toBe("allow-all");
    expect(analysis.dmarcPolicy).toBe("none");
    expect(analysis.findings.some((finding) => finding.id === "spf-allow-all")).toBe(true);
    expect(analysis.findings.some((finding) => finding.id === "dmarc-monitor-only")).toBe(true);
  });

  it("does not penalize SPF/DMARC when email controls are not applicable", () => {
    const analysis = buildDnsAnalysisFromProbe(
      buildProbe({
        spfRecords: [],
        dmarcRecords: [],
        mxHosts: []
      })
    );

    expect(analysis.emailSecurityApplicable).toBe(false);
    expect(analysis.maxScore).toBe(5);
    expect(analysis.findings.some((finding) => finding.id === "spf-missing")).toBe(false);
    expect(analysis.findings.some((finding) => finding.id === "dmarc-missing")).toBe(false);
  });

  it("flags malformed DMARC records", () => {
    const analysis = buildDnsAnalysisFromProbe(
      buildProbe({
        dmarcRecords: ["v=DMARC1; rua=mailto:reports@example.com"]
      })
    );

    expect(analysis.dmarcPolicy).toBe("invalid");
    expect(analysis.findings.some((finding) => finding.id === "dmarc-invalid")).toBe(true);
  });

  it("reports elevated DNS response-time findings", () => {
    const analysis = buildDnsAnalysisFromProbe(
      buildProbe({
        timings: {
          lookupMs: 1200,
          dnssecMs: 1600,
          caaMs: 1400,
          spfMs: 1700,
          dmarcMs: 1800,
          mxMs: 1300,
          averageMs: 1501
        }
      })
    );

    expect(analysis.findings.some((finding) => finding.id === "dns-response-very-slow")).toBe(true);
  });
});

describe("analyzeDnsConfiguration", () => {
  it("returns a non-applicable analysis for direct IP targets", async () => {
    const analysis = await analyzeDnsConfiguration("https://1.1.1.1/");
    expect(analysis.available).toBe(false);
    expect(analysis.maxScore).toBe(0);
    expect(analysis.grade).toBe("N/A");
  });
});

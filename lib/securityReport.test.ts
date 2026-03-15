import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const { mockAnalyzeTlsConfiguration } = vi.hoisted(() => ({
  mockAnalyzeTlsConfiguration: vi.fn()
}));
const { mockAnalyzeDnsConfiguration } = vi.hoisted(() => ({
  mockAnalyzeDnsConfiguration: vi.fn()
}));

vi.mock("@/lib/tlsAnalysis", () => ({
  analyzeTlsConfiguration: mockAnalyzeTlsConfiguration
}));
vi.mock("@/lib/dnsAnalysis", () => ({
  analyzeDnsConfiguration: mockAnalyzeDnsConfiguration
}));

import {
  BADGE_CACHE_TTL_MS,
  cacheDomainReport,
  generateReport,
  getCachedDomainReport,
  getOrCreateDomainReport,
  normalizeDomain,
  normalizeTargetUrl,
  runSecurityScan,
  type SecurityReport
} from "@/lib/securityReport";

function buildReport(domain: string): SecurityReport {
  return {
    checkedUrl: `https://${domain}/`,
    finalUrl: `https://${domain}/`,
    statusCode: 200,
    score: 10,
    maxScore: 20,
    grade: "C",
    results: [],
    cookieAnalysis: {
      cookies: [],
      cookieCount: 0,
      score: 0,
      maxScore: 0,
      grade: "N/A",
      summary: "No Set-Cookie headers were returned by the scanned response."
    },
    corsAnalysis: {
      allowOrigin: null,
      allowMethods: null,
      allowHeaders: null,
      allowCredentials: null,
      allowsAnyOrigin: false,
      allowsCredentials: false,
      isOverlyPermissive: false,
      score: 4,
      maxScore: 4,
      grade: "A",
      findings: [],
      summary: "No CORS headers were returned. Cross-origin access is likely restricted by default."
    },
    tlsAnalysis: {
      available: true,
      checkedHostname: domain,
      checkedPort: 443,
      tlsVersion: "TLSv1.3",
      isInsecureTlsVersion: false,
      prefersTls13: true,
      cipherName: "TLS_AES_256_GCM_SHA384",
      cipherVersion: "TLSv1.3",
      weakAlgorithms: [],
      issuer: "Let's Encrypt",
      issuerCategory: "Let's Encrypt",
      subject: domain,
      validFrom: "Jan 01 00:00:00 2025 GMT",
      validTo: "Jan 01 00:00:00 2027 GMT",
      daysUntilExpiration: 365,
      certificateValid: true,
      certificateExpired: false,
      certificateExpiringSoon: false,
      chainComplete: true,
      chainLength: 3,
      selfSigned: false,
      authorized: true,
      authorizationError: null,
      score: 10,
      maxScore: 10,
      grade: "A",
      findings: [],
      summary: "TLS configuration appears healthy with a valid certificate."
    },
    dnsAnalysis: {
      available: true,
      checkedHostname: domain,
      dnssecStatus: "configured",
      hasCaa: true,
      caaRecords: ["issue letsencrypt.org"],
      spfRecord: "v=spf1 include:_spf.google.com -all",
      spfRecords: ["v=spf1 include:_spf.google.com -all"],
      spfPolicy: "hard-fail",
      dmarcRecord: "v=DMARC1; p=reject; pct=100",
      dmarcRecords: ["v=DMARC1; p=reject; pct=100"],
      dmarcPolicy: "reject",
      dmarcPct: 100,
      emailSecurityApplicable: true,
      mxHosts: ["mx.example.com"],
      responseTimes: {
        lookupMs: 20,
        dnssecMs: 28,
        caaMs: 25,
        spfMs: 23,
        dmarcMs: 24,
        mxMs: 19,
        averageMs: 23
      },
      score: 10,
      maxScore: 10,
      grade: "A",
      findings: [],
      summary: "DNS posture looks healthy with DNSSEC, CAA, SPF, and DMARC controls in a secure state."
    },
    checkedAt: new Date().toISOString(),
    framework: {
      server: "nginx",
      poweredBy: null,
      detected: {
        id: "nginx",
        label: "Nginx",
        reason: "Detected from Server response header.",
        evidence: [{ header: "server", value: "nginx" }]
      }
    },
    responseTimeMs: 120,
    scanDurationMs: 120
  };
}

describe("securityReport", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
    mockAnalyzeTlsConfiguration.mockResolvedValue({
      available: true,
      checkedHostname: "example.com",
      checkedPort: 443,
      tlsVersion: "TLSv1.3",
      isInsecureTlsVersion: false,
      prefersTls13: true,
      cipherName: "TLS_AES_256_GCM_SHA384",
      cipherVersion: "TLSv1.3",
      weakAlgorithms: [],
      issuer: "Let's Encrypt",
      issuerCategory: "Let's Encrypt",
      subject: "example.com",
      validFrom: "Jan 01 00:00:00 2025 GMT",
      validTo: "Jan 01 00:00:00 2027 GMT",
      daysUntilExpiration: 365,
      certificateValid: true,
      certificateExpired: false,
      certificateExpiringSoon: false,
      chainComplete: true,
      chainLength: 3,
      selfSigned: false,
      authorized: true,
      authorizationError: null,
      score: 10,
      maxScore: 10,
      grade: "A",
      findings: [],
      summary: "TLS configuration appears healthy with a valid certificate."
    });
    mockAnalyzeDnsConfiguration.mockResolvedValue({
      available: true,
      checkedHostname: "example.com",
      dnssecStatus: "configured",
      hasCaa: true,
      caaRecords: ["issue letsencrypt.org"],
      spfRecord: "v=spf1 include:_spf.google.com -all",
      spfRecords: ["v=spf1 include:_spf.google.com -all"],
      spfPolicy: "hard-fail",
      dmarcRecord: "v=DMARC1; p=reject; pct=100",
      dmarcRecords: ["v=DMARC1; p=reject; pct=100"],
      dmarcPolicy: "reject",
      dmarcPct: 100,
      emailSecurityApplicable: true,
      mxHosts: ["mx.example.com"],
      responseTimes: {
        lookupMs: 20,
        dnssecMs: 28,
        caaMs: 25,
        spfMs: 23,
        dmarcMs: 24,
        mxMs: 19,
        averageMs: 23
      },
      score: 10,
      maxScore: 10,
      grade: "A",
      findings: [],
      summary: "DNS posture looks healthy with DNSSEC, CAA, SPF, and DMARC controls in a secure state."
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("normalizes scan targets", () => {
    expect(normalizeTargetUrl("  example.com ")).toBe("https://example.com/");
    expect(normalizeTargetUrl("http://Example.com/path")).toBe("http://example.com/path");
    expect(() => normalizeTargetUrl("   ")).toThrow("Please enter a URL.");
    expect(() => normalizeTargetUrl("not a url with spaces")).toThrow("Please enter a valid URL.");
  });

  it("normalizes domains and handles URL-encoded input", () => {
    expect(normalizeDomain("https://EXAMPLE.com/path")).toBe("example.com");
    expect(normalizeDomain("Example.com")).toBe("example.com");
    expect(normalizeDomain("example.com%2Ftest")).toBe("example.com");
    expect(() => normalizeDomain("")).toThrow("Please provide a valid domain.");
  });

  it("returns cached reports only while cache entry is fresh", () => {
    const cachedDomain = "cache-fresh.example";
    const report = buildReport(cachedDomain);
    cacheDomainReport(report);

    expect(getCachedDomainReport(cachedDomain)).toEqual(report);

    vi.advanceTimersByTime(BADGE_CACHE_TTL_MS + 1);
    expect(getCachedDomainReport(cachedDomain)).toBeNull();
  });

  it("reuses cache for getOrCreateDomainReport", async () => {
    const cachedDomain = "cache-hit.example";
    const report = buildReport(cachedDomain);
    cacheDomainReport(report);

    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const resolved = await getOrCreateDomainReport(cachedDomain);

    expect(resolved).toEqual(report);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("generates reports by scanning upstream headers", async () => {
    const headers = new Headers({
      "content-security-policy": "default-src 'self'",
      "x-frame-options": "DENY",
      "x-content-type-options": "nosniff",
      server: "nginx"
    });
    headers.append("set-cookie", "session=abc; Path=/auth; HttpOnly; Secure; SameSite=Strict");

    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      headers,
      url: "https://example.com/",
      status: 200
    } as Response);

    const report = await generateReport("example.com");

    expect(fetchMock).toHaveBeenCalledWith(
      "https://example.com/",
      expect.objectContaining({
        method: "GET",
        redirect: "follow",
        cache: "no-store"
      })
    );
    expect(report.checkedUrl).toBe("https://example.com/");
    expect(report.finalUrl).toBe("https://example.com/");
    expect(report.results).toHaveLength(11);
    expect(report.cookieAnalysis.cookieCount).toBe(1);
    expect(report.corsAnalysis.maxScore).toBe(4);
    expect(report.tlsAnalysis.maxScore).toBe(10);
    expect(report.dnsAnalysis.maxScore).toBe(10);
    expect(mockAnalyzeTlsConfiguration).toHaveBeenCalledWith("https://example.com/", {
      timeoutMs: 10000
    });
    expect(mockAnalyzeDnsConfiguration).toHaveBeenCalledWith("https://example.com/");
    expect(report.responseTimeMs).toBeGreaterThanOrEqual(0);
    expect(report.scanDurationMs).toBe(report.responseTimeMs);
    expect(report.score).toBeGreaterThan(0);
    expect(report.maxScore).toBeGreaterThanOrEqual(report.score);
    expect(["A", "B", "C", "D", "F"]).toContain(report.grade);
    expect(report.framework.detected?.id).toBe("nginx");
  });

  it("supports custom scan options for user agent, timeout, and redirects", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      headers: new Headers({
        "x-frame-options": "DENY"
      }),
      url: "https://example.com/",
      status: 302
    } as Response);

    await runSecurityScan("example.com", {
      userAgent: "Mozilla/5.0 ExampleAgent",
      followRedirects: false,
      timeoutMs: 5000
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://example.com/",
      expect.objectContaining({
        redirect: "manual",
        headers: expect.objectContaining({
          "user-agent": "Mozilla/5.0 ExampleAgent"
        })
      })
    );
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const { mockAnalyzeTlsConfiguration } = vi.hoisted(() => ({
  mockAnalyzeTlsConfiguration: vi.fn()
}));
const { mockAnalyzeDnsConfiguration } = vi.hoisted(() => ({
  mockAnalyzeDnsConfiguration: vi.fn()
}));
const { mockAnalyzeDnssecConfiguration } = vi.hoisted(() => ({
  mockAnalyzeDnssecConfiguration: vi.fn()
}));
const { mockAnalyzeCaaConfiguration } = vi.hoisted(() => ({
  mockAnalyzeCaaConfiguration: vi.fn()
}));
const { mockAnalyzeSubresourceIntegrity } = vi.hoisted(() => ({
  mockAnalyzeSubresourceIntegrity: vi.fn()
}));
const { mockAnalyzeSecurityTxt } = vi.hoisted(() => ({
  mockAnalyzeSecurityTxt: vi.fn()
}));
const { mockAnalyzeEmailSecurity } = vi.hoisted(() => ({
  mockAnalyzeEmailSecurity: vi.fn()
}));
const { mockAnalyzeMixedContent } = vi.hoisted(() => ({
  mockAnalyzeMixedContent: vi.fn()
}));
const { mockAnalyzeHstsPreloadStatus } = vi.hoisted(() => ({
  mockAnalyzeHstsPreloadStatus: vi.fn()
}));

vi.mock("@/lib/tlsAnalysis", () => ({
  analyzeTlsConfiguration: mockAnalyzeTlsConfiguration
}));
vi.mock("@/lib/dnsAnalysis", () => ({
  analyzeDnsConfiguration: mockAnalyzeDnsConfiguration
}));
vi.mock("@/lib/dnssecAnalysis", () => ({
  analyzeDnssecConfiguration: mockAnalyzeDnssecConfiguration
}));
vi.mock("@/lib/caaAnalysis", () => ({
  analyzeCaaConfiguration: mockAnalyzeCaaConfiguration
}));
vi.mock("@/lib/sriAnalysis", () => ({
  analyzeSubresourceIntegrity: mockAnalyzeSubresourceIntegrity
}));
vi.mock("@/lib/securityTxtAnalysis", () => ({
  analyzeSecurityTxt: mockAnalyzeSecurityTxt
}));
vi.mock("@/lib/emailSecurityAnalysis", () => ({
  analyzeEmailSecurity: mockAnalyzeEmailSecurity
}));
vi.mock("@/lib/mixedContentAnalysis", () => ({
  analyzeMixedContent: mockAnalyzeMixedContent,
  buildUnavailableMixedContentAnalysis: vi.fn((scannedUrl: string | null, finalUrl: string | null) => ({
    available: false,
    scannedUrl,
    finalUrl,
    isHttpsPage: false,
    totalMixedContentCount: 0,
    activeCount: 0,
    passiveCount: 0,
    score: 0,
    maxScore: 0,
    grade: "N/A",
    findings: [],
    recommendations: ["Scan an HTML page over HTTPS to evaluate mixed-content exposure."],
    summary: "Mixed content analysis was unavailable for this response."
  }))
}));
vi.mock("@/lib/hstsPreloadAnalysis", () => ({
  analyzeHstsPreloadStatus: mockAnalyzeHstsPreloadStatus
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
    dnssecAnalysis: {
      available: true,
      checkedHostname: domain,
      status: "enabled",
      zoneSigned: true,
      parentHasDs: true,
      chainValid: true,
      dnskeyRecordCount: 2,
      dsRecordCount: 1,
      dnskeyRecords: ["flags=257, protocol=3, algorithm=13"],
      dsRecords: ["keyTag=12345, algorithm=13, digestType=2"],
      queryErrors: {
        dnskey: null,
        ds: null
      },
      score: 3,
      maxScore: 3,
      grade: "A",
      findings: [],
      summary: "DNSSEC is enabled with both DNSKEY and DS records present."
    },
    caaAnalysis: {
      available: true,
      checkedHostname: domain,
      hasRecords: true,
      restrictsIssuance: true,
      specificCaOnly: true,
      allowedCertificateAuthorities: ["letsencrypt.org"],
      directives: [
        {
          tag: "issue",
          value: "letsencrypt.org",
          critical: false,
          meaning: "Authorizes this CA to issue certificates for the domain."
        },
        {
          tag: "iodef",
          value: "mailto:security@example.com",
          critical: false,
          meaning: "Specifies where CAA incident reports should be sent."
        }
      ],
      score: 3,
      maxScore: 3,
      grade: "A",
      findings: [],
      summary: "CAA records are present and restrict issuance to specific certificate authorities."
    },
    emailSecurityAnalysis: {
      domain: domain.toLowerCase(),
      spf: {
        domain: domain.toLowerCase(),
        record: "v=spf1 include:_spf.google.com -all",
        records: ["v=spf1 include:_spf.google.com -all"],
        policy: "hard-fail",
        dnsLookupCount: 1,
        tooManyLookups: false,
        lookupLimit: 10,
        notes: []
      },
      dmarc: {
        domain: domain.toLowerCase(),
        record: "v=DMARC1; p=reject; rua=mailto:dmarc@example.com",
        records: ["v=DMARC1; p=reject; rua=mailto:dmarc@example.com"],
        policy: "reject",
        rua: ["mailto:dmarc@example.com"],
        ruf: [],
        pct: null,
        hasReporting: true,
        notes: []
      },
      dkim: {
        testedSelectors: ["google", "selector1", "selector2", "default", "mail"],
        selectors: [],
        presentSelectors: ["google"],
        present: true
      },
      score: 30,
      maxScore: 30,
      findings: [],
      recommendations: []
    },
    mixedContentAnalysis: {
      available: true,
      scannedUrl: `https://${domain}/`,
      finalUrl: `https://${domain}/`,
      isHttpsPage: true,
      totalMixedContentCount: 0,
      activeCount: 0,
      passiveCount: 0,
      score: 10,
      maxScore: 10,
      grade: "A",
      findings: [],
      recommendations: ["Prefer explicit HTTPS URLs for all external resources."],
      summary: "No mixed-content HTTP resource references were detected on this HTTPS page."
    },
    sriAnalysis: {
      available: true,
      scannedUrl: `https://${domain}/`,
      finalUrl: `https://${domain}/`,
      externalResourceCount: 2,
      protectedResourceCount: 2,
      missingIntegrityCount: 0,
      missingCrossoriginCount: 0,
      coveragePercent: 100,
      crossoriginCoveragePercent: 100,
      score: 8,
      maxScore: 8,
      grade: "A",
      findings: [],
      resources: [],
      summary: "All detected external scripts and stylesheets include SRI hashes and crossorigin attributes."
    },
    securityTxtAnalysis: {
      available: true,
      checkedUrl: `https://${domain}/`,
      fetchedUrl: `https://${domain}/.well-known/security.txt`,
      fetchedFrom: "/.well-known/security.txt",
      fallbackUsed: false,
      statusCode: 200,
      fields: {
        contact: ["mailto:security@example.com"],
        expires: "2027-01-01T00:00:00Z",
        encryption: [],
        acknowledgments: [],
        preferredLanguages: ["en"],
        canonical: [`https://${domain}/.well-known/security.txt`],
        policy: [`https://${domain}/security-policy`],
        hiring: []
      },
      foundFields: ["contact", "expires", "preferredLanguages", "canonical", "policy"],
      validation: {
        present: true,
        usesHttps: true,
        hasContact: true,
        hasExpires: true,
        expiresValidFormat: true,
        expiresExpired: false,
        expiresExpiringSoon: false,
        isValid: true
      },
      warnings: [],
      recommendations: [],
      score: 1,
      maxScore: 1,
      grade: "A",
      summary: "security.txt is present, served over HTTPS, and includes valid Contact and Expires metadata."
    },
    hstsPreloadAnalysis: {
      available: true,
      checkedDomain: domain.toLowerCase(),
      apiStatus: "preloaded",
      status: "preloaded",
      eligibility: "unknown",
      onPreloadList: true,
      submissionUrl: `https://hstspreload.org/?domain=${encodeURIComponent(domain.toLowerCase())}`,
      header: {
        raw: "max-age=63072000; includeSubDomains; preload",
        hasHeader: true,
        maxAge: 63072000,
        hasSufficientMaxAge: true,
        hasIncludeSubDomains: true,
        hasPreloadDirective: true
      },
      requirements: [
        {
          id: "max-age",
          label: "max-age >= 31536000",
          passed: true,
          details: "Detected max-age=63072000."
        },
        {
          id: "include-subdomains",
          label: "includeSubDomains directive",
          passed: true,
          details: "includeSubDomains directive detected."
        },
        {
          id: "preload-directive",
          label: "preload directive",
          passed: true,
          details: "preload directive detected."
        }
      ],
      apiErrors: [],
      apiWarnings: [],
      findings: [
        {
          id: "hsts-preload-preloaded",
          severity: "info",
          message: "Domain is preloaded in major browsers.",
          recommendation: "Maintain strict HTTPS posture across all subdomains."
        }
      ],
      recommendations: [
        "Keep Strict-Transport-Security enabled with includeSubDomains and preload to remain eligible."
      ],
      score: 3,
      maxScore: 3,
      grade: "A",
      summary: `${domain.toLowerCase()} is currently included in the HSTS preload list.`
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
    mockAnalyzeDnssecConfiguration.mockResolvedValue({
      available: true,
      checkedHostname: "example.com",
      status: "enabled",
      zoneSigned: true,
      parentHasDs: true,
      chainValid: true,
      dnskeyRecordCount: 2,
      dsRecordCount: 1,
      dnskeyRecords: ["flags=257, protocol=3, algorithm=13"],
      dsRecords: ["keyTag=12345, algorithm=13, digestType=2"],
      queryErrors: {
        dnskey: null,
        ds: null
      },
      score: 3,
      maxScore: 3,
      grade: "A",
      findings: [],
      summary: "DNSSEC is enabled with both DNSKEY and DS records present."
    });
    mockAnalyzeCaaConfiguration.mockResolvedValue({
      available: true,
      checkedHostname: "example.com",
      hasRecords: true,
      restrictsIssuance: true,
      specificCaOnly: true,
      allowedCertificateAuthorities: ["letsencrypt.org"],
      directives: [
        {
          tag: "issue",
          value: "letsencrypt.org",
          critical: false,
          meaning: "Authorizes this CA to issue certificates for the domain."
        },
        {
          tag: "iodef",
          value: "mailto:security@example.com",
          critical: false,
          meaning: "Specifies where CAA incident reports should be sent."
        }
      ],
      score: 3,
      maxScore: 3,
      grade: "A",
      findings: [],
      summary: "CAA records are present and restrict issuance to specific certificate authorities."
    });
    mockAnalyzeSubresourceIntegrity.mockResolvedValue({
      available: true,
      scannedUrl: "https://example.com/",
      finalUrl: "https://example.com/",
      externalResourceCount: 2,
      protectedResourceCount: 2,
      missingIntegrityCount: 0,
      missingCrossoriginCount: 0,
      coveragePercent: 100,
      crossoriginCoveragePercent: 100,
      score: 8,
      maxScore: 8,
      grade: "A",
      findings: [],
      resources: [],
      summary: "All detected external scripts and stylesheets include SRI hashes and crossorigin attributes."
    });
    mockAnalyzeEmailSecurity.mockResolvedValue({
      domain: "example.com",
      spf: {
        domain: "example.com",
        record: "v=spf1 include:_spf.google.com -all",
        records: ["v=spf1 include:_spf.google.com -all"],
        policy: "hard-fail",
        dnsLookupCount: 1,
        tooManyLookups: false,
        lookupLimit: 10,
        notes: []
      },
      dmarc: {
        domain: "example.com",
        record: "v=DMARC1; p=reject; rua=mailto:dmarc@example.com",
        records: ["v=DMARC1; p=reject; rua=mailto:dmarc@example.com"],
        policy: "reject",
        rua: ["mailto:dmarc@example.com"],
        ruf: [],
        pct: null,
        hasReporting: true,
        notes: []
      },
      dkim: {
        testedSelectors: ["google", "selector1", "selector2", "default", "mail"],
        selectors: [],
        presentSelectors: ["google"],
        present: true
      },
      score: 30,
      maxScore: 30,
      findings: [],
      recommendations: []
    });
    mockAnalyzeSecurityTxt.mockResolvedValue({
      available: true,
      checkedUrl: "https://example.com/",
      fetchedUrl: "https://example.com/.well-known/security.txt",
      fetchedFrom: "/.well-known/security.txt",
      fallbackUsed: false,
      statusCode: 200,
      fields: {
        contact: ["mailto:security@example.com"],
        expires: "2027-01-01T00:00:00Z",
        encryption: [],
        acknowledgments: [],
        preferredLanguages: ["en"],
        canonical: ["https://example.com/.well-known/security.txt"],
        policy: ["https://example.com/security-policy"],
        hiring: []
      },
      foundFields: ["contact", "expires", "preferredLanguages", "canonical", "policy"],
      validation: {
        present: true,
        usesHttps: true,
        hasContact: true,
        hasExpires: true,
        expiresValidFormat: true,
        expiresExpired: false,
        expiresExpiringSoon: false,
        isValid: true
      },
      warnings: [],
      recommendations: [],
      score: 1,
      maxScore: 1,
      grade: "A",
      summary: "security.txt is present, served over HTTPS, and includes valid Contact and Expires metadata."
    });
    mockAnalyzeHstsPreloadStatus.mockResolvedValue({
      available: true,
      checkedDomain: "example.com",
      apiStatus: "preloaded",
      status: "preloaded",
      eligibility: "unknown",
      onPreloadList: true,
      submissionUrl: "https://hstspreload.org/?domain=example.com",
      header: {
        raw: "max-age=63072000; includeSubDomains; preload",
        hasHeader: true,
        maxAge: 63072000,
        hasSufficientMaxAge: true,
        hasIncludeSubDomains: true,
        hasPreloadDirective: true
      },
      requirements: [
        {
          id: "max-age",
          label: "max-age >= 31536000",
          passed: true,
          details: "Detected max-age=63072000."
        },
        {
          id: "include-subdomains",
          label: "includeSubDomains directive",
          passed: true,
          details: "includeSubDomains directive detected."
        },
        {
          id: "preload-directive",
          label: "preload directive",
          passed: true,
          details: "preload directive detected."
        }
      ],
      apiErrors: [],
      apiWarnings: [],
      findings: [
        {
          id: "hsts-preload-preloaded",
          severity: "info",
          message: "Domain is preloaded in major browsers.",
          recommendation: "Maintain strict HTTPS posture across all subdomains."
        }
      ],
      recommendations: [
        "Keep Strict-Transport-Security enabled with includeSubDomains and preload to remain eligible."
      ],
      score: 3,
      maxScore: 3,
      grade: "A",
      summary: "example.com is currently included in the HSTS preload list."
    });
    mockAnalyzeMixedContent.mockReturnValue({
      available: true,
      scannedUrl: "https://example.com/",
      finalUrl: "https://example.com/",
      isHttpsPage: true,
      totalMixedContentCount: 0,
      activeCount: 0,
      passiveCount: 0,
      score: 10,
      maxScore: 10,
      grade: "A",
      findings: [],
      recommendations: ["Prefer explicit HTTPS URLs for all external resources."],
      summary: "No mixed-content HTTP resource references were detected on this HTTPS page."
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
      "content-type": "text/html; charset=utf-8",
      server: "nginx"
    });
    headers.append("set-cookie", "session=abc; Path=/auth; HttpOnly; Secure; SameSite=Strict");

    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      headers,
      url: "https://example.com/",
      status: 200,
      text: vi.fn().mockResolvedValue("<html><head></head><body></body></html>")
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
    expect(report.dnssecAnalysis.maxScore).toBe(3);
    expect(report.caaAnalysis.maxScore).toBe(3);
    expect(report.sriAnalysis.maxScore).toBe(8);
    expect(report.mixedContentAnalysis.maxScore).toBe(10);
    expect(report.securityTxtAnalysis.maxScore).toBe(1);
    expect(report.hstsPreloadAnalysis.maxScore).toBe(3);
    expect(report.emailSecurityAnalysis.maxScore).toBe(30);
    expect(mockAnalyzeTlsConfiguration).toHaveBeenCalledWith("https://example.com/", {
      timeoutMs: 10000
    });
    expect(mockAnalyzeDnsConfiguration).toHaveBeenCalledWith("https://example.com/");
    expect(mockAnalyzeDnssecConfiguration).toHaveBeenCalledWith("https://example.com/");
    expect(mockAnalyzeCaaConfiguration).toHaveBeenCalledWith("https://example.com/");
    expect(mockAnalyzeSubresourceIntegrity).toHaveBeenCalledWith(
      "https://example.com/",
      expect.objectContaining({
        timeoutMs: 10000,
        followRedirects: true
      })
    );
    expect(mockAnalyzeSecurityTxt).toHaveBeenCalledWith(
      "https://example.com/",
      expect.objectContaining({
        timeoutMs: 10000,
        followRedirects: true
      })
    );
    expect(mockAnalyzeHstsPreloadStatus).toHaveBeenCalledWith(
      "https://example.com/",
      null,
      expect.objectContaining({
        timeoutMs: 10000
      })
    );
    expect(mockAnalyzeEmailSecurity).toHaveBeenCalledWith("example.com");
    expect(mockAnalyzeMixedContent).toHaveBeenCalled();
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

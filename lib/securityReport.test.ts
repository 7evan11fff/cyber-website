import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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
    }
  };
}

describe("securityReport", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
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

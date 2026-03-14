import { calculateGrade } from "@/lib/grading";
import { analyzeSecurityHeaders, type HeaderResult } from "@/lib/securityHeaders";

const REQUEST_TIMEOUT_MS = 12000;
export const BADGE_CACHE_TTL_MS = 1000 * 60 * 60 * 24;

type CachedDomainReport = {
  report: SecurityReport;
  cachedAtMs: number;
};

export type SecurityReport = {
  checkedUrl: string;
  finalUrl: string;
  statusCode: number;
  score: number;
  grade: string;
  results: HeaderResult[];
  checkedAt: string;
};

const domainBadgeCache = new Map<string, CachedDomainReport>();

export function normalizeTargetUrl(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) {
    throw new Error("Please enter a URL.");
  }

  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;

  try {
    const parsed = new URL(withProtocol);
    if (!["http:", "https:"].includes(parsed.protocol)) {
      throw new Error("Only http and https URLs are supported.");
    }
    return parsed.toString();
  } catch {
    throw new Error("Please enter a valid URL.");
  }
}

export function normalizeDomain(input: string): string {
  try {
    const trimmed = decodeURIComponent(input).trim();
    if (!trimmed) {
      throw new Error("Please provide a domain.");
    }

    const candidate = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    const parsed = new URL(candidate);
    if (!parsed.hostname) {
      throw new Error("Please provide a valid domain.");
    }
    return parsed.hostname.toLowerCase();
  } catch {
    throw new Error("Please provide a valid domain.");
  }
}

function reportDomain(report: SecurityReport) {
  const parsed = new URL(report.finalUrl);
  return parsed.hostname.toLowerCase();
}

export function cacheDomainReport(report: SecurityReport) {
  domainBadgeCache.set(reportDomain(report), {
    report,
    cachedAtMs: Date.now()
  });
}

export function getCachedDomainReport(domain: string): SecurityReport | null {
  const normalizedDomain = normalizeDomain(domain);
  const cached = domainBadgeCache.get(normalizedDomain);
  if (!cached) {
    return null;
  }

  const isFresh = Date.now() - cached.cachedAtMs < BADGE_CACHE_TTL_MS;
  if (!isFresh) {
    domainBadgeCache.delete(normalizedDomain);
    return null;
  }

  return cached.report;
}

export async function runSecurityScan(inputUrl: string): Promise<SecurityReport> {
  const targetUrl = normalizeTargetUrl(inputUrl);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let upstreamResponse: Response;
  try {
    upstreamResponse = await fetch(targetUrl, {
      method: "GET",
      redirect: "follow",
      cache: "no-store",
      signal: controller.signal,
      headers: {
        "user-agent": "SecurityHeaderChecker/1.0 (+https://vercel.com)"
      }
    });
  } finally {
    clearTimeout(timeout);
  }

  const results = analyzeSecurityHeaders(upstreamResponse.headers);
  const { score, grade } = calculateGrade(results);

  const report: SecurityReport = {
    checkedUrl: targetUrl,
    finalUrl: upstreamResponse.url,
    statusCode: upstreamResponse.status,
    score,
    grade,
    results,
    checkedAt: new Date().toISOString()
  };

  cacheDomainReport(report);
  return report;
}

export async function getOrCreateDomainReport(domain: string): Promise<SecurityReport> {
  const normalizedDomain = normalizeDomain(domain);
  const cached = getCachedDomainReport(normalizedDomain);
  if (cached) {
    return cached;
  }

  return runSecurityScan(normalizedDomain);
}

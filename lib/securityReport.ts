import { calculateGrade } from "@/lib/grading";
import { analyzeCorsConfiguration, type CorsAnalysis } from "@/lib/corsAnalysis";
import { analyzeCookieSecurity, type CookieSecurityAnalysis } from "@/lib/cookieSecurity";
import { analyzeDnsConfiguration, type DnsAnalysis } from "@/lib/dnsAnalysis";
import { detectFrameworkInfo, type FrameworkInfo } from "@/lib/frameworkDetection";
import { analyzeSecurityHeaders, type HeaderResult } from "@/lib/securityHeaders";
import { analyzeTlsConfiguration, type TlsAnalysis } from "@/lib/tlsAnalysis";

const DEFAULT_REQUEST_TIMEOUT_MS = 10000;
const DEFAULT_SCANNER_USER_AGENT = "SecurityHeaderChecker/1.0 (+https://vercel.com)";
export const BADGE_CACHE_TTL_MS = 1000 * 60 * 60 * 24;

export type SecurityScanOptions = {
  userAgent?: string;
  followRedirects?: boolean;
  timeoutMs?: 5000 | 10000 | 15000;
};

type CachedDomainReport = {
  report: SecurityReport;
  cachedAtMs: number;
};

export type SecurityReport = {
  checkedUrl: string;
  finalUrl: string;
  statusCode: number;
  score: number;
  maxScore: number;
  grade: string;
  results: HeaderResult[];
  cookieAnalysis: CookieSecurityAnalysis;
  corsAnalysis: CorsAnalysis;
  tlsAnalysis: TlsAnalysis;
  dnsAnalysis: DnsAnalysis;
  checkedAt: string;
  framework: FrameworkInfo;
  responseTimeMs: number;
  scanDurationMs: number;
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
  } catch (error) {
    if (error instanceof Error && error.message === "Only http and https URLs are supported.") {
      throw error;
    }
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

function normalizeScanOptions(options?: SecurityScanOptions) {
  const timeoutMs =
    options?.timeoutMs === 5000 || options?.timeoutMs === 10000 || options?.timeoutMs === 15000
      ? options.timeoutMs
      : DEFAULT_REQUEST_TIMEOUT_MS;
  const followRedirects = options?.followRedirects ?? true;
  const normalizedUserAgent = options?.userAgent?.trim();
  const userAgent = normalizedUserAgent || DEFAULT_SCANNER_USER_AGENT;

  return {
    timeoutMs,
    followRedirects,
    userAgent
  };
}

export async function runSecurityScan(inputUrl: string, options?: SecurityScanOptions): Promise<SecurityReport> {
  const targetUrl = normalizeTargetUrl(inputUrl);
  const normalizedOptions = normalizeScanOptions(options);
  const requestStartedAtMs = Date.now();

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), normalizedOptions.timeoutMs);

  let upstreamResponse: Response;
  try {
    upstreamResponse = await fetch(targetUrl, {
      method: "GET",
      redirect: normalizedOptions.followRedirects ? "follow" : "manual",
      cache: "no-store",
      signal: controller.signal,
      headers: {
        "user-agent": normalizedOptions.userAgent
      }
    });
  } finally {
    clearTimeout(timeout);
  }

  const results = analyzeSecurityHeaders(upstreamResponse.headers);
  const cookieAnalysis = analyzeCookieSecurity(upstreamResponse.headers);
  const corsAnalysis = analyzeCorsConfiguration(upstreamResponse.headers);
  const [tlsAnalysis, dnsAnalysis] = await Promise.all([
    analyzeTlsConfiguration(upstreamResponse.url, {
      timeoutMs: normalizedOptions.timeoutMs
    }),
    analyzeDnsConfiguration(upstreamResponse.url)
  ]);
  const { score, grade, maxScore } = calculateGrade(results, {
    additionalScore: cookieAnalysis.score,
    additionalMaxScore: cookieAnalysis.maxScore,
    corsScore: corsAnalysis.score,
    corsMaxScore: corsAnalysis.maxScore,
    tlsScore: tlsAnalysis.score,
    tlsMaxScore: tlsAnalysis.maxScore,
    dnsScore: dnsAnalysis.score,
    dnsMaxScore: dnsAnalysis.maxScore
  });
  const responseTimeMs = Math.max(0, Date.now() - requestStartedAtMs);

  const report: SecurityReport = {
    checkedUrl: targetUrl,
    finalUrl: upstreamResponse.url,
    statusCode: upstreamResponse.status,
    score,
    maxScore,
    grade,
    results,
    cookieAnalysis,
    corsAnalysis,
    tlsAnalysis,
    dnsAnalysis,
    checkedAt: new Date().toISOString(),
    framework: detectFrameworkInfo(upstreamResponse.headers),
    responseTimeMs,
    scanDurationMs: responseTimeMs
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

export async function generateReport(inputUrl: string): Promise<SecurityReport> {
  return runSecurityScan(inputUrl);
}

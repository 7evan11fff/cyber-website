export type SriFindingSeverity = "low" | "medium" | "high" | "critical";
export type SriResourceType = "script" | "stylesheet";

export type SriFinding = {
  id: string;
  severity: SriFindingSeverity;
  message: string;
  recommendation: string;
  resourceUrl: string;
  resourceType: SriResourceType;
  isCdn: boolean;
};

export type SriResource = {
  id: string;
  resourceType: SriResourceType;
  url: string;
  host: string;
  isCdn: boolean;
  hasIntegrity: boolean;
  integrity: string | null;
  hasCrossorigin: boolean;
  crossorigin: string | null;
};

export type SriAnalysis = {
  available: boolean;
  scannedUrl: string | null;
  finalUrl: string | null;
  externalResourceCount: number;
  protectedResourceCount: number;
  missingIntegrityCount: number;
  missingCrossoriginCount: number;
  coveragePercent: number;
  crossoriginCoveragePercent: number;
  score: number;
  maxScore: number;
  grade: string;
  findings: SriFinding[];
  resources: SriResource[];
  summary: string;
};

export type SriAnalysisOptions = {
  userAgent?: string;
  followRedirects?: boolean;
  timeoutMs?: number;
};

type AttributeMap = Map<string, string | null>;

export const SRI_MAX_SCORE = 8;

const DEFAULT_REQUEST_TIMEOUT_MS = 10000;
const DEFAULT_SCANNER_USER_AGENT = "SecurityHeaderChecker/1.0 (+https://vercel.com)";
const SRI_PATTERN = /^(sha256|sha384|sha512)-/i;
const HIGH_PRIORITY_CDN_HOST_PATTERNS = [
  /(^|\.)cdnjs\.cloudflare\.com$/i,
  /(^|\.)cdn\.jsdelivr\.net$/i,
  /(^|\.)unpkg\.com$/i,
  /(^|\.)ajax\.googleapis\.com$/i,
  /(^|\.)stackpathcdn\.com$/i,
  /(^|\.)bootstrapcdn\.com$/i,
  /(^|\.)code\.jquery\.com$/i
];

function scoreToGrade(score: number, maxScore: number): string {
  if (!Number.isFinite(score) || !Number.isFinite(maxScore) || maxScore <= 0) return "N/A";
  const ratio = score / maxScore;
  if (ratio >= 0.92) return "A";
  if (ratio >= 0.8) return "B";
  if (ratio >= 0.65) return "C";
  if (ratio >= 0.5) return "D";
  return "F";
}

function normalizeAttributeValue(value: string | null): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function isPopularCdnHost(hostname: string): boolean {
  return HIGH_PRIORITY_CDN_HOST_PATTERNS.some((pattern) => pattern.test(hostname));
}

function parseTagAttributes(tagHtml: string): AttributeMap {
  const attributes: AttributeMap = new Map<string, string | null>();
  const tagNameMatch = /^<\s*[a-z0-9-]+/i.exec(tagHtml);
  const contentStart = tagNameMatch ? tagNameMatch[0].length : 1;
  const content = tagHtml.slice(contentStart, tagHtml.length - (tagHtml.endsWith("/>") ? 2 : 1));
  const attributeRegex = /([^\s"'<>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;

  let match: RegExpExecArray | null;
  while ((match = attributeRegex.exec(content)) !== null) {
    const key = match[1]?.toLowerCase().trim();
    if (!key) continue;
    const rawValue = match[2] ?? match[3] ?? match[4] ?? null;
    attributes.set(key, rawValue);
  }

  return attributes;
}

function isStylesheetLink(attributes: AttributeMap): boolean {
  const rel = normalizeAttributeValue(attributes.get("rel") ?? null);
  if (!rel) return false;
  const relValues = rel.toLowerCase().split(/\s+/).filter(Boolean);
  return relValues.includes("stylesheet");
}

function toAbsoluteResourceUrl(rawValue: string | null, pageUrl: URL): URL | null {
  const normalized = normalizeAttributeValue(rawValue);
  if (!normalized) return null;
  try {
    const resourceUrl = new URL(normalized, pageUrl);
    if (resourceUrl.protocol !== "http:" && resourceUrl.protocol !== "https:") {
      return null;
    }
    return resourceUrl;
  } catch {
    return null;
  }
}

function calculateScore(resources: SriResource[]): { score: number; maxScore: number } {
  if (resources.length === 0) {
    return {
      score: SRI_MAX_SCORE,
      maxScore: SRI_MAX_SCORE
    };
  }

  const protectedCount = resources.filter((resource) => resource.hasIntegrity).length;
  const protectedWithCrossoriginCount = resources.filter(
    (resource) => resource.hasIntegrity && resource.hasCrossorigin
  ).length;
  const integrityCoverage = protectedCount / resources.length;
  const crossoriginCoverage = protectedWithCrossoriginCount / resources.length;
  const score = Math.round(integrityCoverage * 6 + crossoriginCoverage * 2);
  return {
    score: Math.max(0, Math.min(SRI_MAX_SCORE, score)),
    maxScore: SRI_MAX_SCORE
  };
}

function summarizeSriAnalysis(analysis: Omit<SriAnalysis, "summary">): string {
  if (!analysis.available) {
    return "SRI analysis could not be completed for this scan.";
  }

  if (analysis.externalResourceCount === 0) {
    return "No external script or stylesheet resources were detected on the scanned page.";
  }

  if (analysis.findings.length === 0) {
    return "All detected external scripts and stylesheets include SRI hashes and crossorigin attributes.";
  }

  const criticalCount = analysis.findings.filter((finding) => finding.severity === "critical").length;
  const highCount = analysis.findings.filter((finding) => finding.severity === "high").length;
  const mediumCount = analysis.findings.filter((finding) => finding.severity === "medium").length;
  const segments: string[] = [];
  if (criticalCount > 0) segments.push(`${criticalCount} critical`);
  if (highCount > 0) segments.push(`${highCount} high`);
  if (mediumCount > 0) segments.push(`${mediumCount} medium`);
  if (segments.length === 0) {
    segments.push(`${analysis.findings.length} low`);
  }

  return `SRI coverage is ${analysis.coveragePercent}% with ${analysis.missingIntegrityCount} external resource${
    analysis.missingIntegrityCount === 1 ? "" : "s"
  } missing integrity attributes (${segments.join(", ")} findings).`;
}

function buildFindings(resources: SriResource[]): SriFinding[] {
  const findings: SriFinding[] = [];

  resources.forEach((resource, index) => {
    if (!resource.hasIntegrity) {
      const severity: SriFindingSeverity =
        resource.resourceType === "script"
          ? resource.isCdn
            ? "critical"
            : "high"
          : resource.isCdn
            ? "high"
            : "medium";

      findings.push({
        id: `missing-integrity-${index + 1}`,
        severity,
        message: `${resource.resourceType === "script" ? "Script" : "Stylesheet"} is loaded from an external origin without an integrity hash.`,
        recommendation:
          "Add an integrity attribute with a sha384/sha512 hash and pair it with crossorigin=\"anonymous\" to protect against tampered third-party assets.",
        resourceUrl: resource.url,
        resourceType: resource.resourceType,
        isCdn: resource.isCdn
      });
    } else if (!SRI_PATTERN.test(resource.integrity ?? "")) {
      findings.push({
        id: `invalid-integrity-format-${index + 1}`,
        severity: resource.resourceType === "script" ? "medium" : "low",
        message: "Integrity attribute is present but does not appear to use a valid SRI hash algorithm prefix.",
        recommendation: "Use integrity values starting with sha256-, sha384-, or sha512- and validate the full hash.",
        resourceUrl: resource.url,
        resourceType: resource.resourceType,
        isCdn: resource.isCdn
      });
    }

    if (resource.hasIntegrity && !resource.hasCrossorigin) {
      findings.push({
        id: `missing-crossorigin-${index + 1}`,
        severity: resource.resourceType === "script" ? "medium" : "low",
        message: "External resource has an integrity hash but is missing a crossorigin attribute.",
        recommendation:
          "Set crossorigin=\"anonymous\" alongside integrity so browsers can perform reliable SRI validation for cross-origin assets.",
        resourceUrl: resource.url,
        resourceType: resource.resourceType,
        isCdn: resource.isCdn
      });
    }
  });

  return findings;
}

function extractExternalResources(html: string, pageUrl: string): SriResource[] {
  let parsedPageUrl: URL;
  try {
    parsedPageUrl = new URL(pageUrl);
  } catch {
    return [];
  }

  const resources: SriResource[] = [];
  const resourceTagRegex = /<(script|link)\b[^>]*>/gi;
  let tagMatch: RegExpExecArray | null;
  let resourceIndex = 0;

  while ((tagMatch = resourceTagRegex.exec(html)) !== null) {
    const tagName = tagMatch[1]?.toLowerCase();
    const tagHtml = tagMatch[0];
    if (!tagName || !tagHtml) continue;

    const attributes = parseTagAttributes(tagHtml);
    const resourceType: SriResourceType | null =
      tagName === "script" ? "script" : tagName === "link" && isStylesheetLink(attributes) ? "stylesheet" : null;
    if (!resourceType) continue;

    const sourceAttribute = resourceType === "script" ? "src" : "href";
    const resourceUrl = toAbsoluteResourceUrl(attributes.get(sourceAttribute) ?? null, parsedPageUrl);
    if (!resourceUrl) continue;
    if (resourceUrl.origin === parsedPageUrl.origin) continue;

    resourceIndex += 1;
    const integrityRaw = normalizeAttributeValue(attributes.get("integrity") ?? null);
    const crossoriginRaw = normalizeAttributeValue(attributes.get("crossorigin") ?? null);
    resources.push({
      id: `resource-${resourceIndex}`,
      resourceType,
      url: resourceUrl.toString(),
      host: resourceUrl.hostname.toLowerCase(),
      isCdn: isPopularCdnHost(resourceUrl.hostname.toLowerCase()),
      hasIntegrity: Boolean(integrityRaw),
      integrity: integrityRaw,
      hasCrossorigin: attributes.has("crossorigin"),
      crossorigin: crossoriginRaw
    });
  }

  return resources;
}

function buildUnavailableSriAnalysis(scannedUrl: string | null, reason: string): SriAnalysis {
  const baseAnalysis = {
    available: false,
    scannedUrl,
    finalUrl: null,
    externalResourceCount: 0,
    protectedResourceCount: 0,
    missingIntegrityCount: 0,
    missingCrossoriginCount: 0,
    coveragePercent: 0,
    crossoriginCoveragePercent: 0,
    score: 0,
    maxScore: 0,
    grade: "N/A",
    findings: [
      {
        id: "sri-analysis-unavailable",
        severity: "low" as const,
        message: "SRI analysis was unavailable for this scan.",
        recommendation: "Retry the scan and verify the target page can be fetched as HTML.",
        resourceUrl: scannedUrl ?? "https://invalid.local/",
        resourceType: "script" as const,
        isCdn: false
      }
    ],
    resources: [] as SriResource[]
  };

  return {
    ...baseAnalysis,
    summary: `${summarizeSriAnalysis(baseAnalysis)} Reason: ${reason}`
  };
}

export async function analyzeSubresourceIntegrity(
  targetUrl: string,
  options: SriAnalysisOptions = {}
): Promise<SriAnalysis> {
  const timeoutMs =
    Number.isFinite(options.timeoutMs) && (options.timeoutMs ?? 0) > 0
      ? options.timeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS
      : DEFAULT_REQUEST_TIMEOUT_MS;
  const userAgent = options.userAgent?.trim() || DEFAULT_SCANNER_USER_AGENT;
  const followRedirects = options.followRedirects ?? true;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  let response: Response;
  try {
    response = await fetch(targetUrl, {
      method: "GET",
      redirect: followRedirects ? "follow" : "manual",
      cache: "no-store",
      signal: controller.signal,
      headers: {
        "user-agent": userAgent
      }
    });
  } catch (error) {
    clearTimeout(timeout);
    const reason = error instanceof Error ? error.message : "Unexpected fetch failure.";
    return buildUnavailableSriAnalysis(targetUrl, reason);
  }

  clearTimeout(timeout);

  try {
    const html = await response.text();
    const resources = extractExternalResources(html, response.url || targetUrl);
    const findings = buildFindings(resources);
    const protectedResourceCount = resources.filter((resource) => resource.hasIntegrity).length;
    const missingIntegrityCount = resources.filter((resource) => !resource.hasIntegrity).length;
    const missingCrossoriginCount = resources.filter((resource) => resource.hasIntegrity && !resource.hasCrossorigin).length;
    const coveragePercent =
      resources.length === 0 ? 100 : Math.round((protectedResourceCount / resources.length) * 100);
    const crossoriginCoveragePercent =
      resources.length === 0
        ? 100
        : Math.round(
            (resources.filter((resource) => resource.hasIntegrity && resource.hasCrossorigin).length / resources.length) *
              100
          );
    const { score, maxScore } = calculateScore(resources);

    const baseAnalysis = {
      available: true,
      scannedUrl: targetUrl,
      finalUrl: response.url || targetUrl,
      externalResourceCount: resources.length,
      protectedResourceCount,
      missingIntegrityCount,
      missingCrossoriginCount,
      coveragePercent,
      crossoriginCoveragePercent,
      score,
      maxScore,
      grade: scoreToGrade(score, maxScore),
      findings,
      resources
    };

    return {
      ...baseAnalysis,
      summary: summarizeSriAnalysis(baseAnalysis)
    };
  } catch (error) {
    const reason = error instanceof Error ? error.message : "Unexpected response parsing failure.";
    return buildUnavailableSriAnalysis(targetUrl, reason);
  }
}

export const __private__ = {
  extractExternalResources,
  parseTagAttributes,
  isPopularCdnHost,
  summarizeSriAnalysis,
  buildFindings
};

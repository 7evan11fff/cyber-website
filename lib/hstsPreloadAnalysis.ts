export type HstsPreloadEnrollmentStatus = "preloaded" | "pending" | "not-preloaded";
export type HstsPreloadEligibility = "eligible" | "ineligible" | "unknown";
export type HstsPreloadFindingSeverity = "info" | "warning";

export type HstsPreloadRequirement = {
  id: "max-age" | "include-subdomains" | "preload-directive";
  label: string;
  passed: boolean;
  details: string;
};

export type HstsPreloadFinding = {
  id: string;
  severity: HstsPreloadFindingSeverity;
  message: string;
  recommendation: string;
};

export type HstsPreloadHeaderEvaluation = {
  raw: string | null;
  hasHeader: boolean;
  maxAge: number | null;
  hasSufficientMaxAge: boolean;
  hasIncludeSubDomains: boolean;
  hasPreloadDirective: boolean;
};

export type HstsPreloadAnalysis = {
  available: boolean;
  checkedDomain: string;
  apiStatus: string | null;
  status: HstsPreloadEnrollmentStatus;
  eligibility: HstsPreloadEligibility;
  onPreloadList: boolean;
  submissionUrl: string;
  header: HstsPreloadHeaderEvaluation;
  requirements: HstsPreloadRequirement[];
  apiErrors: string[];
  apiWarnings: string[];
  findings: HstsPreloadFinding[];
  recommendations: string[];
  score: number;
  maxScore: number;
  grade: string;
  summary: string;
};

export type HstsPreloadAnalysisOptions = {
  timeoutMs?: number;
  userAgent?: string;
};

const HSTS_PRELOAD_ENDPOINT = "https://hstspreload.org/api/v2/status";
const HSTS_PRELOAD_MIN_MAX_AGE_SECONDS = 31536000;
const HSTS_PRELOAD_MAX_SCORE = 3;
const DEFAULT_REQUEST_TIMEOUT_MS = 10000;
const DEFAULT_SCANNER_USER_AGENT = "SecurityHeaderChecker/1.0 (+https://vercel.com)";

function scoreToGrade(score: number, maxScore: number): string {
  if (!Number.isFinite(score) || !Number.isFinite(maxScore) || maxScore <= 0) return "N/A";
  const ratio = score / maxScore;
  if (ratio >= 0.92) return "A";
  if (ratio >= 0.8) return "B";
  if (ratio >= 0.65) return "C";
  if (ratio >= 0.5) return "D";
  return "F";
}

function normalizeDomain(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  try {
    const candidate = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    const parsed = new URL(candidate);
    return parsed.hostname ? parsed.hostname.toLowerCase() : null;
  } catch {
    return null;
  }
}

function toStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => (typeof entry === "string" ? entry.trim() : null))
    .filter((entry): entry is string => Boolean(entry));
}

function parseHeader(hstsHeaderValue: string | null): HstsPreloadHeaderEvaluation {
  const normalizedValue = typeof hstsHeaderValue === "string" ? hstsHeaderValue.trim() : "";
  if (!normalizedValue) {
    return {
      raw: null,
      hasHeader: false,
      maxAge: null,
      hasSufficientMaxAge: false,
      hasIncludeSubDomains: false,
      hasPreloadDirective: false
    };
  }

  const directives = normalizedValue
    .split(";")
    .map((directive) => directive.trim())
    .filter(Boolean);

  let maxAge: number | null = null;
  for (const directive of directives) {
    const match = directive.match(/^max-age\s*=\s*"?(\d+)"?$/i);
    if (!match) continue;
    const parsed = Number(match[1]);
    if (Number.isFinite(parsed)) {
      maxAge = Math.max(0, Math.trunc(parsed));
      break;
    }
  }

  const hasIncludeSubDomains = directives.some((directive) => /^includesubdomains$/i.test(directive));
  const hasPreloadDirective = directives.some((directive) => /^preload$/i.test(directive));

  return {
    raw: normalizedValue,
    hasHeader: true,
    maxAge,
    hasSufficientMaxAge: typeof maxAge === "number" && maxAge >= HSTS_PRELOAD_MIN_MAX_AGE_SECONDS,
    hasIncludeSubDomains,
    hasPreloadDirective
  };
}

function normalizeEnrollmentStatus(apiStatus: string | null): HstsPreloadEnrollmentStatus {
  if (!apiStatus) return "not-preloaded";
  const normalized = apiStatus.trim().toLowerCase();
  if (normalized === "preloaded" || (normalized.includes("preloaded") && !normalized.includes("not"))) {
    return "preloaded";
  }
  if (normalized.includes("pending")) {
    return "pending";
  }
  return "not-preloaded";
}

function buildRequirements(header: HstsPreloadHeaderEvaluation): HstsPreloadRequirement[] {
  return [
    {
      id: "max-age",
      label: "max-age >= 31536000",
      passed: header.hasSufficientMaxAge,
      details:
        typeof header.maxAge === "number"
          ? `Detected max-age=${header.maxAge}.`
          : "HSTS max-age directive was not detected."
    },
    {
      id: "include-subdomains",
      label: "includeSubDomains directive",
      passed: header.hasIncludeSubDomains,
      details: header.hasIncludeSubDomains ? "includeSubDomains directive detected." : "Missing includeSubDomains directive."
    },
    {
      id: "preload-directive",
      label: "preload directive",
      passed: header.hasPreloadDirective,
      details: header.hasPreloadDirective ? "preload directive detected." : "Missing preload directive."
    }
  ];
}

function buildSummary(params: {
  available: boolean;
  domain: string;
  status: HstsPreloadEnrollmentStatus;
  eligibility: HstsPreloadEligibility;
  unavailableReason: string | null;
}): string {
  if (!params.available) {
    return `HSTS preload status could not be verified for ${params.domain}: ${params.unavailableReason ?? "API unavailable"}.`;
  }

  if (params.status === "preloaded") {
    return `${params.domain} is currently included in the HSTS preload list.`;
  }
  if (params.status === "pending") {
    return `${params.domain} has a pending HSTS preload submission.`;
  }
  if (params.eligibility === "eligible") {
    return `${params.domain} is not preloaded yet, but the current HSTS header appears eligible for submission.`;
  }
  return `${params.domain} is not preloaded and the current HSTS header does not meet preload requirements.`;
}

function buildRecommendations(params: {
  status: HstsPreloadEnrollmentStatus;
  eligibility: HstsPreloadEligibility;
  requirements: HstsPreloadRequirement[];
  submissionUrl: string;
  apiErrors: string[];
}): string[] {
  const recommendations: string[] = [];
  if (params.status === "preloaded") {
    recommendations.push("Keep Strict-Transport-Security enabled with includeSubDomains and preload to remain eligible.");
    recommendations.push("Monitor certificate renewals and HTTPS coverage across all subdomains to avoid preload removal risk.");
    return recommendations;
  }

  if (params.status === "pending") {
    recommendations.push("Monitor preload submission progress in the HSTS preload dashboard.");
    recommendations.push("Do not remove includeSubDomains or preload directives while submission is pending.");
    return recommendations;
  }

  if (params.eligibility === "eligible") {
    recommendations.push(`Submit your domain to the preload list: ${params.submissionUrl}`);
    recommendations.push("Verify all subdomains are HTTPS-only before submission to avoid breakage.");
    return recommendations;
  }

  for (const requirement of params.requirements) {
    if (requirement.passed) continue;
    if (requirement.id === "max-age") {
      recommendations.push("Set Strict-Transport-Security max-age to at least 31536000 seconds.");
    } else if (requirement.id === "include-subdomains") {
      recommendations.push("Add includeSubDomains to your Strict-Transport-Security header.");
    } else {
      recommendations.push("Add the preload directive to your Strict-Transport-Security header.");
    }
  }

  if (params.apiErrors.length > 0) {
    recommendations.push("Review and resolve API-reported preload blockers before submission.");
  }
  recommendations.push(`Validate readiness and submit when eligible: ${params.submissionUrl}`);
  return Array.from(new Set(recommendations));
}

function buildFindings(params: {
  available: boolean;
  status: HstsPreloadEnrollmentStatus;
  eligibility: HstsPreloadEligibility;
  requirements: HstsPreloadRequirement[];
  apiErrors: string[];
  unavailableReason: string | null;
}): HstsPreloadFinding[] {
  const findings: HstsPreloadFinding[] = [];

  if (!params.available) {
    findings.push({
      id: "hsts-preload-api-unavailable",
      severity: "warning",
      message: `HSTS preload API check was unavailable (${params.unavailableReason ?? "unknown reason"}).`,
      recommendation: "Retry the scan to confirm preload status."
    });
    return findings;
  }

  if (params.status === "preloaded") {
    findings.push({
      id: "hsts-preload-preloaded",
      severity: "info",
      message: "Domain is preloaded in major browsers.",
      recommendation: "Maintain strict HTTPS posture across all subdomains."
    });
  } else if (params.status === "pending") {
    findings.push({
      id: "hsts-preload-pending",
      severity: "info",
      message: "Domain preload submission is pending.",
      recommendation: "Keep current HSTS directives until preload is finalized."
    });
  } else if (params.eligibility === "eligible") {
    findings.push({
      id: "hsts-preload-eligible",
      severity: "info",
      message: "Domain appears eligible for HSTS preload but is not submitted/preloaded yet.",
      recommendation: "Submit to hstspreload.org after confirming HTTPS on all subdomains."
    });
  } else {
    const missing = params.requirements
      .filter((requirement) => !requirement.passed)
      .map((requirement) => requirement.label)
      .join(", ");
    findings.push({
      id: "hsts-preload-ineligible",
      severity: "warning",
      message: `Domain is not preload-eligible. Missing requirements: ${missing || "unknown requirements"}.`,
      recommendation: "Fix HSTS directives, then rescan and submit to preload."
    });
  }

  for (const [index, error] of params.apiErrors.entries()) {
    findings.push({
      id: `hsts-preload-api-error-${index + 1}`,
      severity: "warning",
      message: `Preload API reported: ${error}`,
      recommendation: "Address this blocker before submission."
    });
  }

  return findings;
}

function scoreStatus(params: {
  available: boolean;
  status: HstsPreloadEnrollmentStatus;
  eligibility: HstsPreloadEligibility;
}): { score: number; maxScore: number; grade: string } {
  if (!params.available) {
    return {
      score: 0,
      maxScore: 0,
      grade: "N/A"
    };
  }

  let score = 0;
  if (params.status === "preloaded") {
    score = HSTS_PRELOAD_MAX_SCORE;
  } else if (params.status === "pending") {
    score = 2;
  } else if (params.eligibility === "eligible") {
    score = 1;
  }

  return {
    score,
    maxScore: HSTS_PRELOAD_MAX_SCORE,
    grade: scoreToGrade(score, HSTS_PRELOAD_MAX_SCORE)
  };
}

export async function analyzeHstsPreloadStatus(
  input: string,
  hstsHeaderValue: string | null,
  options: HstsPreloadAnalysisOptions = {}
): Promise<HstsPreloadAnalysis> {
  const domain = normalizeDomain(input);
  const fallbackDomain = input.trim().toLowerCase() || "unknown-domain";
  const checkedDomain = domain ?? fallbackDomain;
  const header = parseHeader(hstsHeaderValue);
  const requirements = buildRequirements(header);
  const meetsAllRequirements = header.hasHeader && requirements.every((requirement) => requirement.passed);
  const submissionUrl = `https://hstspreload.org/?domain=${encodeURIComponent(checkedDomain)}`;

  if (!domain) {
    const status: HstsPreloadEnrollmentStatus = "not-preloaded";
    const eligibility: HstsPreloadEligibility = meetsAllRequirements ? "eligible" : "ineligible";
    return {
      available: false,
      checkedDomain,
      apiStatus: null,
      status,
      eligibility,
      onPreloadList: false,
      submissionUrl,
      header,
      requirements,
      apiErrors: ["Invalid domain input."],
      apiWarnings: [],
      findings: buildFindings({
        available: false,
        status,
        eligibility,
        requirements,
        apiErrors: [],
        unavailableReason: "Invalid domain input"
      }),
      recommendations: buildRecommendations({
        status,
        eligibility,
        requirements,
        submissionUrl,
        apiErrors: []
      }),
      score: 0,
      maxScore: 0,
      grade: "N/A",
      summary: buildSummary({
        available: false,
        domain: checkedDomain,
        status,
        eligibility,
        unavailableReason: "invalid domain input"
      })
    };
  }

  const timeoutMs =
    Number.isFinite(options.timeoutMs) && (options.timeoutMs ?? 0) > 0
      ? Math.trunc(options.timeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS)
      : DEFAULT_REQUEST_TIMEOUT_MS;
  const userAgent = options.userAgent?.trim() || DEFAULT_SCANNER_USER_AGENT;
  const apiUrl = `${HSTS_PRELOAD_ENDPOINT}?domain=${encodeURIComponent(domain)}`;

  let available = true;
  let unavailableReason: string | null = null;
  let apiStatus: string | null = null;
  let apiErrors: string[] = [];
  let apiWarnings: string[] = [];

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(apiUrl, {
      method: "GET",
      cache: "no-store",
      signal: controller.signal,
      headers: {
        "user-agent": userAgent
      }
    });

    if (!response.ok) {
      available = false;
      unavailableReason = `HTTP ${response.status}`;
    } else {
      const payload = (await response.json().catch(() => null)) as Record<string, unknown> | null;
      apiStatus = payload && typeof payload.status === "string" ? payload.status : null;
      apiErrors = toStringList(payload?.errors);
      apiWarnings = toStringList(payload?.warnings);
    }
  } catch (error) {
    available = false;
    unavailableReason = error instanceof Error ? error.message : "Unexpected fetch error";
  } finally {
    clearTimeout(timeout);
  }

  const status = normalizeEnrollmentStatus(apiStatus);
  const eligibility: HstsPreloadEligibility =
    status === "not-preloaded" ? (meetsAllRequirements ? "eligible" : "ineligible") : "unknown";
  const onPreloadList = status === "preloaded" || status === "pending";
  const scoring = scoreStatus({
    available,
    status,
    eligibility
  });

  return {
    available,
    checkedDomain: domain,
    apiStatus,
    status,
    eligibility,
    onPreloadList,
    submissionUrl,
    header,
    requirements,
    apiErrors,
    apiWarnings,
    findings: buildFindings({
      available,
      status,
      eligibility,
      requirements,
      apiErrors,
      unavailableReason
    }),
    recommendations: buildRecommendations({
      status,
      eligibility,
      requirements,
      submissionUrl,
      apiErrors
    }),
    score: scoring.score,
    maxScore: scoring.maxScore,
    grade: scoring.grade,
    summary: buildSummary({
      available,
      domain,
      status,
      eligibility,
      unavailableReason
    })
  };
}

export const __private__ = {
  parseHeader,
  normalizeEnrollmentStatus,
  normalizeDomain
};

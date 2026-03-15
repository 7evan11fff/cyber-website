export type CorsFindingSeverity = "low" | "medium" | "high" | "critical";

export type CorsFinding = {
  id: string;
  header: "access-control-allow-origin" | "access-control-allow-methods" | "access-control-allow-headers" | "access-control-allow-credentials";
  severity: CorsFindingSeverity;
  message: string;
  recommendation: string;
  value: string | null;
};

export type CorsAnalysis = {
  allowOrigin: string | null;
  allowMethods: string | null;
  allowHeaders: string | null;
  allowCredentials: string | null;
  allowExposeHeaders?: string | null;
  maxAge?: string | null;
  hasPreflightConfiguration?: boolean;
  allowsAnyOrigin: boolean;
  allowsCredentials: boolean;
  isOverlyPermissive: boolean;
  score: number;
  maxScore: number;
  grade: string;
  findings: CorsFinding[];
  summary: string;
};

export const CORS_MAX_SCORE = 4;

const FINDING_PENALTY: Record<CorsFindingSeverity, number> = {
  low: 0,
  medium: 1,
  high: 2,
  critical: CORS_MAX_SCORE
};

function scoreToGrade(score: number, maxScore: number): string {
  if (!Number.isFinite(score) || !Number.isFinite(maxScore) || maxScore <= 0) return "F";
  const ratio = score / maxScore;
  if (ratio >= 0.92) return "A";
  if (ratio >= 0.8) return "B";
  if (ratio >= 0.65) return "C";
  if (ratio >= 0.5) return "D";
  return "F";
}

export function normalizeCorsHeaderValue(value: string | null): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function parseCorsList(value: string | null): string[] {
  const normalized = normalizeCorsHeaderValue(value);
  if (!normalized) return [];
  return normalized
    .split(",")
    .map((part) => part.trim().toLowerCase())
    .filter(Boolean);
}

export function hasWildcardValue(value: string | null): boolean {
  const normalized = normalizeCorsHeaderValue(value);
  if (!normalized) return false;
  return normalized === "*" || parseCorsList(normalized).includes("*");
}

export function allowsCredentials(value: string | null): boolean {
  const normalized = normalizeCorsHeaderValue(value);
  return normalized?.toLowerCase() === "true";
}

export function computeCorsScore(findings: CorsFinding[]): number {
  if (findings.some((finding) => finding.severity === "critical")) {
    return 0;
  }

  const totalPenalty = findings.reduce((sum, finding) => sum + FINDING_PENALTY[finding.severity], 0);
  return Math.max(0, CORS_MAX_SCORE - totalPenalty);
}

function summarizeCors(analysis: Omit<CorsAnalysis, "summary">): string {
  if (
    !analysis.allowOrigin &&
    !analysis.allowMethods &&
    !analysis.allowHeaders &&
    !analysis.allowCredentials &&
    !analysis.allowExposeHeaders &&
    !analysis.maxAge
  ) {
    return "No CORS headers were returned. Cross-origin access is likely restricted by default.";
  }

  if (analysis.findings.length === 0) {
    return "CORS headers are present and appear reasonably restrictive.";
  }

  const criticalCount = analysis.findings.filter((finding) => finding.severity === "critical").length;
  const highCount = analysis.findings.filter((finding) => finding.severity === "high").length;
  const mediumCount = analysis.findings.filter((finding) => finding.severity === "medium").length;
  const segments: string[] = [];
  if (criticalCount > 0) segments.push(`${criticalCount} critical`);
  if (highCount > 0) segments.push(`${highCount} high`);
  if (mediumCount > 0) segments.push(`${mediumCount} medium`);
  return `CORS findings detected: ${segments.join(", ")} risk issue${analysis.findings.length === 1 ? "" : "s"}.`;
}

export function analyzeCorsConfiguration(headers: Headers): CorsAnalysis {
  const allowOrigin = normalizeCorsHeaderValue(headers.get("access-control-allow-origin"));
  const allowMethods = normalizeCorsHeaderValue(headers.get("access-control-allow-methods"));
  const allowHeaders = normalizeCorsHeaderValue(headers.get("access-control-allow-headers"));
  const allowCredentials = normalizeCorsHeaderValue(headers.get("access-control-allow-credentials"));
  const allowExposeHeaders = normalizeCorsHeaderValue(headers.get("access-control-expose-headers"));
  const maxAge = normalizeCorsHeaderValue(headers.get("access-control-max-age"));

  const findings: CorsFinding[] = [];
  const allowsAnyOrigin = hasWildcardValue(allowOrigin);
  const credentialsEnabled = allowsCredentials(allowCredentials);
  const methods = parseCorsList(allowMethods);
  const requestHeaders = parseCorsList(allowHeaders);
  const hasPreflightConfiguration = Boolean(allowMethods || allowHeaders || maxAge);

  if (allowsAnyOrigin && credentialsEnabled) {
    findings.push({
      id: "wildcard-origin-with-credentials",
      header: "access-control-allow-origin",
      severity: "critical",
      message: "Access-Control-Allow-Origin uses '*' while credentials are enabled.",
      recommendation:
        "Never combine wildcard origins with credentialed requests. Use an explicit allowlist per trusted origin.",
      value: allowOrigin
    });
  } else if (allowsAnyOrigin) {
    findings.push({
      id: "wildcard-origin",
      header: "access-control-allow-origin",
      severity: "high",
      message: "Access-Control-Allow-Origin allows all origins.",
      recommendation: "Restrict Access-Control-Allow-Origin to explicit trusted origins.",
      value: allowOrigin
    });
  }

  if (allowOrigin?.toLowerCase() === "null") {
    findings.push({
      id: "null-origin",
      header: "access-control-allow-origin",
      severity: "high",
      message: "Access-Control-Allow-Origin allows the special 'null' origin.",
      recommendation: "Avoid allowing the 'null' origin unless there is a tightly controlled requirement.",
      value: allowOrigin
    });
  }

  if (parseCorsList(allowOrigin).length > 1) {
    findings.push({
      id: "multiple-origins-in-single-header",
      header: "access-control-allow-origin",
      severity: "medium",
      message: "Multiple origins were found in Access-Control-Allow-Origin.",
      recommendation:
        "Return a single explicit origin per response and vary by request Origin when implementing allowlists.",
      value: allowOrigin
    });
  }

  if (hasWildcardValue(allowMethods)) {
    findings.push({
      id: "wildcard-methods",
      header: "access-control-allow-methods",
      severity: "medium",
      message: "Access-Control-Allow-Methods uses a wildcard.",
      recommendation: "Allow only required HTTP methods (for example: GET, POST) for each endpoint.",
      value: allowMethods
    });
  }

  if (hasWildcardValue(allowHeaders)) {
    findings.push({
      id: "wildcard-headers",
      header: "access-control-allow-headers",
      severity: "medium",
      message: "Access-Control-Allow-Headers uses a wildcard.",
      recommendation: "Allow only required request headers instead of '*'.",
      value: allowHeaders
    });
  }

  const includesHighRiskMethod = methods.some((method) => ["put", "patch", "delete", "trace", "connect"].includes(method));
  if (includesHighRiskMethod && (allowsAnyOrigin || hasWildcardValue(allowMethods))) {
    findings.push({
      id: "broad-methods-with-open-origin",
      header: "access-control-allow-methods",
      severity: "medium",
      message: "Potentially sensitive HTTP methods are allowed for broad cross-origin access.",
      recommendation: "Limit high-risk methods to trusted origins and authenticated flows only.",
      value: allowMethods
    });
  }

  if (credentialsEnabled && !allowOrigin) {
    findings.push({
      id: "credentials-without-origin",
      header: "access-control-allow-credentials",
      severity: "medium",
      message: "Credentials are enabled but Access-Control-Allow-Origin is not explicitly set.",
      recommendation:
        "When enabling credentials, return an explicit trusted origin and include a Vary: Origin response header.",
      value: allowCredentials
    });
  }

  if (credentialsEnabled && requestHeaders.includes("authorization") && allowsAnyOrigin) {
    findings.push({
      id: "authorization-overly-broad",
      header: "access-control-allow-headers",
      severity: "high",
      message: "Authorization headers are allowed for any origin while credentials are enabled.",
      recommendation:
        "Restrict origins and avoid broad authorization exposure across cross-origin requests.",
      value: allowHeaders
    });
  }

  const score = computeCorsScore(findings);
  const baseAnalysis = {
    allowOrigin,
    allowMethods,
    allowHeaders,
    allowCredentials,
    allowExposeHeaders,
    maxAge,
    hasPreflightConfiguration,
    allowsAnyOrigin,
    allowsCredentials: credentialsEnabled,
    isOverlyPermissive:
      allowsAnyOrigin || hasWildcardValue(allowMethods) || hasWildcardValue(allowHeaders) || findings.some((f) => f.severity === "high" || f.severity === "critical"),
    score,
    maxScore: CORS_MAX_SCORE,
    grade: scoreToGrade(score, CORS_MAX_SCORE),
    findings
  };

  return {
    ...baseAnalysis,
    summary: summarizeCors(baseAnalysis)
  };
}

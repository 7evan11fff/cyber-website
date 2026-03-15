import { isIP } from "node:net";
import type { CaaRecord } from "node:dns";
import { resolveCaa } from "node:dns/promises";

export type CaaFindingSeverity = "low" | "medium" | "high";
export type CaaDirectiveTag = "issue" | "issuewild" | "iodef";

export type CaaDirective = {
  tag: CaaDirectiveTag;
  value: string;
  critical: boolean;
  meaning: string;
};

export type CaaFinding = {
  id: string;
  severity: CaaFindingSeverity;
  message: string;
  recommendation: string;
  evidence: string | null;
};

export type CaaAnalysis = {
  available: boolean;
  checkedHostname: string | null;
  hasRecords: boolean;
  restrictsIssuance: boolean;
  specificCaOnly: boolean;
  allowedCertificateAuthorities: string[];
  directives: CaaDirective[];
  score: number;
  maxScore: number;
  grade: string;
  findings: CaaFinding[];
  summary: string;
};

export type CaaProbeResult = {
  hostname: string;
  records: CaaRecord[];
  queryError: string | null;
};

type DnsQueryOutcome<T> = {
  value: T | null;
  errorCode: string | null;
};

export const CAA_MAX_SCORE = 3;
const MISSING_RECORD_CODES = new Set(["ENODATA", "ENOTFOUND", "ENONAME"]);

function scoreToGrade(score: number, maxScore: number): string {
  if (!Number.isFinite(score) || !Number.isFinite(maxScore) || maxScore <= 0) return "N/A";
  const ratio = score / maxScore;
  if (ratio >= 0.92) return "A";
  if (ratio >= 0.8) return "B";
  if (ratio >= 0.65) return "C";
  if (ratio >= 0.5) return "D";
  return "F";
}

function toErrorCode(error: unknown): string | null {
  if (!error || typeof error !== "object") return null;
  const code = (error as { code?: unknown }).code;
  return typeof code === "string" ? code.toUpperCase() : null;
}

async function timedQuery<T>(query: () => Promise<T>): Promise<DnsQueryOutcome<T>> {
  try {
    const value = await query();
    return { value, errorCode: null };
  } catch (error) {
    return { value: null, errorCode: toErrorCode(error) };
  }
}

function normalizeIssuer(value: string): string {
  const issuer = value.split(";")[0]?.trim().replace(/^"(.*)"$/, "$1").toLowerCase() ?? "";
  return issuer;
}

function describeMeaning(tag: CaaDirectiveTag): string {
  if (tag === "issue") {
    return "Authorizes this CA to issue certificates for the domain.";
  }
  if (tag === "issuewild") {
    return "Authorizes this CA to issue wildcard certificates.";
  }
  return "Specifies where CAA incident reports should be sent.";
}

function collectDirectives(records: CaaRecord[]): CaaDirective[] {
  const directives: CaaDirective[] = [];
  for (const record of records) {
    const critical = Boolean(record.critical);
    if (typeof record.issue === "string") {
      directives.push({
        tag: "issue",
        value: record.issue.trim(),
        critical,
        meaning: describeMeaning("issue")
      });
    }
    if (typeof record.issuewild === "string") {
      directives.push({
        tag: "issuewild",
        value: record.issuewild.trim(),
        critical,
        meaning: describeMeaning("issuewild")
      });
    }
    if (typeof record.iodef === "string") {
      directives.push({
        tag: "iodef",
        value: record.iodef.trim(),
        critical,
        meaning: describeMeaning("iodef")
      });
    }
  }
  return directives;
}

function summarize(analysis: Omit<CaaAnalysis, "summary">): string {
  if (!analysis.available) {
    return "CAA analysis was not available for this scan target.";
  }
  if (!analysis.hasRecords) {
    return "No CAA records were detected, so certificate issuance is not explicitly restricted.";
  }
  if (analysis.specificCaOnly) {
    return "CAA records are present and restrict issuance to specific certificate authorities.";
  }
  if (analysis.restrictsIssuance) {
    return "CAA records are present and restrict issuance, but policy could be tightened.";
  }
  return "CAA records are present but do not currently restrict certificate issuance.";
}

export function buildCaaAnalysisFromProbe(probe: CaaProbeResult): CaaAnalysis {
  const directives = collectDirectives(probe.records);
  const issuanceDirectives = directives.filter((directive) => directive.tag === "issue" || directive.tag === "issuewild");
  const issuers = issuanceDirectives.map((directive) => normalizeIssuer(directive.value));
  const allowsAnyCa = issuers.some((issuer) => issuer.length === 0);
  const restrictsIssuance = issuanceDirectives.length > 0 && !allowsAnyCa;
  const allowedCertificateAuthorities = Array.from(new Set(issuers.filter((issuer) => issuer.length > 0)));
  const specificCaOnly = restrictsIssuance && allowedCertificateAuthorities.length > 0;

  const findings: CaaFinding[] = [];
  if (probe.records.length === 0) {
    findings.push({
      id: "caa-missing",
      severity: "medium",
      message: "No CAA records were found for this hostname.",
      recommendation: "Publish CAA issue/issuewild policies to restrict certificate issuance to approved CAs.",
      evidence: probe.queryError && !MISSING_RECORD_CODES.has(probe.queryError) ? probe.queryError : null
    });
  } else if (issuanceDirectives.length === 0) {
    findings.push({
      id: "caa-no-issuance-directives",
      severity: "medium",
      message: "CAA records exist but do not define issue/issuewild issuance controls.",
      recommendation: "Add issue and/or issuewild directives to explicitly control which CAs can issue certificates.",
      evidence: directives.map((directive) => `${directive.tag}=${directive.value}`).join(" | ") || null
    });
  } else if (allowsAnyCa) {
    findings.push({
      id: "caa-allows-any-ca",
      severity: "high",
      message: "CAA policy contains an empty issuer value, which effectively allows unrestricted issuance.",
      recommendation: "Replace empty issue/issuewild values with explicit CA domains approved for your organization.",
      evidence: issuanceDirectives.map((directive) => `${directive.tag}=${directive.value}`).join(" | ")
    });
  }

  if (probe.records.length > 0 && directives.every((directive) => directive.tag !== "iodef")) {
    findings.push({
      id: "caa-iodef-missing",
      severity: "low",
      message: "CAA iodef reporting contact is not configured.",
      recommendation: "Add an iodef mailto: or https: endpoint to receive CAA policy violation notifications.",
      evidence: null
    });
  }

  const score =
    (probe.records.length > 0 ? 1 : 0) + (restrictsIssuance ? 1 : 0) + (specificCaOnly ? 1 : 0);
  const baseAnalysis = {
    available: true,
    checkedHostname: probe.hostname,
    hasRecords: probe.records.length > 0,
    restrictsIssuance,
    specificCaOnly,
    allowedCertificateAuthorities,
    directives,
    score,
    maxScore: CAA_MAX_SCORE,
    grade: scoreToGrade(score, CAA_MAX_SCORE),
    findings
  };

  return {
    ...baseAnalysis,
    summary: summarize(baseAnalysis)
  };
}

function buildUnavailableAnalysis(hostname: string | null, reason: string): CaaAnalysis {
  const baseAnalysis = {
    available: false,
    checkedHostname: hostname,
    hasRecords: false,
    restrictsIssuance: false,
    specificCaOnly: false,
    allowedCertificateAuthorities: [],
    directives: [],
    score: 0,
    maxScore: 0,
    grade: "N/A",
    findings: [
      {
        id: "caa-analysis-unavailable",
        severity: "low" as const,
        message: "CAA analysis could not be completed for this target.",
        recommendation: "Retry the scan and verify DNS resolver availability.",
        evidence: reason
      }
    ]
  };
  return {
    ...baseAnalysis,
    summary: summarize(baseAnalysis)
  };
}

function buildIpAddressAnalysis(hostname: string): CaaAnalysis {
  const baseAnalysis = {
    available: false,
    checkedHostname: hostname,
    hasRecords: false,
    restrictsIssuance: false,
    specificCaOnly: false,
    allowedCertificateAuthorities: [],
    directives: [],
    score: 0,
    maxScore: 0,
    grade: "N/A",
    findings: [
      {
        id: "caa-analysis-ip-target",
        severity: "low" as const,
        message: "CAA checks require a hostname and are not applicable to raw IP targets.",
        recommendation: "Scan a domain/hostname instead of an IP address for CAA evaluation.",
        evidence: hostname
      }
    ]
  };
  return {
    ...baseAnalysis,
    summary: summarize(baseAnalysis)
  };
}

async function probeCaa(hostname: string): Promise<CaaProbeResult> {
  const outcome = await timedQuery(() => resolveCaa(hostname));
  return {
    hostname,
    records: outcome.value ?? [],
    queryError: outcome.errorCode
  };
}

export async function analyzeCaaConfiguration(targetUrl: string): Promise<CaaAnalysis> {
  try {
    const parsed = new URL(targetUrl);
    const hostname = parsed.hostname.trim().toLowerCase();
    if (!hostname) {
      return buildUnavailableAnalysis(null, "Hostname missing from URL.");
    }
    if (isIP(hostname)) {
      return buildIpAddressAnalysis(hostname);
    }

    const probe = await probeCaa(hostname);
    return buildCaaAnalysisFromProbe(probe);
  } catch (error) {
    const reason = error instanceof Error ? error.message : "Unexpected CAA analysis failure.";
    return buildUnavailableAnalysis(null, reason);
  }
}

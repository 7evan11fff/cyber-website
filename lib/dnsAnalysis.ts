import { isIP } from "node:net";
import type { CaaRecord } from "node:dns";
import { lookup, resolve, resolveCaa, resolveMx, resolveTxt } from "node:dns/promises";

export type DnsFindingSeverity = "low" | "medium" | "high" | "critical";
export type DnssecStatus = "configured" | "not-configured" | "unsupported" | "unknown";
export type SpfPolicy = "missing" | "allow-all" | "hard-fail" | "soft-fail" | "neutral" | "missing-all";
export type DmarcPolicy = "missing" | "none" | "quarantine" | "reject" | "invalid";

export type DnsFinding = {
  id: string;
  severity: DnsFindingSeverity;
  message: string;
  recommendation: string;
  evidence: string | null;
};

export type DnsResponseTimings = {
  lookupMs: number | null;
  dnssecMs: number | null;
  caaMs: number | null;
  spfMs: number | null;
  dmarcMs: number | null;
  mxMs: number | null;
  averageMs: number | null;
};

export type DnsProbeResult = {
  hostname: string;
  lookupSuccessful: boolean;
  lookupError: string | null;
  dnssecStatus: DnssecStatus;
  dnssecEvidence: string | null;
  caaRecords: string[];
  spfRecords: string[];
  dmarcRecords: string[];
  mxHosts: string[];
  timings: DnsResponseTimings;
};

export type DnsAnalysis = {
  available: boolean;
  checkedHostname: string | null;
  dnssecStatus: DnssecStatus;
  hasCaa: boolean;
  caaRecords: string[];
  spfRecord: string | null;
  spfRecords: string[];
  spfPolicy: SpfPolicy;
  dmarcRecord: string | null;
  dmarcRecords: string[];
  dmarcPolicy: DmarcPolicy;
  dmarcPct: number | null;
  emailSecurityApplicable: boolean;
  mxHosts: string[];
  responseTimes: DnsResponseTimings;
  score: number;
  maxScore: number;
  grade: string;
  findings: DnsFinding[];
  summary: string;
};

type DmarcParseResult = {
  policy: DmarcPolicy;
  pct: number | null;
};

type DnsQueryOutcome<T> = {
  durationMs: number;
  value: T | null;
  errorCode: string | null;
};

const SLOW_DNS_THRESHOLD_MS = 800;
const VERY_SLOW_DNS_THRESHOLD_MS = 1500;
const UNSUPPORTED_DNSSEC_CODES = new Set(["ENOTIMP", "ENOSYS", "EREFUSED", "ESERVFAIL", "ETIMEOUT"]);
const MISSING_RECORD_CODES = new Set(["ENODATA", "ENOTFOUND", "ENONAME"]);
export const DNS_MAX_SCORE = 10;

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
  const startedAt = Date.now();
  try {
    const value = await query();
    return {
      durationMs: Math.max(0, Date.now() - startedAt),
      value,
      errorCode: null
    };
  } catch (error) {
    return {
      durationMs: Math.max(0, Date.now() - startedAt),
      value: null,
      errorCode: toErrorCode(error)
    };
  }
}

function flattenTxtRecords(records: string[][] | null): string[] {
  if (!records || records.length === 0) return [];
  return records
    .map((parts) => parts.join("").trim())
    .filter((record) => record.length > 0);
}

function classifyDnssec(records: unknown[] | null, errorCode: string | null): DnssecStatus {
  if (records && records.length > 0) {
    return "configured";
  }
  if (errorCode && UNSUPPORTED_DNSSEC_CODES.has(errorCode)) {
    return "unsupported";
  }
  if (!errorCode || MISSING_RECORD_CODES.has(errorCode)) {
    return "not-configured";
  }
  return "unknown";
}

function describeCaaRecord(record: CaaRecord): string {
  const entries: string[] = [];
  if (typeof record.issue === "string") entries.push(`issue ${record.issue}`);
  if (typeof record.issuewild === "string") entries.push(`issuewild ${record.issuewild}`);
  if (typeof record.iodef === "string") entries.push(`iodef ${record.iodef}`);
  return entries.length > 0 ? entries.join("; ") : "critical-flag-only";
}

function resolveSpfPolicy(spfRecord: string | null): SpfPolicy {
  if (!spfRecord) return "missing";
  if (/(?:^|\s)-all(?:\s|$)/i.test(spfRecord)) return "hard-fail";
  if (/(?:^|\s)~all(?:\s|$)/i.test(spfRecord)) return "soft-fail";
  if (/(?:^|\s)\?all(?:\s|$)/i.test(spfRecord)) return "neutral";
  if (/(?:^|\s)(?:\+)?all(?:\s|$)/i.test(spfRecord)) return "allow-all";
  return "missing-all";
}

function parseDmarcPolicy(dmarcRecord: string | null): DmarcParseResult {
  if (!dmarcRecord) {
    return { policy: "missing", pct: null };
  }

  if (!/^v\s*=\s*dmarc1\b/i.test(dmarcRecord)) {
    return { policy: "invalid", pct: null };
  }

  const parts = dmarcRecord
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean);
  const tags = new Map<string, string>();
  for (const part of parts) {
    const equalsIndex = part.indexOf("=");
    if (equalsIndex <= 0) continue;
    const key = part.slice(0, equalsIndex).trim().toLowerCase();
    const value = part.slice(equalsIndex + 1).trim();
    if (key) tags.set(key, value);
  }

  const policyRaw = tags.get("p")?.toLowerCase();
  let policy: DmarcPolicy = "invalid";
  if (policyRaw === "reject" || policyRaw === "quarantine" || policyRaw === "none") {
    policy = policyRaw;
  }

  const pctRaw = tags.get("pct");
  let pct: number | null = null;
  if (pctRaw && /^[0-9]{1,3}$/.test(pctRaw)) {
    const parsedPct = Number(pctRaw);
    pct = parsedPct >= 0 && parsedPct <= 100 ? parsedPct : null;
  }

  return { policy, pct };
}

function averageTimings(timings: number[]): number | null {
  if (timings.length === 0) return null;
  const avg = timings.reduce((sum, value) => sum + value, 0) / timings.length;
  return Math.round(avg);
}

function summarizeDnsAnalysis(analysis: Omit<DnsAnalysis, "summary">): string {
  if (!analysis.available) {
    return "DNS analysis is not applicable for this scan target.";
  }

  if (analysis.findings.length === 0) {
    if (!analysis.emailSecurityApplicable) {
      return "DNS posture looks healthy; no email-specific DNS controls were required for this hostname.";
    }
    return "DNS posture looks healthy with DNSSEC, CAA, SPF, and DMARC controls in a secure state.";
  }

  const criticalCount = analysis.findings.filter((finding) => finding.severity === "critical").length;
  const highCount = analysis.findings.filter((finding) => finding.severity === "high").length;
  const mediumCount = analysis.findings.filter((finding) => finding.severity === "medium").length;
  const segments: string[] = [];
  if (criticalCount > 0) segments.push(`${criticalCount} critical`);
  if (highCount > 0) segments.push(`${highCount} high`);
  if (mediumCount > 0) segments.push(`${mediumCount} medium`);
  if (segments.length === 0) {
    return `DNS findings detected: ${analysis.findings.length} low-risk issue${analysis.findings.length === 1 ? "" : "s"}.`;
  }
  return `DNS findings detected: ${segments.join(", ")} risk issue${analysis.findings.length === 1 ? "" : "s"}.`;
}

export function buildDnsAnalysisFromProbe(probe: DnsProbeResult): DnsAnalysis {
  const hasCaa = probe.caaRecords.length > 0;
  const spfRecords = probe.spfRecords;
  const dmarcRecords = probe.dmarcRecords;
  const spfRecord = spfRecords[0] ?? null;
  const dmarcRecord = dmarcRecords[0] ?? null;
  const spfPolicy = resolveSpfPolicy(spfRecord);
  const dmarc = parseDmarcPolicy(dmarcRecord);
  const emailSecurityApplicable = probe.mxHosts.length > 0 || spfRecords.length > 0 || dmarcRecords.length > 0;

  const findings: DnsFinding[] = [];
  if (!probe.lookupSuccessful && probe.lookupError) {
    findings.push({
      id: "dns-lookup-failed",
      severity: "high",
      message: "Domain DNS resolution failed during analysis.",
      recommendation: "Verify authoritative DNS records and resolver reachability for this hostname.",
      evidence: probe.lookupError
    });
  }

  if (probe.dnssecStatus === "not-configured") {
    findings.push({
      id: "dnssec-not-configured",
      severity: "medium",
      message: "DNSSEC is not configured for this hostname.",
      recommendation: "Sign the zone and publish DNSKEY/DS records to reduce DNS spoofing risk.",
      evidence: probe.dnssecEvidence
    });
  } else if (probe.dnssecStatus === "unsupported" || probe.dnssecStatus === "unknown") {
    findings.push({
      id: "dnssec-status-uncertain",
      severity: "low",
      message: "DNSSEC status could not be verified with the current resolver path.",
      recommendation: "Confirm DNSSEC status from authoritative tooling and ensure validation is enabled upstream.",
      evidence: probe.dnssecEvidence
    });
  }

  if (!hasCaa) {
    findings.push({
      id: "caa-record-missing",
      severity: "medium",
      message: "No CAA records were found for this hostname.",
      recommendation:
        "Publish CAA records to restrict certificate issuance to approved certificate authorities.",
      evidence: null
    });
  }

  if (emailSecurityApplicable) {
    if (spfRecords.length > 1) {
      findings.push({
        id: "spf-multiple-records",
        severity: "high",
        message: "Multiple SPF records were detected.",
        recommendation:
          "Consolidate SPF into a single record to avoid SPF permerror and unpredictable mailbox provider behavior.",
        evidence: spfRecords.join(" | ")
      });
    }

    if (!spfRecord) {
      findings.push({
        id: "spf-missing",
        severity: "medium",
        message: "No SPF record was detected for an email-capable domain.",
        recommendation:
          "Publish an SPF policy for authorized senders and end with -all (preferred) or ~all while deploying.",
        evidence: null
      });
    } else if (spfPolicy === "allow-all") {
      findings.push({
        id: "spf-allow-all",
        severity: "critical",
        message: "SPF policy permits all senders (all/+all).",
        recommendation:
          "Replace permissive SPF with explicit sender mechanisms and a restrictive all mechanism (ideally -all).",
        evidence: spfRecord
      });
    } else if (spfPolicy === "missing-all" || spfPolicy === "neutral") {
      findings.push({
        id: "spf-weak-enforcement",
        severity: "medium",
        message: "SPF policy does not provide strong enforcement.",
        recommendation:
          "Use an SPF policy that ends with -all once sender inventory is complete; use ~all only as a temporary phase.",
        evidence: spfRecord
      });
    } else if (spfPolicy === "soft-fail") {
      findings.push({
        id: "spf-soft-fail",
        severity: "low",
        message: "SPF uses soft-fail (~all), which offers weaker enforcement than hard-fail.",
        recommendation: "Move to -all after validating legitimate sender infrastructure.",
        evidence: spfRecord
      });
    }

    if (dmarcRecords.length > 1) {
      findings.push({
        id: "dmarc-multiple-records",
        severity: "high",
        message: "Multiple DMARC records were detected.",
        recommendation: "Publish exactly one DMARC TXT record at _dmarc.<domain>.",
        evidence: dmarcRecords.join(" | ")
      });
    }

    if (!dmarcRecord) {
      findings.push({
        id: "dmarc-missing",
        severity: "medium",
        message: "No DMARC record was detected for an email-capable domain.",
        recommendation: "Publish a DMARC policy (start with p=quarantine or p=reject where possible).",
        evidence: null
      });
    } else if (dmarc.policy === "invalid") {
      findings.push({
        id: "dmarc-invalid",
        severity: "high",
        message: "DMARC record is malformed or missing a valid p= policy.",
        recommendation: "Ensure the DMARC record starts with v=DMARC1 and sets p=none|quarantine|reject.",
        evidence: dmarcRecord
      });
    } else if (dmarc.policy === "none") {
      findings.push({
        id: "dmarc-monitor-only",
        severity: "medium",
        message: "DMARC policy is set to monitoring only (p=none).",
        recommendation:
          "Move toward enforcement with p=quarantine and then p=reject after validating legitimate senders.",
        evidence: dmarcRecord
      });
    }

    if (dmarc.pct !== null && dmarc.pct < 100 && (dmarc.policy === "quarantine" || dmarc.policy === "reject")) {
      findings.push({
        id: "dmarc-partial-enforcement",
        severity: "low",
        message: `DMARC enforcement covers only ${dmarc.pct}% of messages.`,
        recommendation: "Raise DMARC pct=100 once enforcement behavior is stable.",
        evidence: dmarcRecord
      });
    }
  }

  const averageMs = probe.timings.averageMs;
  if (typeof averageMs === "number" && averageMs > VERY_SLOW_DNS_THRESHOLD_MS) {
    findings.push({
      id: "dns-response-very-slow",
      severity: "medium",
      message: `DNS response time is very high (${averageMs} ms average).`,
      recommendation: "Review DNS provider latency, resolver health, and regional Anycast coverage.",
      evidence: `${averageMs} ms`
    });
  } else if (typeof averageMs === "number" && averageMs > SLOW_DNS_THRESHOLD_MS) {
    findings.push({
      id: "dns-response-slow",
      severity: "low",
      message: `DNS response time is elevated (${averageMs} ms average).`,
      recommendation: "Optimize authoritative DNS performance and monitor latency by region.",
      evidence: `${averageMs} ms`
    });
  }

  let maxScore = 5; // DNSSEC + CAA + DNS responsiveness
  let score = 0;

  if (probe.dnssecStatus === "configured") {
    score += 2;
  }
  if (hasCaa) {
    score += 2;
  }
  if (typeof averageMs === "number" && averageMs <= SLOW_DNS_THRESHOLD_MS) {
    score += 1;
  }

  if (emailSecurityApplicable) {
    maxScore += 5; // SPF + DMARC
    if (spfPolicy === "hard-fail") {
      score += 2;
    } else if (spfPolicy === "soft-fail") {
      score += 1;
    }

    if (dmarc.policy === "reject") {
      score += dmarc.pct !== null && dmarc.pct < 100 ? 2 : 3;
    } else if (dmarc.policy === "quarantine") {
      score += dmarc.pct !== null && dmarc.pct < 100 ? 1 : 2;
    } else if (dmarc.policy === "none") {
      score += 1;
    }
  }

  score = Math.max(0, Math.min(score, maxScore));
  const baseAnalysis = {
    available: true,
    checkedHostname: probe.hostname,
    dnssecStatus: probe.dnssecStatus,
    hasCaa,
    caaRecords: probe.caaRecords,
    spfRecord,
    spfRecords,
    spfPolicy,
    dmarcRecord,
    dmarcRecords,
    dmarcPolicy: dmarc.policy,
    dmarcPct: dmarc.pct,
    emailSecurityApplicable,
    mxHosts: probe.mxHosts,
    responseTimes: probe.timings,
    score,
    maxScore,
    grade: scoreToGrade(score, maxScore),
    findings
  };

  return {
    ...baseAnalysis,
    summary: summarizeDnsAnalysis(baseAnalysis)
  };
}

function buildUnavailableAnalysis(hostname: string | null, reason: string): DnsAnalysis {
  const baseAnalysis = {
    available: false,
    checkedHostname: hostname,
    dnssecStatus: "unknown" as const,
    hasCaa: false,
    caaRecords: [],
    spfRecord: null,
    spfRecords: [],
    spfPolicy: "missing" as const,
    dmarcRecord: null,
    dmarcRecords: [],
    dmarcPolicy: "missing" as const,
    dmarcPct: null,
    emailSecurityApplicable: false,
    mxHosts: [],
    responseTimes: {
      lookupMs: null,
      dnssecMs: null,
      caaMs: null,
      spfMs: null,
      dmarcMs: null,
      mxMs: null,
      averageMs: null
    },
    score: 0,
    maxScore: 0,
    grade: "N/A",
    findings: [
      {
        id: "dns-analysis-unavailable",
        severity: "low" as const,
        message: "DNS security analysis could not be completed.",
        recommendation: "Retry the scan and verify resolver/network availability.",
        evidence: reason
      }
    ]
  };

  return {
    ...baseAnalysis,
    summary: summarizeDnsAnalysis(baseAnalysis)
  };
}

function buildIpAddressAnalysis(hostname: string): DnsAnalysis {
  const baseAnalysis = {
    available: false,
    checkedHostname: hostname,
    dnssecStatus: "unknown" as const,
    hasCaa: false,
    caaRecords: [],
    spfRecord: null,
    spfRecords: [],
    spfPolicy: "missing" as const,
    dmarcRecord: null,
    dmarcRecords: [],
    dmarcPolicy: "missing" as const,
    dmarcPct: null,
    emailSecurityApplicable: false,
    mxHosts: [],
    responseTimes: {
      lookupMs: null,
      dnssecMs: null,
      caaMs: null,
      spfMs: null,
      dmarcMs: null,
      mxMs: null,
      averageMs: null
    },
    score: 0,
    maxScore: 0,
    grade: "N/A",
    findings: [
      {
        id: "dns-analysis-ip-target",
        severity: "low" as const,
        message: "DNS security checks are not applicable to direct IP targets.",
        recommendation: "Scan a hostname/domain to evaluate DNSSEC, CAA, SPF, and DMARC controls.",
        evidence: hostname
      }
    ]
  };

  return {
    ...baseAnalysis,
    summary: summarizeDnsAnalysis(baseAnalysis)
  };
}

async function probeDns(hostname: string): Promise<DnsProbeResult> {
  const [lookupOutcome, dnssecOutcome, caaOutcome, spfOutcome, dmarcOutcome, mxOutcome] = await Promise.all([
    timedQuery(() => lookup(hostname, { all: true })),
    timedQuery(() => resolve(hostname, "DNSKEY") as Promise<unknown[]>),
    timedQuery(() => resolveCaa(hostname)),
    timedQuery(() => resolveTxt(hostname)),
    timedQuery(() => resolveTxt(`_dmarc.${hostname}`)),
    timedQuery(() => resolveMx(hostname))
  ]);

  const spfTxtRecords = flattenTxtRecords(spfOutcome.value);
  const dmarcTxtRecords = flattenTxtRecords(dmarcOutcome.value);
  const dnssecStatus = classifyDnssec(dnssecOutcome.value, dnssecOutcome.errorCode);
  const dnssecEvidence =
    dnssecStatus === "configured"
      ? `${dnssecOutcome.value?.length ?? 0} DNSKEY record${dnssecOutcome.value?.length === 1 ? "" : "s"}`
      : dnssecOutcome.errorCode;
  const caaRecords = (caaOutcome.value ?? []).map(describeCaaRecord);
  const spfRecords = spfTxtRecords.filter((record) => /^v=spf1\b/i.test(record));
  const dmarcRecords = dmarcTxtRecords;
  const mxHosts = (mxOutcome.value ?? []).map((record) => record.exchange).filter(Boolean);

  const timingSamples = [
    lookupOutcome.durationMs,
    dnssecOutcome.durationMs,
    caaOutcome.durationMs,
    spfOutcome.durationMs,
    dmarcOutcome.durationMs,
    mxOutcome.durationMs
  ].filter((value) => Number.isFinite(value) && value >= 0);

  return {
    hostname,
    lookupSuccessful: (lookupOutcome.value?.length ?? 0) > 0,
    lookupError: lookupOutcome.errorCode,
    dnssecStatus,
    dnssecEvidence,
    caaRecords,
    spfRecords,
    dmarcRecords,
    mxHosts,
    timings: {
      lookupMs: lookupOutcome.durationMs,
      dnssecMs: dnssecOutcome.durationMs,
      caaMs: caaOutcome.durationMs,
      spfMs: spfOutcome.durationMs,
      dmarcMs: dmarcOutcome.durationMs,
      mxMs: mxOutcome.durationMs,
      averageMs: averageTimings(timingSamples)
    }
  };
}

export async function analyzeDnsConfiguration(targetUrl: string): Promise<DnsAnalysis> {
  try {
    const parsed = new URL(targetUrl);
    const hostname = parsed.hostname.trim().toLowerCase();
    if (!hostname) {
      return buildUnavailableAnalysis(null, "Hostname missing from URL.");
    }
    if (isIP(hostname)) {
      return buildIpAddressAnalysis(hostname);
    }

    const probe = await probeDns(hostname);
    return buildDnsAnalysisFromProbe(probe);
  } catch (error) {
    const reason = error instanceof Error ? error.message : "Unexpected DNS analysis failure.";
    return buildUnavailableAnalysis(null, reason);
  }
}

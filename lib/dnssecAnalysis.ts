import { isIP } from "node:net";
import { resolve } from "node:dns/promises";

export type DnssecStatus = "enabled" | "partial" | "disabled";
export type DnssecFindingSeverity = "low" | "medium" | "high";

export type DnssecFinding = {
  id: string;
  severity: DnssecFindingSeverity;
  message: string;
  recommendation: string;
  evidence: string | null;
};

export type DnssecAnalysis = {
  available: boolean;
  checkedHostname: string | null;
  status: DnssecStatus;
  zoneSigned: boolean;
  parentHasDs: boolean;
  chainValid: boolean;
  dnskeyRecordCount: number;
  dsRecordCount: number;
  dnskeyRecords: string[];
  dsRecords: string[];
  queryErrors: {
    dnskey: string | null;
    ds: string | null;
  };
  score: number;
  maxScore: number;
  grade: string;
  findings: DnssecFinding[];
  summary: string;
};

export type DnssecProbeResult = {
  hostname: string;
  dnskeyRecords: unknown[];
  dsRecords: unknown[];
  dnskeyError: string | null;
  dsError: string | null;
};

type DnsQueryOutcome<T> = {
  value: T | null;
  errorCode: string | null;
};

const MISSING_RECORD_CODES = new Set(["ENODATA", "ENOTFOUND", "ENONAME"]);
export const DNSSEC_MAX_SCORE = 3;

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

function serializeUnknown(record: unknown): string {
  if (typeof record === "string") return record;
  if (record && typeof record === "object") {
    try {
      return JSON.stringify(record);
    } catch {
      return "[unserializable-record]";
    }
  }
  return String(record);
}

function formatDnskeyRecord(record: unknown): string {
  if (!record || typeof record !== "object") return serializeUnknown(record);
  const candidate = record as {
    flags?: unknown;
    protocol?: unknown;
    algorithm?: unknown;
  };
  if (
    typeof candidate.flags === "number" &&
    typeof candidate.protocol === "number" &&
    typeof candidate.algorithm === "number"
  ) {
    return `flags=${candidate.flags}, protocol=${candidate.protocol}, algorithm=${candidate.algorithm}`;
  }
  return serializeUnknown(record);
}

function formatDsRecord(record: unknown): string {
  if (!record || typeof record !== "object") return serializeUnknown(record);
  const candidate = record as {
    keyTag?: unknown;
    algorithm?: unknown;
    digestType?: unknown;
  };
  if (
    typeof candidate.keyTag === "number" &&
    typeof candidate.algorithm === "number" &&
    typeof candidate.digestType === "number"
  ) {
    return `keyTag=${candidate.keyTag}, algorithm=${candidate.algorithm}, digestType=${candidate.digestType}`;
  }
  return serializeUnknown(record);
}

function classifyStatus(dnskeyCount: number, dsCount: number): DnssecStatus {
  if (dnskeyCount > 0 && dsCount > 0) return "enabled";
  if (dnskeyCount > 0 || dsCount > 0) return "partial";
  return "disabled";
}

function summarize(analysis: Omit<DnssecAnalysis, "summary">): string {
  if (!analysis.available) {
    return "DNSSEC analysis was not available for this scan target.";
  }
  if (analysis.status === "enabled") {
    return "DNSSEC is enabled with both DNSKEY and DS records present.";
  }
  if (analysis.status === "partial") {
    if (analysis.zoneSigned && !analysis.parentHasDs) {
      return "DNS zone appears signed, but DS records were not found at the parent.";
    }
    if (!analysis.zoneSigned && analysis.parentHasDs) {
      return "DS records exist at the parent, but DNSKEY records were not found for this zone.";
    }
    return "DNSSEC is partially configured and should be reviewed for chain completeness.";
  }
  return "DNSSEC appears disabled because DNSKEY and DS records were not detected.";
}

export function buildDnssecAnalysisFromProbe(probe: DnssecProbeResult): DnssecAnalysis {
  const dnskeyRecordCount = probe.dnskeyRecords.length;
  const dsRecordCount = probe.dsRecords.length;
  const status = classifyStatus(dnskeyRecordCount, dsRecordCount);
  const zoneSigned = dnskeyRecordCount > 0;
  const parentHasDs = dsRecordCount > 0;
  const chainValid = zoneSigned && parentHasDs;
  const findings: DnssecFinding[] = [];

  if (status === "disabled") {
    findings.push({
      id: "dnssec-disabled",
      severity: "medium",
      message: "DNSSEC records were not detected for this hostname.",
      recommendation: "Enable DNSSEC signing and publish DS records at the parent zone.",
      evidence: [probe.dnskeyError, probe.dsError].filter(Boolean).join(" | ") || null
    });
  } else if (status === "partial") {
    findings.push({
      id: "dnssec-chain-incomplete",
      severity: "high",
      message: chainValid
        ? "DNSSEC chain data appears inconsistent."
        : "DNSSEC is only partially configured and chain validation may fail.",
      recommendation:
        "Ensure DNSKEY records are published for the zone and matching DS records are present at the parent.",
      evidence: `DNSKEY=${dnskeyRecordCount}, DS=${dsRecordCount}`
    });
  }

  if (
    dnskeyRecordCount === 0 &&
    dsRecordCount === 0 &&
    probe.dnskeyError &&
    probe.dsError &&
    !MISSING_RECORD_CODES.has(probe.dnskeyError) &&
    !MISSING_RECORD_CODES.has(probe.dsError)
  ) {
    findings.push({
      id: "dnssec-resolver-uncertain",
      severity: "low",
      message: "Resolver responses were inconclusive while checking DNSSEC records.",
      recommendation: "Verify DNSSEC state from authoritative DNS tooling as a secondary validation.",
      evidence: `DNSKEY=${probe.dnskeyError}, DS=${probe.dsError}`
    });
  }

  const score = status === "enabled" ? DNSSEC_MAX_SCORE : status === "partial" ? 1 : 0;
  const baseAnalysis = {
    available: true,
    checkedHostname: probe.hostname,
    status,
    zoneSigned,
    parentHasDs,
    chainValid,
    dnskeyRecordCount,
    dsRecordCount,
    dnskeyRecords: probe.dnskeyRecords.map(formatDnskeyRecord),
    dsRecords: probe.dsRecords.map(formatDsRecord),
    queryErrors: {
      dnskey: probe.dnskeyError,
      ds: probe.dsError
    },
    score,
    maxScore: DNSSEC_MAX_SCORE,
    grade: scoreToGrade(score, DNSSEC_MAX_SCORE),
    findings
  };

  return {
    ...baseAnalysis,
    summary: summarize(baseAnalysis)
  };
}

function buildUnavailableAnalysis(hostname: string | null, reason: string): DnssecAnalysis {
  const baseAnalysis = {
    available: false,
    checkedHostname: hostname,
    status: "disabled" as const,
    zoneSigned: false,
    parentHasDs: false,
    chainValid: false,
    dnskeyRecordCount: 0,
    dsRecordCount: 0,
    dnskeyRecords: [],
    dsRecords: [],
    queryErrors: {
      dnskey: null,
      ds: null
    },
    score: 0,
    maxScore: 0,
    grade: "N/A",
    findings: [
      {
        id: "dnssec-analysis-unavailable",
        severity: "low" as const,
        message: "DNSSEC analysis could not be completed for this target.",
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

function buildIpAddressAnalysis(hostname: string): DnssecAnalysis {
  const baseAnalysis = {
    available: false,
    checkedHostname: hostname,
    status: "disabled" as const,
    zoneSigned: false,
    parentHasDs: false,
    chainValid: false,
    dnskeyRecordCount: 0,
    dsRecordCount: 0,
    dnskeyRecords: [],
    dsRecords: [],
    queryErrors: {
      dnskey: null,
      ds: null
    },
    score: 0,
    maxScore: 0,
    grade: "N/A",
    findings: [
      {
        id: "dnssec-analysis-ip-target",
        severity: "low" as const,
        message: "DNSSEC checks require a hostname and are not applicable to raw IP targets.",
        recommendation: "Scan a domain/hostname instead of an IP address for DNSSEC validation.",
        evidence: hostname
      }
    ]
  };

  return {
    ...baseAnalysis,
    summary: summarize(baseAnalysis)
  };
}

async function probeDnssec(hostname: string): Promise<DnssecProbeResult> {
  const [dnskeyOutcome, dsOutcome] = await Promise.all([
    timedQuery(() => resolve(hostname, "DNSKEY") as Promise<unknown[]>),
    timedQuery(() => resolve(hostname, "DS") as Promise<unknown[]>)
  ]);

  return {
    hostname,
    dnskeyRecords: dnskeyOutcome.value ?? [],
    dsRecords: dsOutcome.value ?? [],
    dnskeyError: dnskeyOutcome.errorCode,
    dsError: dsOutcome.errorCode
  };
}

export async function analyzeDnssecConfiguration(targetUrl: string): Promise<DnssecAnalysis> {
  try {
    const parsed = new URL(targetUrl);
    const hostname = parsed.hostname.trim().toLowerCase();
    if (!hostname) {
      return buildUnavailableAnalysis(null, "Hostname missing from URL.");
    }
    if (isIP(hostname)) {
      return buildIpAddressAnalysis(hostname);
    }

    const probe = await probeDnssec(hostname);
    return buildDnssecAnalysisFromProbe(probe);
  } catch (error) {
    const reason = error instanceof Error ? error.message : "Unexpected DNSSEC analysis failure.";
    return buildUnavailableAnalysis(null, reason);
  }
}

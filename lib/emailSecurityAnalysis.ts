import { resolveTxt } from "node:dns/promises";

export type EmailSecurityFindingSeverity = "low" | "medium" | "high" | "critical";
export type EmailSecuritySpfPolicy =
  | "missing"
  | "hard-fail"
  | "soft-fail"
  | "neutral"
  | "allow-all"
  | "missing-all";
export type EmailSecurityDmarcPolicy = "missing" | "none" | "quarantine" | "reject" | "invalid";

export type EmailSecurityFinding = {
  id: string;
  severity: EmailSecurityFindingSeverity;
  message: string;
  evidence: string | null;
};

export type SpfAnalysis = {
  domain: string;
  record: string | null;
  records: string[];
  policy: EmailSecuritySpfPolicy;
  dnsLookupCount: number;
  tooManyLookups: boolean;
  lookupLimit: number;
  notes: string[];
};

export type DmarcAnalysis = {
  domain: string;
  record: string | null;
  records: string[];
  policy: EmailSecurityDmarcPolicy;
  rua: string[];
  ruf: string[];
  pct: number | null;
  hasReporting: boolean;
  notes: string[];
};

export type DkimSelectorAnalysis = {
  domain: string;
  selector: string;
  host: string;
  record: string | null;
  records: string[];
  present: boolean;
  valid: boolean;
  notes: string[];
};

export type DkimAnalysis = {
  testedSelectors: string[];
  selectors: DkimSelectorAnalysis[];
  presentSelectors: string[];
  present: boolean;
};

export type EmailSecurityAnalysis = {
  domain: string;
  spf: SpfAnalysis;
  dmarc: DmarcAnalysis;
  dkim: DkimAnalysis;
  score: number;
  maxScore: number;
  findings: EmailSecurityFinding[];
  recommendations: string[];
};

type DmarcParseResult = {
  policy: EmailSecurityDmarcPolicy;
  rua: string[];
  ruf: string[];
  pct: number | null;
};

type TxtResolver = (hostname: string) => Promise<string[][]>;

const MISSING_RECORD_CODES = new Set(["ENODATA", "ENOTFOUND", "ENONAME", "ENXDOMAIN"]);
const SPF_LOOKUP_LIMIT = 10;
export const EMAIL_SECURITY_MAX_SCORE = 30;
export const COMMON_DKIM_SELECTORS = ["google", "selector1", "selector2", "default", "mail"] as const;

function pushUnique(target: string[], value: string) {
  if (!target.includes(value)) {
    target.push(value);
  }
}

function normalizeDomain(domain: string): string {
  return domain.trim().toLowerCase().replace(/\.$/, "");
}

function toErrorCode(error: unknown): string | null {
  if (!error || typeof error !== "object") return null;
  const code = (error as { code?: unknown }).code;
  return typeof code === "string" ? code.toUpperCase() : null;
}

async function resolveTxtRecords(hostname: string, resolver: TxtResolver): Promise<{ records: string[]; errorCode: string | null }> {
  try {
    const records = await resolver(hostname);
    return {
      records: records.map((parts) => parts.join("").trim()).filter(Boolean),
      errorCode: null
    };
  } catch (error) {
    const errorCode = toErrorCode(error);
    if (errorCode && MISSING_RECORD_CODES.has(errorCode)) {
      return {
        records: [],
        errorCode
      };
    }
    return {
      records: [],
      errorCode: errorCode ?? "UNKNOWN"
    };
  }
}

function parseSpfPolicy(record: string | null): EmailSecuritySpfPolicy {
  if (!record) return "missing";
  if (/(?:^|\s)-all(?:\s|$)/i.test(record)) return "hard-fail";
  if (/(?:^|\s)~all(?:\s|$)/i.test(record)) return "soft-fail";
  if (/(?:^|\s)\?all(?:\s|$)/i.test(record)) return "neutral";
  if (/(?:^|\s)(?:\+)?all(?:\s|$)/i.test(record)) return "allow-all";
  return "missing-all";
}

function countSpfDnsLookups(record: string | null): number {
  if (!record) return 0;
  const normalized = record.trim();
  if (!/^v=spf1\b/i.test(normalized)) return 0;

  const tokens = normalized
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean);

  let lookups = 0;
  for (const token of tokens) {
    if (/^[+\-~?]?include:/i.test(token)) {
      lookups += 1;
      continue;
    }
    if (/^[+\-~?]?a(?::|\/|$)/i.test(token)) {
      lookups += 1;
      continue;
    }
    if (/^[+\-~?]?mx(?::|\/|$)/i.test(token)) {
      lookups += 1;
      continue;
    }
    if (/^[+\-~?]?ptr(?::|$)/i.test(token)) {
      lookups += 1;
      continue;
    }
    if (/^[+\-~?]?exists:/i.test(token)) {
      lookups += 1;
      continue;
    }
    if (/^redirect=/i.test(token)) {
      lookups += 1;
      continue;
    }
  }

  return lookups;
}

function parseDmarcRecord(record: string | null): DmarcParseResult {
  if (!record) {
    return {
      policy: "missing",
      rua: [],
      ruf: [],
      pct: null
    };
  }

  if (!/^v\s*=\s*dmarc1\b/i.test(record)) {
    return {
      policy: "invalid",
      rua: [],
      ruf: [],
      pct: null
    };
  }

  const tags = new Map<string, string>();
  for (const part of record.split(";")) {
    const token = part.trim();
    if (!token) continue;
    const equalsIndex = token.indexOf("=");
    if (equalsIndex <= 0) continue;
    const key = token.slice(0, equalsIndex).trim().toLowerCase();
    const value = token.slice(equalsIndex + 1).trim();
    if (key) {
      tags.set(key, value);
    }
  }

  const policyRaw = tags.get("p")?.toLowerCase();
  const policy: EmailSecurityDmarcPolicy =
    policyRaw === "none" || policyRaw === "quarantine" || policyRaw === "reject" ? policyRaw : "invalid";
  const rua = (tags.get("rua") ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
  const ruf = (tags.get("ruf") ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
  const pctRaw = tags.get("pct");
  const pct =
    pctRaw && /^[0-9]{1,3}$/.test(pctRaw) && Number(pctRaw) >= 0 && Number(pctRaw) <= 100 ? Number(pctRaw) : null;

  return {
    policy,
    rua,
    ruf,
    pct
  };
}

export async function fetchSpfRecord(domain: string, resolver: TxtResolver = resolveTxt): Promise<SpfAnalysis> {
  const normalizedDomain = normalizeDomain(domain);
  const notes: string[] = [];
  const txt = await resolveTxtRecords(normalizedDomain, resolver);
  const records = txt.records.filter((record) => /^v=spf1\b/i.test(record));
  if (txt.errorCode && !MISSING_RECORD_CODES.has(txt.errorCode)) {
    notes.push(`SPF lookup error: ${txt.errorCode}`);
  }
  if (records.length > 1) {
    notes.push("Multiple SPF records detected; this can cause SPF permerror.");
  }

  const record = records[0] ?? null;
  const policy = parseSpfPolicy(record);
  const dnsLookupCount = countSpfDnsLookups(record);
  const tooManyLookups = dnsLookupCount > SPF_LOOKUP_LIMIT;
  if (tooManyLookups) {
    notes.push(`SPF uses ${dnsLookupCount} DNS lookups; the RFC limit is ${SPF_LOOKUP_LIMIT}.`);
  }

  return {
    domain: normalizedDomain,
    record,
    records,
    policy,
    dnsLookupCount,
    tooManyLookups,
    lookupLimit: SPF_LOOKUP_LIMIT,
    notes
  };
}

export async function fetchDmarcRecord(domain: string, resolver: TxtResolver = resolveTxt): Promise<DmarcAnalysis> {
  const normalizedDomain = normalizeDomain(domain);
  const notes: string[] = [];
  const txt = await resolveTxtRecords(`_dmarc.${normalizedDomain}`, resolver);
  const records = txt.records;
  if (txt.errorCode && !MISSING_RECORD_CODES.has(txt.errorCode)) {
    notes.push(`DMARC lookup error: ${txt.errorCode}`);
  }
  if (records.length > 1) {
    notes.push("Multiple DMARC records detected; publish exactly one record at _dmarc.<domain>.");
  }

  const record = records[0] ?? null;
  const parsed = parseDmarcRecord(record);
  if (record && parsed.policy === "invalid") {
    notes.push("DMARC record is malformed or missing a valid p= policy.");
  }

  return {
    domain: normalizedDomain,
    record,
    records,
    policy: parsed.policy,
    rua: parsed.rua,
    ruf: parsed.ruf,
    pct: parsed.pct,
    hasReporting: parsed.rua.length > 0 || parsed.ruf.length > 0,
    notes
  };
}

export async function fetchDkimSelector(
  domain: string,
  selector: string,
  resolver: TxtResolver = resolveTxt
): Promise<DkimSelectorAnalysis> {
  const normalizedDomain = normalizeDomain(domain);
  const normalizedSelector = selector.trim().toLowerCase();
  const notes: string[] = [];
  const host = `${normalizedSelector}._domainkey.${normalizedDomain}`;
  const txt = await resolveTxtRecords(host, resolver);
  if (txt.errorCode && !MISSING_RECORD_CODES.has(txt.errorCode)) {
    notes.push(`DKIM lookup error: ${txt.errorCode}`);
  }

  const records = txt.records;
  const record = records[0] ?? null;
  const present = records.length > 0;
  const valid = records.some((candidate) => /\bv\s*=\s*dkim1\b/i.test(candidate));
  if (present && !valid) {
    notes.push("Selector has TXT records but no explicit v=DKIM1 marker.");
  }

  return {
    domain: normalizedDomain,
    selector: normalizedSelector,
    host,
    record,
    records,
    present,
    valid,
    notes
  };
}

export async function analyzeEmailSecurity(
  domain: string,
  options: {
    selectors?: readonly string[];
    resolver?: TxtResolver;
  } = {}
): Promise<EmailSecurityAnalysis> {
  const normalizedDomain = normalizeDomain(domain);
  const resolver = options.resolver ?? resolveTxt;
  const selectors = options.selectors?.length ? [...options.selectors] : [...COMMON_DKIM_SELECTORS];

  const [spf, dmarc, ...dkimSelectors] = await Promise.all([
    fetchSpfRecord(normalizedDomain, resolver),
    fetchDmarcRecord(normalizedDomain, resolver),
    ...selectors.map((selector) => fetchDkimSelector(normalizedDomain, selector, resolver))
  ]);

  const dkimPresentSelectors = dkimSelectors.filter((entry) => entry.present).map((entry) => entry.selector);
  const dkimPresent = dkimPresentSelectors.length > 0;
  const dkim: DkimAnalysis = {
    testedSelectors: selectors.map((selector) => selector.trim().toLowerCase()),
    selectors: dkimSelectors,
    presentSelectors: dkimPresentSelectors,
    present: dkimPresent
  };

  const findings: EmailSecurityFinding[] = [];
  const recommendations: string[] = [];
  let score = 0;

  if (dmarc.policy === "reject") {
    score += 15;
  } else if (dmarc.policy === "quarantine") {
    score += 10;
  }

  if (spf.policy === "hard-fail") {
    score += 10;
  } else if (spf.policy === "soft-fail") {
    score += 5;
  }

  if (dkimPresent) {
    score += 5;
  }

  if (spf.policy === "missing") {
    findings.push({
      id: "spf-missing",
      severity: "high",
      message: "No SPF record was detected.",
      evidence: null
    });
    recommendations.push("Publish a single SPF record and end with -all (or ~all while migrating).");
  } else if (spf.policy === "allow-all") {
    findings.push({
      id: "spf-allow-all",
      severity: "critical",
      message: "SPF policy allows all senders (+all/all).",
      evidence: spf.record
    });
    recommendations.push("Replace +all/all with explicit mechanisms and enforce -all.");
  } else if (spf.policy === "neutral" || spf.policy === "missing-all") {
    findings.push({
      id: "spf-weak-policy",
      severity: "medium",
      message: "SPF policy does not provide clear enforcement.",
      evidence: spf.record
    });
    recommendations.push("Use a stronger SPF ending with -all after validating authorized senders.");
  } else if (spf.policy === "soft-fail") {
    findings.push({
      id: "spf-soft-fail",
      severity: "low",
      message: "SPF uses ~all (soft fail), which is weaker than -all.",
      evidence: spf.record
    });
    recommendations.push("Move SPF from ~all to -all when sender inventory is complete.");
  }

  if (spf.tooManyLookups) {
    findings.push({
      id: "spf-too-many-lookups",
      severity: "high",
      message: `SPF evaluation can exceed ${spf.lookupLimit} DNS lookups.`,
      evidence: `${spf.dnsLookupCount} lookups`
    });
    recommendations.push("Flatten or simplify SPF includes to stay within the 10 DNS lookup RFC limit.");
  }
  if (spf.records.length > 1) {
    findings.push({
      id: "spf-multiple-records",
      severity: "high",
      message: "Multiple SPF records were detected.",
      evidence: spf.records.join(" | ")
    });
    recommendations.push("Consolidate SPF into one TXT record starting with v=spf1.");
  }

  if (dmarc.policy === "missing") {
    findings.push({
      id: "dmarc-missing",
      severity: "high",
      message: "No DMARC record was detected.",
      evidence: null
    });
    recommendations.push("Publish a DMARC record at _dmarc.<domain> with at least p=quarantine.");
  } else if (dmarc.policy === "invalid") {
    findings.push({
      id: "dmarc-invalid",
      severity: "high",
      message: "DMARC record is invalid or missing a supported policy.",
      evidence: dmarc.record
    });
    recommendations.push("Ensure DMARC starts with v=DMARC1 and includes p=none|quarantine|reject.");
  } else if (dmarc.policy === "none") {
    findings.push({
      id: "dmarc-monitor-only",
      severity: "medium",
      message: "DMARC is in monitoring mode (p=none).",
      evidence: dmarc.record
    });
    recommendations.push("Advance DMARC from p=none to p=quarantine, then p=reject.");
  }

  if (dmarc.records.length > 1) {
    findings.push({
      id: "dmarc-multiple-records",
      severity: "high",
      message: "Multiple DMARC records were detected.",
      evidence: dmarc.records.join(" | ")
    });
    recommendations.push("Publish exactly one DMARC TXT record.");
  }

  if (!dmarc.hasReporting) {
    findings.push({
      id: "dmarc-reporting-missing",
      severity: "low",
      message: "DMARC reporting addresses (rua/ruf) are not configured.",
      evidence: dmarc.record
    });
    recommendations.push("Add rua and optionally ruf mailboxes to monitor spoofing and alignment failures.");
  }

  if (!dkimPresent) {
    findings.push({
      id: "dkim-missing-common-selectors",
      severity: "medium",
      message: "No DKIM record was found across common selectors.",
      evidence: dkim.testedSelectors.join(", ")
    });
    recommendations.push(
      "Enable DKIM signing in your mail provider and publish the corresponding selector TXT record(s)."
    );
  }

  for (const note of [...spf.notes, ...dmarc.notes, ...dkim.selectors.flatMap((entry) => entry.notes)]) {
    findings.push({
      id: `lookup-note-${findings.length + 1}`,
      severity: "low",
      message: note,
      evidence: null
    });
  }

  const deduplicatedRecommendations: string[] = [];
  for (const recommendation of recommendations) {
    pushUnique(deduplicatedRecommendations, recommendation);
  }

  return {
    domain: normalizedDomain,
    spf,
    dmarc,
    dkim,
    score: Math.max(0, Math.min(score, EMAIL_SECURITY_MAX_SCORE)),
    maxScore: EMAIL_SECURITY_MAX_SCORE,
    findings,
    recommendations: deduplicatedRecommendations
  };
}

export const __private__ = {
  parseSpfPolicy,
  countSpfDnsLookups,
  parseDmarcRecord
};

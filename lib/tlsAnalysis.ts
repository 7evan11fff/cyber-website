import net from "node:net";
import tls from "node:tls";

export type TlsFindingSeverity = "low" | "medium" | "high" | "critical";

export type TlsFinding = {
  id: string;
  severity: TlsFindingSeverity;
  message: string;
  recommendation: string;
  evidence: string | null;
};

export type TlsAnalysis = {
  available: boolean;
  checkedHostname: string | null;
  checkedPort: number | null;
  tlsVersion: string | null;
  isInsecureTlsVersion: boolean;
  prefersTls13: boolean;
  cipherName: string | null;
  cipherVersion: string | null;
  weakAlgorithms: string[];
  issuer: string | null;
  issuerCategory: string;
  subject: string | null;
  validFrom: string | null;
  validTo: string | null;
  daysUntilExpiration: number | null;
  certificateValid: boolean;
  certificateExpired: boolean;
  certificateExpiringSoon: boolean;
  chainComplete: boolean;
  chainLength: number;
  selfSigned: boolean;
  authorized: boolean;
  authorizationError: string | null;
  score: number;
  maxScore: number;
  grade: string;
  findings: TlsFinding[];
  summary: string;
};

export type TlsProbeResult = {
  hostname: string;
  port: number;
  tlsVersion: string | null;
  cipherName: string | null;
  cipherVersion: string | null;
  issuer: string | null;
  subject: string | null;
  validFrom: string | null;
  validTo: string | null;
  daysUntilExpiration: number | null;
  chainLength: number;
  authorized: boolean;
  authorizationError: string | null;
  selfSigned: boolean;
  weakAlgorithms: string[];
};

type AnalyzeTlsOptions = {
  timeoutMs?: number;
};

const DEFAULT_TLS_TIMEOUT_MS = 7000;
const TLS_EXPIRING_SOON_DAYS = 30;
export const TLS_MAX_SCORE = 10;

const INCOMPLETE_CHAIN_ERRORS = new Set([
  "UNABLE_TO_VERIFY_LEAF_SIGNATURE",
  "UNABLE_TO_GET_ISSUER_CERT",
  "UNABLE_TO_GET_ISSUER_CERT_LOCALLY",
  "CERT_CHAIN_TOO_LONG"
]);

function scoreToGrade(score: number, maxScore: number): string {
  if (!Number.isFinite(score) || !Number.isFinite(maxScore) || maxScore <= 0) return "F";
  const ratio = score / maxScore;
  if (ratio >= 0.92) return "A";
  if (ratio >= 0.8) return "B";
  if (ratio >= 0.65) return "C";
  if (ratio >= 0.5) return "D";
  return "F";
}

function normalizeEntityName(value: string): string {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

function parseCertificateDate(value: string | null): number | null {
  if (!value) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function isInsecureTlsVersion(version: string | null): boolean {
  if (!version) return true;
  return version === "TLSv1" || version === "TLSv1.0" || version === "TLSv1.1";
}

function prefersTls13(version: string | null): boolean {
  return version === "TLSv1.3";
}

function formatDistinguishedName(value: unknown): string | null {
  if (!value || typeof value !== "object") {
    return typeof value === "string" && value.trim() ? value.trim() : null;
  }

  const candidate = value as Record<string, unknown>;
  const orderedKeys = ["CN", "O", "OU", "L", "ST", "C"];
  const preferredParts = orderedKeys
    .map((key) => candidate[key])
    .filter((part): part is string => typeof part === "string" && part.trim().length > 0)
    .map((part) => part.trim());

  if (preferredParts.length > 0) {
    return preferredParts.join(", ");
  }

  const fallback = Object.values(candidate)
    .filter((part): part is string => typeof part === "string" && part.trim().length > 0)
    .map((part) => part.trim());
  return fallback.length > 0 ? fallback.join(", ") : null;
}

function listWeakAlgorithms(cipherName: string | null, cipherVersion: string | null): string[] {
  const candidate = `${cipherName ?? ""} ${cipherVersion ?? ""}`.toLowerCase();
  const weak: string[] = [];
  if (candidate.includes("rc4")) weak.push("RC4");
  if (candidate.includes("3des") || candidate.includes("des-cbc3")) weak.push("3DES");
  if (candidate.includes("md5")) weak.push("MD5");
  return Array.from(new Set(weak));
}

function detectSelfSignedCertificate(
  subject: string | null,
  issuer: string | null,
  authorizationError: string | null
): boolean {
  const normalizedAuthError = (authorizationError ?? "").toUpperCase();
  if (normalizedAuthError === "DEPTH_ZERO_SELF_SIGNED_CERT" || normalizedAuthError === "SELF_SIGNED_CERT_IN_CHAIN") {
    return true;
  }
  if (!subject || !issuer) return false;
  return normalizeEntityName(subject) === normalizeEntityName(issuer);
}

function isCertificateChainComplete(authorizationError: string | null): boolean {
  if (!authorizationError) return true;
  return !INCOMPLETE_CHAIN_ERRORS.has(authorizationError.toUpperCase());
}

function isIpHost(hostname: string): boolean {
  return net.isIP(hostname) !== 0;
}

function estimateChainLength(certificate: tls.PeerCertificate | tls.DetailedPeerCertificate | null): number {
  if (!certificate || typeof certificate !== "object") return 0;
  let length = 0;
  let current: tls.PeerCertificate | tls.DetailedPeerCertificate | undefined = certificate;
  const visited = new Set<string>();

  while (current && typeof current === "object" && "raw" in current && current.raw instanceof Buffer) {
    const fingerprint = typeof current.fingerprint256 === "string" ? current.fingerprint256 : null;
    if (fingerprint && visited.has(fingerprint)) {
      break;
    }
    if (fingerprint) {
      visited.add(fingerprint);
    }

    length += 1;
    const issuerCertificate =
      "issuerCertificate" in current && current.issuerCertificate && typeof current.issuerCertificate === "object"
        ? current.issuerCertificate
        : undefined;
    if (!issuerCertificate || issuerCertificate === current) {
      break;
    }
    current = issuerCertificate;
  }

  return length;
}

export function detectIssuerCategory(issuer: string | null): string {
  if (!issuer) return "Unknown";
  const normalized = issuer.toLowerCase();
  if (normalized.includes("let's encrypt") || normalized.includes("lets encrypt")) return "Let's Encrypt";
  if (normalized.includes("digicert")) return "DigiCert";
  if (normalized.includes("sectigo") || normalized.includes("comodo")) return "Sectigo / Comodo";
  if (normalized.includes("globalsign")) return "GlobalSign";
  if (normalized.includes("godaddy")) return "GoDaddy";
  if (normalized.includes("amazon")) return "Amazon Trust Services";
  if (normalized.includes("cloudflare")) return "Cloudflare";
  if (normalized.includes("buypass")) return "Buypass";
  return "Unknown";
}

function summarizeTlsAnalysis(analysis: Omit<TlsAnalysis, "summary">): string {
  if (!analysis.available) {
    return "TLS analysis is unavailable because the scanned endpoint is not served over HTTPS.";
  }

  if (analysis.findings.length === 0) {
    return "TLS configuration appears healthy with a valid certificate, trusted chain, and modern cipher/protocol.";
  }

  const criticalCount = analysis.findings.filter((finding) => finding.severity === "critical").length;
  const highCount = analysis.findings.filter((finding) => finding.severity === "high").length;
  const mediumCount = analysis.findings.filter((finding) => finding.severity === "medium").length;
  const segments: string[] = [];
  if (criticalCount > 0) segments.push(`${criticalCount} critical`);
  if (highCount > 0) segments.push(`${highCount} high`);
  if (mediumCount > 0) segments.push(`${mediumCount} medium`);
  return `TLS findings detected: ${segments.join(", ")} risk issue${analysis.findings.length === 1 ? "" : "s"}.`;
}

function buildScore(analysis: {
  available: boolean;
  certificateValid: boolean;
  certificateExpired: boolean;
  certificateExpiringSoon: boolean;
  tlsVersion: string | null;
  weakAlgorithms: string[];
  chainComplete: boolean;
  selfSigned: boolean;
  issuer: string | null;
}): number {
  if (!analysis.available) return 0;

  let score = 0;

  // Certificate validity and expiration posture (3 points).
  if (analysis.certificateValid && !analysis.certificateExpired && !analysis.certificateExpiringSoon) {
    score += 3;
  } else if (analysis.certificateValid && analysis.certificateExpiringSoon) {
    score += 1;
  }

  // TLS protocol posture (2 points): TLS 1.3 preferred, TLS 1.2 acceptable.
  if (analysis.tlsVersion === "TLSv1.3") {
    score += 2;
  } else if (analysis.tlsVersion === "TLSv1.2") {
    score += 1;
  }

  // Cipher strength posture (2 points).
  if (analysis.weakAlgorithms.length === 0 && analysis.tlsVersion !== null) {
    score += 2;
  }

  // Certificate chain completeness (1 point).
  if (analysis.chainComplete) {
    score += 1;
  }

  // Issuer trust / self-signed posture (2 points).
  if (!analysis.selfSigned) {
    score += analysis.issuer ? 2 : 1;
  }

  return Math.max(0, Math.min(TLS_MAX_SCORE, score));
}

export function buildTlsAnalysisFromProbe(probe: TlsProbeResult): TlsAnalysis {
  const validFromMs = parseCertificateDate(probe.validFrom);
  const validToMs = parseCertificateDate(probe.validTo);
  const nowMs = Date.now();
  const certificateValid = validFromMs !== null && validToMs !== null && validFromMs <= nowMs && validToMs >= nowMs;
  const certificateExpired = validToMs !== null && validToMs < nowMs;
  const certificateExpiringSoon =
    probe.daysUntilExpiration !== null && probe.daysUntilExpiration >= 0 && probe.daysUntilExpiration <= TLS_EXPIRING_SOON_DAYS;
  const chainComplete = isCertificateChainComplete(probe.authorizationError);
  const insecureProtocol = isInsecureTlsVersion(probe.tlsVersion);
  const modernProtocol = prefersTls13(probe.tlsVersion);
  const issuerCategory = detectIssuerCategory(probe.issuer);

  const findings: TlsFinding[] = [];
  if (!certificateValid && !certificateExpired) {
    findings.push({
      id: "certificate-validity-unknown",
      severity: "medium",
      message: "Certificate validity could not be fully verified.",
      recommendation: "Ensure the certificate exposes valid issuance and expiration timestamps.",
      evidence: probe.validTo
    });
  }

  if (certificateExpired) {
    findings.push({
      id: "certificate-expired",
      severity: "critical",
      message: "TLS certificate is expired.",
      recommendation: "Replace the certificate immediately and validate automatic renewal.",
      evidence: probe.validTo
    });
  } else if (certificateExpiringSoon) {
    findings.push({
      id: "certificate-expiring-soon",
      severity: "medium",
      message: `TLS certificate expires in ${probe.daysUntilExpiration} day${probe.daysUntilExpiration === 1 ? "" : "s"}.`,
      recommendation: "Renew the certificate before expiry to avoid outages and trust warnings.",
      evidence: probe.validTo
    });
  }

  if (probe.selfSigned) {
    findings.push({
      id: "self-signed-certificate",
      severity: "high",
      message: "Self-signed certificate detected.",
      recommendation: "Use a certificate issued by a publicly trusted certificate authority.",
      evidence: probe.issuer
    });
  }

  if (!chainComplete) {
    findings.push({
      id: "incomplete-certificate-chain",
      severity: "high",
      message: "Certificate chain appears incomplete or untrusted.",
      recommendation: "Serve the full intermediate certificate chain from your TLS terminator.",
      evidence: probe.authorizationError
    });
  }

  if (insecureProtocol) {
    findings.push({
      id: "insecure-tls-version",
      severity: "critical",
      message: `Insecure TLS version negotiated: ${probe.tlsVersion ?? "unknown"}.`,
      recommendation: "Disable TLS 1.0/1.1 and require TLS 1.2+ (prefer TLS 1.3).",
      evidence: probe.tlsVersion
    });
  } else if (!modernProtocol && probe.tlsVersion === "TLSv1.2") {
    findings.push({
      id: "tls13-not-preferred",
      severity: "low",
      message: "TLS 1.3 is not negotiated.",
      recommendation: "Enable and prioritize TLS 1.3 to improve cryptographic posture.",
      evidence: probe.tlsVersion
    });
  }

  if (probe.weakAlgorithms.length > 0) {
    findings.push({
      id: "weak-cipher-suite",
      severity: "high",
      message: `Weak cipher algorithm detected: ${probe.weakAlgorithms.join(", ")}.`,
      recommendation: "Disable weak ciphers (RC4, 3DES, MD5-based suites) and use modern AEAD ciphers.",
      evidence: probe.cipherName
    });
  }

  if (!probe.authorized && probe.authorizationError && chainComplete && !probe.selfSigned) {
    findings.push({
      id: "tls-authorization-error",
      severity: "medium",
      message: "TLS handshake reported a certificate trust/validation issue.",
      recommendation: "Review certificate trust chain, SANs, and server TLS configuration.",
      evidence: probe.authorizationError
    });
  }

  if (issuerCategory === "Unknown" && probe.issuer) {
    findings.push({
      id: "issuer-not-recognized",
      severity: "low",
      message: "Certificate issuer could not be mapped to a known CA family.",
      recommendation: "Confirm the issuer is expected and policy-approved for this domain.",
      evidence: probe.issuer
    });
  }

  const score = buildScore({
    available: true,
    certificateValid,
    certificateExpired,
    certificateExpiringSoon,
    tlsVersion: probe.tlsVersion,
    weakAlgorithms: probe.weakAlgorithms,
    chainComplete,
    selfSigned: probe.selfSigned,
    issuer: probe.issuer
  });

  const baseAnalysis = {
    available: true,
    checkedHostname: probe.hostname,
    checkedPort: probe.port,
    tlsVersion: probe.tlsVersion,
    isInsecureTlsVersion: insecureProtocol,
    prefersTls13: modernProtocol,
    cipherName: probe.cipherName,
    cipherVersion: probe.cipherVersion,
    weakAlgorithms: probe.weakAlgorithms,
    issuer: probe.issuer,
    issuerCategory,
    subject: probe.subject,
    validFrom: probe.validFrom,
    validTo: probe.validTo,
    daysUntilExpiration: probe.daysUntilExpiration,
    certificateValid,
    certificateExpired,
    certificateExpiringSoon,
    chainComplete,
    chainLength: probe.chainLength,
    selfSigned: probe.selfSigned,
    authorized: probe.authorized,
    authorizationError: probe.authorizationError,
    score,
    maxScore: TLS_MAX_SCORE,
    grade: scoreToGrade(score, TLS_MAX_SCORE),
    findings
  };

  return {
    ...baseAnalysis,
    summary: summarizeTlsAnalysis(baseAnalysis)
  };
}

function buildNonHttpsTlsAnalysis(url: URL): TlsAnalysis {
  const baseAnalysis = {
    available: false,
    checkedHostname: url.hostname || null,
    checkedPort: null,
    tlsVersion: null,
    isInsecureTlsVersion: true,
    prefersTls13: false,
    cipherName: null,
    cipherVersion: null,
    weakAlgorithms: [],
    issuer: null,
    issuerCategory: "Unknown",
    subject: null,
    validFrom: null,
    validTo: null,
    daysUntilExpiration: null,
    certificateValid: false,
    certificateExpired: false,
    certificateExpiringSoon: false,
    chainComplete: false,
    chainLength: 0,
    selfSigned: false,
    authorized: false,
    authorizationError: null,
    score: 0,
    maxScore: TLS_MAX_SCORE,
    grade: "F",
    findings: [
      {
        id: "https-not-enabled",
        severity: "critical" as const,
        message: "Endpoint is not using HTTPS.",
        recommendation: "Redirect all traffic to HTTPS and configure a valid TLS certificate.",
        evidence: url.protocol
      }
    ]
  };

  return {
    ...baseAnalysis,
    summary: summarizeTlsAnalysis(baseAnalysis)
  };
}

function buildProbeFailureAnalysis(hostname: string, port: number, error: unknown): TlsAnalysis {
  const reason = error instanceof Error ? error.message : "TLS handshake failed.";
  const baseAnalysis = {
    available: true,
    checkedHostname: hostname,
    checkedPort: port,
    tlsVersion: null,
    isInsecureTlsVersion: true,
    prefersTls13: false,
    cipherName: null,
    cipherVersion: null,
    weakAlgorithms: [],
    issuer: null,
    issuerCategory: "Unknown",
    subject: null,
    validFrom: null,
    validTo: null,
    daysUntilExpiration: null,
    certificateValid: false,
    certificateExpired: false,
    certificateExpiringSoon: false,
    chainComplete: false,
    chainLength: 0,
    selfSigned: false,
    authorized: false,
    authorizationError: reason,
    score: 0,
    maxScore: TLS_MAX_SCORE,
    grade: "F",
    findings: [
      {
        id: "tls-handshake-failed",
        severity: "high" as const,
        message: "Unable to complete a TLS handshake with the endpoint.",
        recommendation: "Verify TLS termination, certificate chain, and network reachability on port 443.",
        evidence: reason
      }
    ]
  };

  return {
    ...baseAnalysis,
    summary: summarizeTlsAnalysis(baseAnalysis)
  };
}

async function probeTlsEndpoint(hostname: string, port: number, timeoutMs: number): Promise<TlsProbeResult> {
  return new Promise<TlsProbeResult>((resolve, reject) => {
    const socket = tls.connect({
      host: hostname,
      port,
      servername: isIpHost(hostname) ? undefined : hostname,
      rejectUnauthorized: false
    });

    let settled = false;
    const finishResolve = (value: TlsProbeResult) => {
      if (settled) return;
      settled = true;
      socket.removeAllListeners();
      socket.end();
      resolve(value);
    };
    const finishReject = (error: Error) => {
      if (settled) return;
      settled = true;
      socket.removeAllListeners();
      socket.destroy();
      reject(error);
    };

    socket.setTimeout(timeoutMs);

    socket.once("secureConnect", () => {
      try {
        const cert = socket.getPeerCertificate(true);
        const subject = formatDistinguishedName(cert?.subject);
        const issuer = formatDistinguishedName(cert?.issuer);
        const validFrom = typeof cert?.valid_from === "string" ? cert.valid_from : null;
        const validTo = typeof cert?.valid_to === "string" ? cert.valid_to : null;
        const validToMs = parseCertificateDate(validTo);
        const daysUntilExpiration =
          validToMs === null ? null : Math.ceil((validToMs - Date.now()) / (1000 * 60 * 60 * 24));
        const cipher = socket.getCipher();
        const cipherName = typeof cipher?.name === "string" ? cipher.name : null;
        const cipherVersion = typeof cipher?.version === "string" ? cipher.version : null;
        const authorizationError = typeof socket.authorizationError === "string" ? socket.authorizationError : null;
        const selfSigned = detectSelfSignedCertificate(subject, issuer, authorizationError);

        finishResolve({
          hostname,
          port,
          tlsVersion: socket.getProtocol() ?? null,
          cipherName,
          cipherVersion,
          issuer,
          subject,
          validFrom,
          validTo,
          daysUntilExpiration,
          chainLength: estimateChainLength(cert),
          authorized: socket.authorized,
          authorizationError,
          selfSigned,
          weakAlgorithms: listWeakAlgorithms(cipherName, cipherVersion)
        });
      } catch (error) {
        finishReject(error instanceof Error ? error : new Error("TLS probe failed."));
      }
    });

    socket.once("timeout", () => {
      finishReject(new Error("TLS connection timed out."));
    });

    socket.once("error", (error) => {
      finishReject(error);
    });
  });
}

export async function analyzeTlsConfiguration(targetUrl: string, options: AnalyzeTlsOptions = {}): Promise<TlsAnalysis> {
  const parsed = new URL(targetUrl);
  if (parsed.protocol !== "https:") {
    return buildNonHttpsTlsAnalysis(parsed);
  }

  const hostname = parsed.hostname;
  const port = parsed.port ? Number(parsed.port) : 443;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TLS_TIMEOUT_MS;

  try {
    const probe = await probeTlsEndpoint(hostname, Number.isFinite(port) && port > 0 ? port : 443, timeoutMs);
    return buildTlsAnalysisFromProbe(probe);
  } catch (error) {
    return buildProbeFailureAnalysis(hostname, Number.isFinite(port) && port > 0 ? port : 443, error);
  }
}

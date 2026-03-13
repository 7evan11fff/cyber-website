export type HeaderStatus = "good" | "weak" | "missing";
export type RiskLevel = "low" | "medium" | "high";

export interface HeaderResult {
  key: string;
  label: string;
  value: string | null;
  present: boolean;
  status: HeaderStatus;
  riskLevel: RiskLevel;
  whyItMatters: string;
  guidance: string;
}

const REQUIRED_HEADERS = {
  csp: "content-security-policy",
  hsts: "strict-transport-security",
  xfo: "x-frame-options",
  xcto: "x-content-type-options",
  referrerPolicy: "referrer-policy",
  permissionsPolicy: "permissions-policy"
} as const;

function checkContentSecurityPolicy(value: string | null): HeaderResult {
  if (!value) {
    return {
      key: REQUIRED_HEADERS.csp,
      label: "Content-Security-Policy",
      value,
      present: false,
      status: "missing",
      riskLevel: "high",
      whyItMatters: "Limits where scripts, styles, and other resources can load from.",
      guidance: "Add a strict policy and avoid unsafe-inline / unsafe-eval when possible."
    };
  }

  const lower = value.toLowerCase();
  const weak = lower.includes("unsafe-inline") || lower.includes("unsafe-eval");

  return {
    key: REQUIRED_HEADERS.csp,
    label: "Content-Security-Policy",
    value,
    present: true,
    status: weak ? "weak" : "good",
    riskLevel: weak ? "medium" : "low",
    whyItMatters: "Limits where scripts, styles, and other resources can load from.",
    guidance: weak
      ? "Remove unsafe-inline and unsafe-eval to reduce XSS risk."
      : "Policy is present and does not include common unsafe directives."
  };
}

function checkHsts(value: string | null): HeaderResult {
  if (!value) {
    return {
      key: REQUIRED_HEADERS.hsts,
      label: "Strict-Transport-Security",
      value,
      present: false,
      status: "missing",
      riskLevel: "high",
      whyItMatters: "Forces browsers to use HTTPS and prevents downgrade attacks.",
      guidance: "Set max-age to at least 31536000 with includeSubDomains."
    };
  }

  const maxAgeMatch = value.match(/max-age=(\d+)/i);
  const maxAge = maxAgeMatch ? Number(maxAgeMatch[1]) : 0;
  const hasIncludeSubdomains = /includesubdomains/i.test(value);
  const weak = maxAge < 31536000 || !hasIncludeSubdomains;

  return {
    key: REQUIRED_HEADERS.hsts,
    label: "Strict-Transport-Security",
    value,
    present: true,
    status: weak ? "weak" : "good",
    riskLevel: weak ? "medium" : "low",
    whyItMatters: "Forces browsers to use HTTPS and prevents downgrade attacks.",
    guidance: weak
      ? "Use max-age=31536000 and includeSubDomains for stronger protection."
      : "Strong HSTS configuration detected."
  };
}

function checkXFrameOptions(value: string | null): HeaderResult {
  if (!value) {
    return {
      key: REQUIRED_HEADERS.xfo,
      label: "X-Frame-Options",
      value,
      present: false,
      status: "missing",
      riskLevel: "high",
      whyItMatters: "Mitigates clickjacking by controlling framing by other sites.",
      guidance: "Set to DENY or SAMEORIGIN."
    };
  }

  const normalized = value.trim().toUpperCase();
  const valid = normalized === "DENY" || normalized === "SAMEORIGIN";

  return {
    key: REQUIRED_HEADERS.xfo,
    label: "X-Frame-Options",
    value,
    present: true,
    status: valid ? "good" : "weak",
    riskLevel: valid ? "low" : "medium",
    whyItMatters: "Mitigates clickjacking by controlling framing by other sites.",
    guidance: valid ? "Recommended value detected." : "Prefer DENY or SAMEORIGIN."
  };
}

function checkXContentTypeOptions(value: string | null): HeaderResult {
  if (!value) {
    return {
      key: REQUIRED_HEADERS.xcto,
      label: "X-Content-Type-Options",
      value,
      present: false,
      status: "missing",
      riskLevel: "high",
      whyItMatters: "Prevents MIME sniffing and reduces content type confusion attacks.",
      guidance: "Set this header to nosniff."
    };
  }

  const valid = value.trim().toLowerCase() === "nosniff";

  return {
    key: REQUIRED_HEADERS.xcto,
    label: "X-Content-Type-Options",
    value,
    present: true,
    status: valid ? "good" : "weak",
    riskLevel: valid ? "low" : "medium",
    whyItMatters: "Prevents MIME sniffing and reduces content type confusion attacks.",
    guidance: valid ? "nosniff value detected." : "Use nosniff for best protection."
  };
}

function checkReferrerPolicy(value: string | null): HeaderResult {
  if (!value) {
    return {
      key: REQUIRED_HEADERS.referrerPolicy,
      label: "Referrer-Policy",
      value,
      present: false,
      status: "missing",
      riskLevel: "high",
      whyItMatters: "Controls how much URL information is sent in the Referer header.",
      guidance: "Use strict-origin-when-cross-origin or no-referrer."
    };
  }

  const normalized = value.trim().toLowerCase();
  const weak = normalized === "unsafe-url" || normalized === "origin-when-cross-origin";

  return {
    key: REQUIRED_HEADERS.referrerPolicy,
    label: "Referrer-Policy",
    value,
    present: true,
    status: weak ? "weak" : "good",
    riskLevel: weak ? "medium" : "low",
    whyItMatters: "Controls how much URL information is sent in the Referer header.",
    guidance: weak
      ? "Prefer strict-origin-when-cross-origin or no-referrer."
      : "Policy appears privacy-conscious."
  };
}

function checkPermissionsPolicy(value: string | null): HeaderResult {
  if (!value) {
    return {
      key: REQUIRED_HEADERS.permissionsPolicy,
      label: "Permissions-Policy",
      value,
      present: false,
      status: "missing",
      riskLevel: "high",
      whyItMatters: "Limits access to browser features like camera, microphone, and geolocation.",
      guidance: "Add an explicit policy to deny unused browser features."
    };
  }

  const normalized = value.toLowerCase();
  const weak = normalized.includes("=*") || normalized.includes("(*)");

  return {
    key: REQUIRED_HEADERS.permissionsPolicy,
    label: "Permissions-Policy",
    value,
    present: true,
    status: weak ? "weak" : "good",
    riskLevel: weak ? "medium" : "low",
    whyItMatters: "Limits access to browser features like camera, microphone, and geolocation.",
    guidance: weak
      ? "Restrict features to specific origins or disable features entirely."
      : "Policy appears restrictive."
  };
}

export function analyzeSecurityHeaders(headers: Headers): HeaderResult[] {
  return [
    checkContentSecurityPolicy(headers.get(REQUIRED_HEADERS.csp)),
    checkHsts(headers.get(REQUIRED_HEADERS.hsts)),
    checkXFrameOptions(headers.get(REQUIRED_HEADERS.xfo)),
    checkXContentTypeOptions(headers.get(REQUIRED_HEADERS.xcto)),
    checkReferrerPolicy(headers.get(REQUIRED_HEADERS.referrerPolicy)),
    checkPermissionsPolicy(headers.get(REQUIRED_HEADERS.permissionsPolicy))
  ];
}

export function calculateGrade(results: HeaderResult[]): { score: number; grade: string } {
  const score = results.reduce((total, result) => {
    if (result.status === "good") return total + 2;
    if (result.status === "weak") return total + 1;
    return total;
  }, 0);

  const maxScore = results.length * 2;
  const ratio = maxScore > 0 ? score / maxScore : 0;

  let grade = "F";
  if (ratio >= 0.92) grade = "A";
  else if (ratio >= 0.8) grade = "B";
  else if (ratio >= 0.65) grade = "C";
  else if (ratio >= 0.5) grade = "D";

  return { score, grade };
}

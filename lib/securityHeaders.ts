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
  xxp: "x-xss-protection",
  xcto: "x-content-type-options",
  referrerPolicy: "referrer-policy",
  featurePolicy: "feature-policy",
  permissionsPolicy: "permissions-policy",
  coop: "cross-origin-opener-policy",
  coep: "cross-origin-embedder-policy",
  corp: "cross-origin-resource-policy"
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

function checkXXssProtection(value: string | null): HeaderResult {
  if (!value) {
    return {
      key: REQUIRED_HEADERS.xxp,
      label: "X-XSS-Protection",
      value,
      present: false,
      status: "missing",
      riskLevel: "medium",
      whyItMatters:
        "Legacy browser XSS filter control. Deprecated in modern browsers but still useful to document.",
      guidance: "Use 1; mode=block for older browser support, and rely primarily on CSP."
    };
  }

  const normalized = value.replace(/\s+/g, "").toLowerCase();
  const disabled = normalized === "0";
  const strong = normalized === "1;mode=block" || normalized === "1";

  return {
    key: REQUIRED_HEADERS.xxp,
    label: "X-XSS-Protection",
    value,
    present: true,
    status: disabled || !strong ? "weak" : "good",
    riskLevel: disabled || !strong ? "medium" : "low",
    whyItMatters:
      "Legacy browser XSS filter control. Deprecated in modern browsers but still useful to document.",
    guidance: disabled
      ? "Avoid disabling it when supporting legacy browsers; use 1; mode=block if needed."
      : strong
        ? "Legacy XSS filter is enabled. Keep CSP as the primary protection."
        : "Prefer 1; mode=block for legacy compatibility."
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

function checkFeaturePolicy(value: string | null): HeaderResult {
  if (!value) {
    return {
      key: REQUIRED_HEADERS.featurePolicy,
      label: "Feature-Policy",
      value,
      present: false,
      status: "missing",
      riskLevel: "medium",
      whyItMatters:
        "Legacy precursor to Permissions-Policy used by older browsers to limit camera, microphone, and other features.",
      guidance: "Add a restrictive policy for legacy browser coverage, or pair with a strong Permissions-Policy."
    };
  }

  const normalized = value.toLowerCase();
  const weak = normalized.includes("*") || normalized.includes("self *");

  return {
    key: REQUIRED_HEADERS.featurePolicy,
    label: "Feature-Policy",
    value,
    present: true,
    status: weak ? "weak" : "good",
    riskLevel: weak ? "medium" : "low",
    whyItMatters:
      "Legacy precursor to Permissions-Policy used by older browsers to limit camera, microphone, and other features.",
    guidance: weak
      ? "Avoid wildcard allowances and explicitly disable features your app does not need."
      : "Feature restrictions look explicit for legacy browser compatibility."
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

function checkCrossOriginOpenerPolicy(value: string | null): HeaderResult {
  if (!value) {
    return {
      key: REQUIRED_HEADERS.coop,
      label: "Cross-Origin-Opener-Policy",
      value,
      present: false,
      status: "missing",
      riskLevel: "medium",
      whyItMatters:
        "Isolates browsing context from cross-origin windows to reduce XS-Leaks and process sharing risks.",
      guidance: "Set to same-origin (or same-origin-allow-popups when required)."
    };
  }

  const normalized = value.trim().toLowerCase();
  const good = normalized === "same-origin" || normalized === "same-origin-allow-popups";

  return {
    key: REQUIRED_HEADERS.coop,
    label: "Cross-Origin-Opener-Policy",
    value,
    present: true,
    status: good ? "good" : "weak",
    riskLevel: good ? "low" : "medium",
    whyItMatters:
      "Isolates browsing context from cross-origin windows to reduce XS-Leaks and process sharing risks.",
    guidance: good
      ? "COOP policy supports cross-origin isolation goals."
      : "Use same-origin unless your app requires looser opener behavior."
  };
}

function checkCrossOriginEmbedderPolicy(value: string | null): HeaderResult {
  if (!value) {
    return {
      key: REQUIRED_HEADERS.coep,
      label: "Cross-Origin-Embedder-Policy",
      value,
      present: false,
      status: "missing",
      riskLevel: "medium",
      whyItMatters:
        "Controls which cross-origin resources can be embedded and enables safer high-privilege browser features.",
      guidance: "Prefer require-corp (or credentialless where appropriate)."
    };
  }

  const normalized = value.trim().toLowerCase();
  const good = normalized === "require-corp" || normalized === "credentialless";

  return {
    key: REQUIRED_HEADERS.coep,
    label: "Cross-Origin-Embedder-Policy",
    value,
    present: true,
    status: good ? "good" : "weak",
    riskLevel: good ? "low" : "medium",
    whyItMatters:
      "Controls which cross-origin resources can be embedded and enables safer high-privilege browser features.",
    guidance: good
      ? "COEP setting is suitable for cross-origin isolation."
      : "Use require-corp or credentialless to tighten embedder boundaries."
  };
}

function checkCrossOriginResourcePolicy(value: string | null): HeaderResult {
  if (!value) {
    return {
      key: REQUIRED_HEADERS.corp,
      label: "Cross-Origin-Resource-Policy",
      value,
      present: false,
      status: "missing",
      riskLevel: "medium",
      whyItMatters:
        "Restricts which origins can load your resources, reducing cross-origin data exposure.",
      guidance: "Set same-origin or same-site for sensitive assets."
    };
  }

  const normalized = value.trim().toLowerCase();
  const good = normalized === "same-origin" || normalized === "same-site";

  return {
    key: REQUIRED_HEADERS.corp,
    label: "Cross-Origin-Resource-Policy",
    value,
    present: true,
    status: good ? "good" : "weak",
    riskLevel: good ? "low" : "medium",
    whyItMatters:
      "Restricts which origins can load your resources, reducing cross-origin data exposure.",
    guidance: good
      ? "CORP restricts resource sharing appropriately."
      : "Prefer same-origin or same-site unless public cross-origin loading is required."
  };
}

export function analyzeSecurityHeaders(headers: Headers): HeaderResult[] {
  return [
    checkContentSecurityPolicy(headers.get(REQUIRED_HEADERS.csp)),
    checkHsts(headers.get(REQUIRED_HEADERS.hsts)),
    checkXFrameOptions(headers.get(REQUIRED_HEADERS.xfo)),
    checkXXssProtection(headers.get(REQUIRED_HEADERS.xxp)),
    checkXContentTypeOptions(headers.get(REQUIRED_HEADERS.xcto)),
    checkReferrerPolicy(headers.get(REQUIRED_HEADERS.referrerPolicy)),
    checkFeaturePolicy(headers.get(REQUIRED_HEADERS.featurePolicy)),
    checkPermissionsPolicy(headers.get(REQUIRED_HEADERS.permissionsPolicy)),
    checkCrossOriginOpenerPolicy(headers.get(REQUIRED_HEADERS.coop)),
    checkCrossOriginEmbedderPolicy(headers.get(REQUIRED_HEADERS.coep)),
    checkCrossOriginResourcePolicy(headers.get(REQUIRED_HEADERS.corp))
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

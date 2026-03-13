export type HeaderStatus = "present" | "missing" | "misconfigured";

export interface HeaderCheckResult {
  key: string;
  name: string;
  category: "critical" | "important" | "additional";
  status: HeaderStatus;
  value: string | null;
  recommendation: string;
  documentationUrl: string;
  score: number;
  maxScore: number;
}

interface HeaderRule {
  key: string;
  name: string;
  category: "critical" | "important" | "additional";
  maxScore: number;
  documentationUrl: string;
  missingRecommendation: string;
  validate: (value: string | null, allHeaders: Headers) => Omit<HeaderCheckResult, "name" | "category" | "documentationUrl" | "maxScore" | "key">;
}

const HEADER_RULES: HeaderRule[] = [
  {
    key: "content-security-policy",
    name: "Content-Security-Policy",
    category: "critical",
    maxScore: 18,
    documentationUrl: "https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP",
    missingRecommendation: "Add a strict CSP that avoids unsafe-inline and unsafe-eval when possible.",
    validate: (value) => {
      if (!value) {
        return {
          status: "missing",
          value: null,
          recommendation: "Missing Content-Security-Policy header. Add a strict policy to mitigate XSS and injection attacks.",
          score: 0
        };
      }

      const lowered = value.toLowerCase();
      if (lowered.includes("'unsafe-inline'") || lowered.includes("'unsafe-eval'")) {
        return {
          status: "misconfigured",
          value,
          recommendation: "CSP is present but allows unsafe directives. Remove unsafe-inline/unsafe-eval where possible.",
          score: 9
        };
      }

      return {
        status: "present",
        value,
        recommendation: "CSP is present and looks reasonably strict.",
        score: 18
      };
    }
  },
  {
    key: "x-frame-options",
    name: "X-Frame-Options",
    category: "important",
    maxScore: 10,
    documentationUrl: "https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/X-Frame-Options",
    missingRecommendation: "Set X-Frame-Options to DENY or SAMEORIGIN.",
    validate: (value) => {
      if (!value) {
        return {
          status: "missing",
          value: null,
          recommendation: "Missing X-Frame-Options header. Set it to DENY or SAMEORIGIN to reduce clickjacking risk.",
          score: 0
        };
      }

      const normalized = value.trim().toUpperCase();
      if (normalized !== "DENY" && normalized !== "SAMEORIGIN") {
        return {
          status: "misconfigured",
          value,
          recommendation: "Use DENY or SAMEORIGIN for reliable frame protection.",
          score: 5
        };
      }

      return {
        status: "present",
        value,
        recommendation: "X-Frame-Options is correctly configured.",
        score: 10
      };
    }
  },
  {
    key: "x-content-type-options",
    name: "X-Content-Type-Options",
    category: "important",
    maxScore: 9,
    documentationUrl: "https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/X-Content-Type-Options",
    missingRecommendation: "Set X-Content-Type-Options to nosniff.",
    validate: (value) => {
      if (!value) {
        return {
          status: "missing",
          value: null,
          recommendation: "Missing X-Content-Type-Options header. Set to nosniff to prevent MIME sniffing.",
          score: 0
        };
      }

      if (value.trim().toLowerCase() !== "nosniff") {
        return {
          status: "misconfigured",
          value,
          recommendation: "Use the exact value 'nosniff' for best protection.",
          score: 4
        };
      }

      return {
        status: "present",
        value,
        recommendation: "X-Content-Type-Options is correctly configured.",
        score: 9
      };
    }
  },
  {
    key: "strict-transport-security",
    name: "Strict-Transport-Security",
    category: "critical",
    maxScore: 14,
    documentationUrl: "https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Strict-Transport-Security",
    missingRecommendation: "Enable HSTS with max-age>=31536000 and includeSubDomains.",
    validate: (value) => {
      if (!value) {
        return {
          status: "missing",
          value: null,
          recommendation: "Missing HSTS header. Enforce HTTPS with max-age>=31536000 and includeSubDomains.",
          score: 0
        };
      }

      const directives = value
        .split(";")
        .map((part) => part.trim().toLowerCase())
        .filter(Boolean);
      const maxAgeDirective = directives.find((item) => item.startsWith("max-age="));
      const includesSubDomains = directives.includes("includesubdomains");
      const maxAge = maxAgeDirective ? Number.parseInt(maxAgeDirective.replace("max-age=", ""), 10) : Number.NaN;

      if (!maxAgeDirective || Number.isNaN(maxAge) || maxAge < 31_536_000 || !includesSubDomains) {
        return {
          status: "misconfigured",
          value,
          recommendation: "HSTS is present but should include max-age>=31536000 and includeSubDomains.",
          score: 7
        };
      }

      return {
        status: "present",
        value,
        recommendation: "HSTS is strongly configured.",
        score: 14
      };
    }
  },
  {
    key: "x-xss-protection",
    name: "X-XSS-Protection",
    category: "additional",
    maxScore: 4,
    documentationUrl: "https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/X-XSS-Protection",
    missingRecommendation: "Legacy header. Consider modern CSP as the primary XSS control.",
    validate: (value) => {
      if (!value) {
        return {
          status: "missing",
          value: null,
          recommendation: "Header is absent. This is legacy, but can still help with old browsers.",
          score: 0
        };
      }

      if (value.trim() === "0") {
        return {
          status: "misconfigured",
          value,
          recommendation: "X-XSS-Protection is disabled. Keep CSP as the primary defense.",
          score: 2
        };
      }

      return {
        status: "present",
        value,
        recommendation: "X-XSS-Protection is present (legacy signal).",
        score: 4
      };
    }
  },
  {
    key: "referrer-policy",
    name: "Referrer-Policy",
    category: "important",
    maxScore: 8,
    documentationUrl: "https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Referrer-Policy",
    missingRecommendation: "Set Referrer-Policy to strict-origin-when-cross-origin or stricter.",
    validate: (value) => {
      if (!value) {
        return {
          status: "missing",
          value: null,
          recommendation: "Missing Referrer-Policy header. Add strict-origin-when-cross-origin or no-referrer.",
          score: 0
        };
      }

      const strictValues = new Set(["no-referrer", "strict-origin", "strict-origin-when-cross-origin"]);
      if (!strictValues.has(value.trim().toLowerCase())) {
        return {
          status: "misconfigured",
          value,
          recommendation: "Use stricter values like strict-origin-when-cross-origin or no-referrer.",
          score: 4
        };
      }

      return {
        status: "present",
        value,
        recommendation: "Referrer-Policy is set to a strong value.",
        score: 8
      };
    }
  },
  {
    key: "permissions-policy",
    name: "Permissions-Policy",
    category: "important",
    maxScore: 8,
    documentationUrl: "https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Permissions-Policy",
    missingRecommendation: "Set Permissions-Policy to disable unneeded browser features.",
    validate: (value) => {
      if (!value) {
        return {
          status: "missing",
          value: null,
          recommendation: "Missing Permissions-Policy header. Explicitly disable unnecessary browser capabilities.",
          score: 0
        };
      }

      return {
        status: "present",
        value,
        recommendation: "Permissions-Policy is present.",
        score: 8
      };
    }
  },
  {
    key: "access-control-allow-origin",
    name: "Access-Control-Allow-Origin (CORS)",
    category: "additional",
    maxScore: 6,
    documentationUrl: "https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Access-Control-Allow-Origin",
    missingRecommendation: "Define explicit CORS policy if your resources are intended for cross-origin use.",
    validate: (value, allHeaders) => {
      if (!value) {
        return {
          status: "missing",
          value: null,
          recommendation: "No CORS header detected. This may be acceptable for websites but verify API behavior.",
          score: 2
        };
      }

      const credentials = allHeaders.get("access-control-allow-credentials");
      if (value.trim() === "*" && credentials?.trim().toLowerCase() === "true") {
        return {
          status: "misconfigured",
          value,
          recommendation: "Wildcard CORS with credentials is insecure and rejected by browsers.",
          score: 1
        };
      }

      return {
        status: "present",
        value,
        recommendation: "CORS header is present.",
        score: 6
      };
    }
  },
  {
    key: "cross-origin-embedder-policy",
    name: "Cross-Origin-Embedder-Policy (COEP)",
    category: "important",
    maxScore: 8,
    documentationUrl: "https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Cross-Origin-Embedder-Policy",
    missingRecommendation: "Use COEP: require-corp (or credentialless) for stronger isolation when needed.",
    validate: (value) => {
      if (!value) {
        return {
          status: "missing",
          value: null,
          recommendation: "COEP not found. Add when you need cross-origin isolation features.",
          score: 0
        };
      }

      const valid = new Set(["require-corp", "credentialless", "unsafe-none"]);
      const normalized = value.trim().toLowerCase();
      if (!valid.has(normalized) || normalized === "unsafe-none") {
        return {
          status: "misconfigured",
          value,
          recommendation: "Prefer require-corp (or credentialless) over unsafe-none.",
          score: 4
        };
      }

      return {
        status: "present",
        value,
        recommendation: "COEP is configured for cross-origin isolation.",
        score: 8
      };
    }
  },
  {
    key: "cross-origin-opener-policy",
    name: "Cross-Origin-Opener-Policy (COOP)",
    category: "important",
    maxScore: 8,
    documentationUrl: "https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Cross-Origin-Opener-Policy",
    missingRecommendation: "Set COOP to same-origin or same-origin-allow-popups when appropriate.",
    validate: (value) => {
      if (!value) {
        return {
          status: "missing",
          value: null,
          recommendation: "COOP not found. Add same-origin to reduce cross-window attacks.",
          score: 0
        };
      }

      const normalized = value.trim().toLowerCase();
      if (normalized !== "same-origin" && normalized !== "same-origin-allow-popups") {
        return {
          status: "misconfigured",
          value,
          recommendation: "Use same-origin or same-origin-allow-popups for safer isolation.",
          score: 4
        };
      }

      return {
        status: "present",
        value,
        recommendation: "COOP is configured with a strong value.",
        score: 8
      };
    }
  },
  {
    key: "cross-origin-resource-policy",
    name: "Cross-Origin-Resource-Policy (CORP)",
    category: "additional",
    maxScore: 7,
    documentationUrl: "https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Cross-Origin-Resource-Policy",
    missingRecommendation: "Set CORP to same-origin or same-site when possible.",
    validate: (value) => {
      if (!value) {
        return {
          status: "missing",
          value: null,
          recommendation: "CORP header is missing. Consider adding to protect resources from untrusted embedding.",
          score: 0
        };
      }

      const normalized = value.trim().toLowerCase();
      if (!["same-origin", "same-site", "cross-origin"].includes(normalized)) {
        return {
          status: "misconfigured",
          value,
          recommendation: "Use valid CORP values: same-origin, same-site, or cross-origin.",
          score: 3
        };
      }

      return {
        status: "present",
        value,
        recommendation: "CORP is present and valid.",
        score: 7
      };
    }
  }
];

function gradeFromScore(score: number): "A" | "B" | "C" | "D" | "E" | "F" {
  if (score >= 90) {
    return "A";
  }
  if (score >= 80) {
    return "B";
  }
  if (score >= 70) {
    return "C";
  }
  if (score >= 60) {
    return "D";
  }
  if (score >= 50) {
    return "E";
  }
  return "F";
}

function isPrivateHostname(hostname: string): boolean {
  const normalized = hostname.toLowerCase();
  if (normalized === "localhost" || normalized.endsWith(".localhost") || normalized === "::1") {
    return true;
  }

  const ipv4Regex = /^(?:\d{1,3}\.){3}\d{1,3}$/;
  if (!ipv4Regex.test(normalized)) {
    return false;
  }

  const octets = normalized.split(".").map((part) => Number.parseInt(part, 10));
  const [first, second] = octets;

  return (
    first === 10 ||
    first === 127 ||
    (first === 169 && second === 254) ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 168) ||
    first === 0
  );
}

export function normalizeAndValidateUrl(input: string): URL {
  const trimmed = input.trim();
  if (!trimmed) {
    throw new Error("Please provide a URL to scan.");
  }

  const hasScheme = /^https?:\/\//i.test(trimmed);
  const candidate = hasScheme ? trimmed : `https://${trimmed}`;
  let parsed: URL;

  try {
    parsed = new URL(candidate);
  } catch {
    throw new Error("The URL format is invalid.");
  }

  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new Error("Only HTTP and HTTPS URLs are supported.");
  }

  if (isPrivateHostname(parsed.hostname)) {
    throw new Error("Private or local network targets are not allowed.");
  }

  return parsed;
}

export function analyzeSecurityHeaders(headers: Headers): {
  results: HeaderCheckResult[];
  score: number;
  maxScore: number;
  grade: "A" | "B" | "C" | "D" | "E" | "F";
} {
  const results = HEADER_RULES.map((rule) => {
    const rawValue = headers.get(rule.key);
    const analyzed = rule.validate(rawValue, headers);
    return {
      key: rule.key,
      name: rule.name,
      category: rule.category,
      status: analyzed.status,
      value: analyzed.value,
      recommendation: analyzed.recommendation || rule.missingRecommendation,
      documentationUrl: rule.documentationUrl,
      score: analyzed.score,
      maxScore: rule.maxScore
    } satisfies HeaderCheckResult;
  });

  const score = results.reduce((total, item) => total + item.score, 0);
  const maxScore = results.reduce((total, item) => total + item.maxScore, 0);
  const normalizedScore = Math.round((score / maxScore) * 100);

  return {
    results,
    score: normalizedScore,
    maxScore: 100,
    grade: gradeFromScore(normalizedScore)
  };
}

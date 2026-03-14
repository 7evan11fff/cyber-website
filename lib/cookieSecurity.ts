import type { HeaderStatus } from "@/lib/securityHeaders";

export type CookieSameSite = "Strict" | "Lax" | "None" | "Missing" | "Invalid";

export type CookieSecurityResult = {
  name: string;
  raw: string;
  httpOnly: boolean;
  secure: boolean;
  sameSite: CookieSameSite;
  path: string | null;
  domain: string | null;
  score: number;
  maxScore: number;
  status: HeaderStatus;
  grade: string;
  findings: string[];
  guidance: string[];
};

export type CookieSecurityAnalysis = {
  cookies: CookieSecurityResult[];
  cookieCount: number;
  score: number;
  maxScore: number;
  grade: string;
  summary: string;
};

type ParsedCookie = {
  name: string;
  attrs: Map<string, string | null>;
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

function cookiePointGrade(points: number): string {
  if (points >= 5) return "A";
  if (points >= 4) return "B";
  if (points >= 3) return "C";
  if (points >= 2) return "D";
  return "F";
}

function normalizeCookieStatus(points: number): HeaderStatus {
  if (points >= 4) return "good";
  if (points >= 2) return "weak";
  return "missing";
}

function normalizeCookieScore(points: number): number {
  if (points >= 4) return 2;
  if (points >= 2) return 1;
  return 0;
}

function parseSameSite(value: string | null): CookieSameSite {
  if (!value) return "Missing";
  const normalized = value.trim().toLowerCase();
  if (normalized === "strict") return "Strict";
  if (normalized === "lax") return "Lax";
  if (normalized === "none") return "None";
  return "Invalid";
}

function parseSetCookie(rawCookie: string): ParsedCookie | null {
  const segments = rawCookie
    .split(";")
    .map((segment) => segment.trim())
    .filter(Boolean);
  if (segments.length === 0) return null;

  const [nameAndValue, ...attributeSegments] = segments;
  const equalsIndex = nameAndValue.indexOf("=");
  const name = (equalsIndex >= 0 ? nameAndValue.slice(0, equalsIndex) : nameAndValue).trim() || "(unnamed cookie)";
  const attrs = new Map<string, string | null>();

  for (const segment of attributeSegments) {
    const attrEqualsIndex = segment.indexOf("=");
    if (attrEqualsIndex < 0) {
      attrs.set(segment.toLowerCase(), null);
      continue;
    }
    const key = segment.slice(0, attrEqualsIndex).trim().toLowerCase();
    const value = segment.slice(attrEqualsIndex + 1).trim();
    attrs.set(key, value || "");
  }

  return {
    name,
    attrs
  };
}

function analyzeSingleCookie(rawCookie: string): CookieSecurityResult | null {
  const parsed = parseSetCookie(rawCookie);
  if (!parsed) return null;

  const findings: string[] = [];
  const guidance: string[] = [];
  const httpOnly = parsed.attrs.has("httponly");
  const secure = parsed.attrs.has("secure");
  const sameSite = parseSameSite(parsed.attrs.get("samesite") ?? null);
  const path = parsed.attrs.get("path") ?? null;
  const domain = parsed.attrs.get("domain") ?? null;

  let points = 0;

  if (httpOnly) {
    points += 1;
  } else {
    findings.push("Missing HttpOnly");
    guidance.push("Add HttpOnly to reduce script-level access to sensitive cookies.");
  }

  if (secure) {
    points += 1;
  } else {
    findings.push("Missing Secure");
    guidance.push("Add Secure so the cookie is only sent over HTTPS.");
  }

  if (sameSite === "Strict" || sameSite === "Lax") {
    points += 1;
  } else if (sameSite === "None") {
    if (secure) {
      points += 1;
    } else {
      findings.push("SameSite=None without Secure");
      guidance.push("If SameSite=None is required, Secure must also be set.");
    }
  } else if (sameSite === "Missing") {
    findings.push("Missing SameSite");
    guidance.push("Set SameSite=Lax or SameSite=Strict to reduce CSRF risk.");
  } else {
    findings.push("Invalid SameSite value");
    guidance.push("Use SameSite=Strict, Lax, or None.");
  }

  if (path && path.trim() && path.trim() !== "/") {
    points += 1;
  } else {
    findings.push("Broad Path scope");
    guidance.push("Use a narrower Path value when possible instead of '/'.");
  }

  if (!domain) {
    points += 1;
  } else {
    findings.push("Domain attribute broadens scope");
    guidance.push("Prefer host-only cookies (omit Domain) unless cross-subdomain sharing is required.");
  }

  return {
    name: parsed.name,
    raw: rawCookie,
    httpOnly,
    secure,
    sameSite,
    path,
    domain,
    score: normalizeCookieScore(points),
    maxScore: 2,
    status: normalizeCookieStatus(points),
    grade: cookiePointGrade(points),
    findings,
    guidance
  };
}

function summarizeCookies(cookies: CookieSecurityResult[]): string {
  if (cookies.length === 0) {
    return "No Set-Cookie headers were returned by the scanned response.";
  }

  let strong = 0;
  let needsAttention = 0;
  for (const cookie of cookies) {
    if (cookie.status === "good") {
      strong += 1;
    } else {
      needsAttention += 1;
    }
  }

  return `${cookies.length} cookie${cookies.length === 1 ? "" : "s"} analyzed: ${strong} strong, ${needsAttention} need attention.`;
}

export function splitSetCookieHeaderValue(rawValue: string): string[] {
  return rawValue
    .split(/,(?=\s*[^;,=\s]+=[^;]+)/g)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function extractSetCookieHeaderValues(headers: Headers): string[] {
  const maybeGetSetCookie = headers as Headers & {
    getSetCookie?: () => string[];
  };

  if (typeof maybeGetSetCookie.getSetCookie === "function") {
    const values = maybeGetSetCookie.getSetCookie().map((value) => value.trim()).filter(Boolean);
    if (values.length > 0) {
      return values;
    }
  }

  const combined = headers.get("set-cookie");
  if (!combined) return [];
  return splitSetCookieHeaderValue(combined);
}

export function analyzeCookieSecurity(headers: Headers): CookieSecurityAnalysis {
  const setCookieValues = extractSetCookieHeaderValues(headers);
  const cookies = setCookieValues
    .map((cookieValue) => analyzeSingleCookie(cookieValue))
    .filter((cookie): cookie is CookieSecurityResult => Boolean(cookie));

  const score = cookies.reduce((total, cookie) => total + cookie.score, 0);
  const maxScore = cookies.reduce((total, cookie) => total + cookie.maxScore, 0);
  const grade = cookies.length === 0 ? "N/A" : scoreToGrade(score, maxScore);

  return {
    cookies,
    cookieCount: cookies.length,
    score,
    maxScore,
    grade,
    summary: summarizeCookies(cookies)
  };
}

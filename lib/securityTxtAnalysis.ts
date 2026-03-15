export type SecurityTxtSourcePath = "/.well-known/security.txt" | "/security.txt";
export type SecurityTxtFieldKey =
  | "contact"
  | "expires"
  | "encryption"
  | "acknowledgments"
  | "preferredLanguages"
  | "canonical"
  | "policy"
  | "hiring";

export type SecurityTxtFields = {
  contact: string[];
  expires: string | null;
  encryption: string[];
  acknowledgments: string[];
  preferredLanguages: string[];
  canonical: string[];
  policy: string[];
  hiring: string[];
};

export type SecurityTxtValidation = {
  present: boolean;
  usesHttps: boolean;
  hasContact: boolean;
  hasExpires: boolean;
  expiresValidFormat: boolean;
  expiresExpired: boolean;
  expiresExpiringSoon: boolean;
  isValid: boolean;
};

export type SecurityTxtAnalysis = {
  available: boolean;
  checkedUrl: string;
  fetchedUrl: string | null;
  fetchedFrom: SecurityTxtSourcePath | null;
  fallbackUsed: boolean;
  statusCode: number | null;
  fields: SecurityTxtFields;
  foundFields: SecurityTxtFieldKey[];
  validation: SecurityTxtValidation;
  warnings: string[];
  recommendations: string[];
  score: number;
  maxScore: number;
  grade: string;
  summary: string;
};

export type SecurityTxtAnalysisOptions = {
  userAgent?: string;
  followRedirects?: boolean;
  timeoutMs?: number;
};

const DEFAULT_REQUEST_TIMEOUT_MS = 10000;
const DEFAULT_SCANNER_USER_AGENT = "SecurityHeaderChecker/1.0 (+https://vercel.com)";
const EXPIRING_SOON_WINDOW_DAYS = 30;

const SECURITY_TXT_LOCATIONS: SecurityTxtSourcePath[] = ["/.well-known/security.txt", "/security.txt"];

const FIELD_LABELS: Record<SecurityTxtFieldKey, string> = {
  contact: "Contact",
  expires: "Expires",
  encryption: "Encryption",
  acknowledgments: "Acknowledgments",
  preferredLanguages: "Preferred-Languages",
  canonical: "Canonical",
  policy: "Policy",
  hiring: "Hiring"
};

function emptySecurityTxtFields(): SecurityTxtFields {
  return {
    contact: [],
    expires: null,
    encryption: [],
    acknowledgments: [],
    preferredLanguages: [],
    canonical: [],
    policy: [],
    hiring: []
  };
}

function normalizeFieldValue(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeRawLine(line: string): string {
  const hashIndex = line.indexOf("#");
  if (hashIndex < 0) return line.trim();
  return line.slice(0, hashIndex).trim();
}

function pushUnique(collection: string[], candidate: string) {
  if (!collection.includes(candidate)) {
    collection.push(candidate);
  }
}

function parseSecurityTxt(content: string): { fields: SecurityTxtFields; foundFields: SecurityTxtFieldKey[] } {
  const fields = emptySecurityTxtFields();
  const lines = content.split(/\r?\n/);

  for (const rawLine of lines) {
    const line = normalizeRawLine(rawLine);
    if (!line) continue;
    const separatorIndex = line.indexOf(":");
    if (separatorIndex <= 0) continue;

    const rawKey = line.slice(0, separatorIndex).trim().toLowerCase();
    const rawValue = line.slice(separatorIndex + 1);
    const value = normalizeFieldValue(rawValue);
    if (!value) continue;

    if (rawKey === "contact") {
      pushUnique(fields.contact, value);
      continue;
    }
    if (rawKey === "expires") {
      if (!fields.expires) {
        fields.expires = value;
      }
      continue;
    }
    if (rawKey === "encryption") {
      pushUnique(fields.encryption, value);
      continue;
    }
    if (rawKey === "acknowledgments" || rawKey === "acknowledgements") {
      pushUnique(fields.acknowledgments, value);
      continue;
    }
    if (rawKey === "preferred-languages") {
      value
        .split(",")
        .map((language) => normalizeFieldValue(language))
        .filter((language): language is string => Boolean(language))
        .forEach((language) => pushUnique(fields.preferredLanguages, language));
      continue;
    }
    if (rawKey === "canonical") {
      pushUnique(fields.canonical, value);
      continue;
    }
    if (rawKey === "policy") {
      pushUnique(fields.policy, value);
      continue;
    }
    if (rawKey === "hiring") {
      pushUnique(fields.hiring, value);
    }
  }

  const foundFields: SecurityTxtFieldKey[] = [];
  if (fields.contact.length > 0) foundFields.push("contact");
  if (fields.expires) foundFields.push("expires");
  if (fields.encryption.length > 0) foundFields.push("encryption");
  if (fields.acknowledgments.length > 0) foundFields.push("acknowledgments");
  if (fields.preferredLanguages.length > 0) foundFields.push("preferredLanguages");
  if (fields.canonical.length > 0) foundFields.push("canonical");
  if (fields.policy.length > 0) foundFields.push("policy");
  if (fields.hiring.length > 0) foundFields.push("hiring");

  return { fields, foundFields };
}

function parseDateInput(input: string | null): number | null {
  if (!input) return null;
  const parsed = Date.parse(input);
  return Number.isFinite(parsed) ? parsed : null;
}

function validateSecurityTxt(fields: SecurityTxtFields, fetchedUrl: string | null): SecurityTxtValidation {
  const nowMs = Date.now();
  const warningWindowMs = EXPIRING_SOON_WINDOW_DAYS * 24 * 60 * 60 * 1000;
  const expiresMs = parseDateInput(fields.expires);
  const expiresValidFormat = fields.expires !== null && expiresMs !== null;
  const expiresExpired = expiresMs !== null && expiresMs < nowMs;
  const expiresExpiringSoon = expiresMs !== null && expiresMs >= nowMs && expiresMs <= nowMs + warningWindowMs;

  const usesHttps = typeof fetchedUrl === "string" && fetchedUrl.startsWith("https://");
  const hasContact = fields.contact.length > 0;
  const hasExpires = fields.expires !== null;
  const present = fetchedUrl !== null;
  const isValid =
    present && usesHttps && hasContact && hasExpires && expiresValidFormat && !expiresExpired && !expiresExpiringSoon;

  return {
    present,
    usesHttps,
    hasContact,
    hasExpires,
    expiresValidFormat,
    expiresExpired,
    expiresExpiringSoon,
    isValid
  };
}

function summarizeSecurityTxt(
  available: boolean,
  validation: SecurityTxtValidation,
  warnings: string[],
  foundFields: SecurityTxtFieldKey[]
): string {
  if (!available) {
    return "security.txt analysis could not be completed for this scan.";
  }
  if (!validation.present) {
    return "No security.txt file was found at /.well-known/security.txt or /security.txt.";
  }
  if (validation.isValid) {
    return "security.txt is present, served over HTTPS, and includes valid Contact and Expires metadata.";
  }
  if (warnings.length > 0) {
    return `security.txt was found with ${warnings.length} validation warning${
      warnings.length === 1 ? "" : "s"
    }: ${warnings[0]}`;
  }
  const found = foundFields.length > 0 ? foundFields.map((field) => FIELD_LABELS[field]).join(", ") : "no standard fields";
  return `security.txt was found but did not pass basic validation checks (detected ${found}).`;
}

function buildRecommendations(analysis: {
  available: boolean;
  validation: SecurityTxtValidation;
  foundFields: SecurityTxtFieldKey[];
  fields: SecurityTxtFields;
}): string[] {
  if (!analysis.available) {
    return ["Retry the scan and verify the domain allows fetching /security.txt files."];
  }

  const recommendations: string[] = [];
  const { validation, foundFields, fields } = analysis;
  if (!validation.present) {
    recommendations.push("Publish a security.txt file at /.well-known/security.txt (preferred).");
    recommendations.push("Include at minimum Contact and Expires fields so researchers can report issues safely.");
    recommendations.push("Serve security.txt over HTTPS to prevent tampering.");
    return recommendations;
  }

  if (!validation.usesHttps) {
    recommendations.push("Serve security.txt over HTTPS to protect integrity and authenticity.");
  }
  if (!validation.hasContact) {
    recommendations.push("Add at least one Contact field (mailto:, HTTPS form, or security portal).");
  }
  if (!validation.hasExpires) {
    recommendations.push("Add an Expires field and rotate it before expiration.");
  } else if (!validation.expiresValidFormat) {
    recommendations.push("Use an ISO-8601 timestamp for Expires (for example 2027-01-31T00:00:00Z).");
  } else if (validation.expiresExpired) {
    recommendations.push("Update Expires immediately; currently listed expiry is already in the past.");
  } else if (validation.expiresExpiringSoon) {
    recommendations.push("Rotate the Expires date soon so the policy does not lapse.");
  }

  if (!foundFields.includes("canonical")) {
    recommendations.push("Add a Canonical field to declare your authoritative security.txt location.");
  }
  if (fields.policy.length === 0) {
    recommendations.push("Add a Policy URL with your vulnerability disclosure guidelines.");
  }

  return recommendations;
}

function buildWarnings(validation: SecurityTxtValidation, foundFields: SecurityTxtFieldKey[]): string[] {
  const warnings: string[] = [];
  if (!validation.present) return warnings;
  if (!validation.usesHttps) {
    warnings.push("security.txt was fetched over HTTP instead of HTTPS.");
  }
  if (!validation.hasContact) {
    warnings.push("Contact field is missing.");
  }
  if (!validation.hasExpires) {
    warnings.push("Expires field is missing.");
  } else if (!validation.expiresValidFormat) {
    warnings.push("Expires field is not a valid date format.");
  } else if (validation.expiresExpired) {
    warnings.push("Expires field is already expired.");
  } else if (validation.expiresExpiringSoon) {
    warnings.push(`Expires field is within ${EXPIRING_SOON_WINDOW_DAYS} days.`);
  }
  if (foundFields.length === 0) {
    warnings.push("No recognized security.txt standard fields were parsed.");
  }
  return warnings;
}

function buildUnavailableAnalysis(targetUrl: string, reason: string): SecurityTxtAnalysis {
  const fields = emptySecurityTxtFields();
  const validation: SecurityTxtValidation = {
    present: false,
    usesHttps: false,
    hasContact: false,
    hasExpires: false,
    expiresValidFormat: false,
    expiresExpired: false,
    expiresExpiringSoon: false,
    isValid: false
  };
  const warnings = [`security.txt retrieval failed: ${reason}`];
  const recommendations = buildRecommendations({
    available: false,
    validation,
    foundFields: [],
    fields
  });
  return {
    available: false,
    checkedUrl: targetUrl,
    fetchedUrl: null,
    fetchedFrom: null,
    fallbackUsed: false,
    statusCode: null,
    fields,
    foundFields: [],
    validation,
    warnings,
    recommendations,
    score: 0,
    maxScore: 0,
    grade: "N/A",
    summary: summarizeSecurityTxt(false, validation, warnings, [])
  };
}

export async function analyzeSecurityTxt(
  targetUrl: string,
  options: SecurityTxtAnalysisOptions = {}
): Promise<SecurityTxtAnalysis> {
  let parsedTargetUrl: URL;
  try {
    parsedTargetUrl = new URL(targetUrl);
  } catch {
    return buildUnavailableAnalysis(targetUrl, "Invalid scan target URL.");
  }

  const timeoutMs =
    Number.isFinite(options.timeoutMs) && (options.timeoutMs ?? 0) > 0
      ? options.timeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS
      : DEFAULT_REQUEST_TIMEOUT_MS;
  const userAgent = options.userAgent?.trim() || DEFAULT_SCANNER_USER_AGENT;
  const followRedirects = options.followRedirects ?? true;

  let networkFailureCount = 0;
  let firstFailureReason = "Unable to fetch security.txt.";
  let lastStatusCode: number | null = null;

  for (let index = 0; index < SECURITY_TXT_LOCATIONS.length; index += 1) {
    const sourcePath = SECURITY_TXT_LOCATIONS[index];
    const candidateUrl = new URL(sourcePath, parsedTargetUrl);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(candidateUrl.toString(), {
        method: "GET",
        redirect: followRedirects ? "follow" : "manual",
        cache: "no-store",
        signal: controller.signal,
        headers: {
          "user-agent": userAgent
        }
      });
      lastStatusCode = response.status;
      if (!response.ok) {
        continue;
      }

      const content = await response.text();
      const { fields, foundFields } = parseSecurityTxt(content);
      const fetchedUrl = response.url || candidateUrl.toString();
      const validation = validateSecurityTxt(fields, fetchedUrl);
      const warnings = buildWarnings(validation, foundFields);
      const recommendations = buildRecommendations({
        available: true,
        validation,
        foundFields,
        fields
      });
      const isValid = validation.isValid;

      return {
        available: true,
        checkedUrl: targetUrl,
        fetchedUrl,
        fetchedFrom: sourcePath,
        fallbackUsed: index > 0,
        statusCode: response.status,
        fields,
        foundFields,
        validation,
        warnings,
        recommendations,
        score: isValid ? 1 : 0,
        maxScore: isValid ? 1 : 0,
        grade: isValid ? "A" : "N/A",
        summary: summarizeSecurityTxt(true, validation, warnings, foundFields)
      };
    } catch (error) {
      networkFailureCount += 1;
      if (networkFailureCount === 1) {
        firstFailureReason = error instanceof Error ? error.message : "Unexpected fetch failure.";
      }
    } finally {
      clearTimeout(timeout);
    }
  }

  if (networkFailureCount === SECURITY_TXT_LOCATIONS.length) {
    return buildUnavailableAnalysis(targetUrl, firstFailureReason);
  }

  const fields = emptySecurityTxtFields();
  const validation = validateSecurityTxt(fields, null);
  const foundFields: SecurityTxtFieldKey[] = [];
  const warnings: string[] = [];
  const recommendations = buildRecommendations({
    available: true,
    validation,
    foundFields,
    fields
  });

  return {
    available: true,
    checkedUrl: targetUrl,
    fetchedUrl: null,
    fetchedFrom: null,
    fallbackUsed: true,
    statusCode: lastStatusCode,
    fields,
    foundFields,
    validation,
    warnings,
    recommendations,
    score: 0,
    maxScore: 0,
    grade: "N/A",
    summary: summarizeSecurityTxt(true, validation, warnings, foundFields)
  };
}

export const __private__ = {
  parseSecurityTxt,
  validateSecurityTxt,
  buildWarnings
};

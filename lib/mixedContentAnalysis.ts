export type MixedContentCategory = "active" | "passive";
export type MixedContentSeverity = "critical" | "warning";
export type MixedContentElement = "script" | "link" | "img" | "iframe" | "video" | "audio" | "source" | "form" | "a";

export type MixedContentFinding = {
  id: string;
  category: MixedContentCategory;
  severity: MixedContentSeverity;
  element: MixedContentElement;
  attribute: "src" | "href" | "action";
  url: string;
  message: string;
  recommendation: string;
};

export type MixedContentAnalysis = {
  available: boolean;
  scannedUrl: string | null;
  finalUrl: string | null;
  isHttpsPage: boolean;
  totalMixedContentCount: number;
  activeCount: number;
  passiveCount: number;
  score: number;
  maxScore: number;
  grade: string;
  findings: MixedContentFinding[];
  recommendations: string[];
  summary: string;
};

type AttributeMap = Map<string, string | null>;

export const MIXED_CONTENT_MAX_SCORE = 10;

const MIXED_CONTENT_TAG_REGEX = /<(script|link|img|iframe|video|audio|source|form|a)\b[^>]*>/gi;

function scoreToGrade(score: number, maxScore: number): string {
  if (!Number.isFinite(score) || !Number.isFinite(maxScore) || maxScore <= 0) return "N/A";
  const ratio = score / maxScore;
  if (ratio >= 0.92) return "A";
  if (ratio >= 0.8) return "B";
  if (ratio >= 0.65) return "C";
  if (ratio >= 0.5) return "D";
  return "F";
}

function normalizeAttributeValue(value: string | null): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function parseTagAttributes(tagHtml: string): AttributeMap {
  const attributes: AttributeMap = new Map<string, string | null>();
  const tagNameMatch = /^<\s*[a-z0-9-]+/i.exec(tagHtml);
  const contentStart = tagNameMatch ? tagNameMatch[0].length : 1;
  const content = tagHtml.slice(contentStart, tagHtml.length - (tagHtml.endsWith("/>") ? 2 : 1));
  const attributeRegex = /([^\s"'<>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;

  let match: RegExpExecArray | null;
  while ((match = attributeRegex.exec(content)) !== null) {
    const key = match[1]?.toLowerCase().trim();
    if (!key) continue;
    const rawValue = match[2] ?? match[3] ?? match[4] ?? null;
    attributes.set(key, rawValue);
  }

  return attributes;
}

function linkIsStylesheet(attributes: AttributeMap): boolean {
  const rel = normalizeAttributeValue(attributes.get("rel") ?? null);
  if (!rel) return false;
  return rel
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .includes("stylesheet");
}

function classifyCategory(tag: MixedContentElement, attributes: AttributeMap): MixedContentCategory {
  if (tag === "script" || tag === "iframe") return "active";
  if (tag === "link" && linkIsStylesheet(attributes)) return "active";
  return "passive";
}

function expectedAttribute(tag: MixedContentElement): "src" | "href" | "action" {
  if (tag === "a" || tag === "link") return "href";
  if (tag === "form") return "action";
  return "src";
}

function buildRecommendation(tag: MixedContentElement, category: MixedContentCategory): string {
  if (category === "active") {
    return "Replace this reference with an HTTPS URL immediately or serve the resource from the same secure origin.";
  }
  if (tag === "form") {
    return "Submit forms to an HTTPS endpoint to avoid leaking form data over plaintext HTTP.";
  }
  if (tag === "a") {
    return "Use HTTPS for linked downloads and external destinations to avoid downgrade and tampering risks.";
  }
  return "Use HTTPS for this media/resource URL or host it locally over HTTPS.";
}

function buildMessage(tag: MixedContentElement, category: MixedContentCategory): string {
  const label = tag === "a" ? "Anchor link" : tag === "img" ? "Image" : `${tag.toUpperCase()} element`;
  if (category === "active") {
    return `${label} loads insecure HTTP content on an HTTPS page (active mixed content).`;
  }
  return `${label} references insecure HTTP content on an HTTPS page (passive mixed content).`;
}

function calculateScore(activeCount: number, passiveCount: number): { score: number; maxScore: number } {
  if (activeCount === 0 && passiveCount === 0) {
    return {
      score: MIXED_CONTENT_MAX_SCORE,
      maxScore: MIXED_CONTENT_MAX_SCORE
    };
  }

  let penalty = activeCount * 4 + passiveCount;
  if (activeCount > 0) {
    penalty += 2;
  }

  let score = Math.max(0, MIXED_CONTENT_MAX_SCORE - penalty);
  if (activeCount >= 2) {
    score = Math.min(score, 1);
  }
  if (activeCount >= 3) {
    score = 0;
  }

  return {
    score,
    maxScore: MIXED_CONTENT_MAX_SCORE
  };
}

function summarizeAnalysis(analysis: Omit<MixedContentAnalysis, "summary">): string {
  if (!analysis.available) {
    return "Mixed content analysis was unavailable for this response.";
  }
  if (!analysis.isHttpsPage) {
    return "Mixed content analysis is not applicable because the final page is not served over HTTPS.";
  }
  if (analysis.totalMixedContentCount === 0) {
    return "No mixed-content HTTP resource references were detected on this HTTPS page.";
  }

  const activeLabel = `${analysis.activeCount} active`;
  const passiveLabel = `${analysis.passiveCount} passive`;
  return `Detected ${analysis.totalMixedContentCount} mixed-content references (${activeLabel}, ${passiveLabel}). Active mixed content should be remediated immediately.`;
}

export function buildUnavailableMixedContentAnalysis(
  scannedUrl: string | null,
  finalUrl: string | null,
  reason: string
): MixedContentAnalysis {
  const base: Omit<MixedContentAnalysis, "summary"> = {
    available: false,
    scannedUrl,
    finalUrl,
    isHttpsPage: false,
    totalMixedContentCount: 0,
    activeCount: 0,
    passiveCount: 0,
    score: 0,
    maxScore: 0,
    grade: "N/A",
    findings: [],
    recommendations: [
      "Scan an HTML page over HTTPS to evaluate mixed-content exposure."
    ]
  };

  return {
    ...base,
    summary: `${summarizeAnalysis(base)} Reason: ${reason}`
  };
}

export function analyzeMixedContent(html: string, pageUrl: string, scannedUrl: string | null = null): MixedContentAnalysis {
  let parsedPageUrl: URL;
  try {
    parsedPageUrl = new URL(pageUrl);
  } catch {
    return buildUnavailableMixedContentAnalysis(scannedUrl, pageUrl, "Invalid final URL.");
  }

  if (parsedPageUrl.protocol !== "https:") {
    const base: Omit<MixedContentAnalysis, "summary"> = {
      available: true,
      scannedUrl,
      finalUrl: parsedPageUrl.toString(),
      isHttpsPage: false,
      totalMixedContentCount: 0,
      activeCount: 0,
      passiveCount: 0,
      score: 0,
      maxScore: 0,
      grade: "N/A",
      findings: [],
      recommendations: ["Serve pages over HTTPS before evaluating mixed-content issues."]
    };
    return {
      ...base,
      summary: summarizeAnalysis(base)
    };
  }

  const findings: MixedContentFinding[] = [];
  let match: RegExpExecArray | null;
  while ((match = MIXED_CONTENT_TAG_REGEX.exec(html)) !== null) {
    const tag = (match[1]?.toLowerCase() ?? "") as MixedContentElement;
    const tagHtml = match[0];
    if (!tag || !tagHtml) continue;

    const attributes = parseTagAttributes(tagHtml);
    const attribute = expectedAttribute(tag);
    const rawValue = normalizeAttributeValue(attributes.get(attribute) ?? null);
    if (!rawValue || !/^http:\/\//i.test(rawValue)) {
      continue;
    }

    const category = classifyCategory(tag, attributes);
    findings.push({
      id: `mixed-content-${findings.length + 1}`,
      category,
      severity: category === "active" ? "critical" : "warning",
      element: tag,
      attribute,
      url: rawValue,
      message: buildMessage(tag, category),
      recommendation: buildRecommendation(tag, category)
    });
  }

  const activeCount = findings.filter((finding) => finding.category === "active").length;
  const passiveCount = findings.length - activeCount;
  const { score, maxScore } = calculateScore(activeCount, passiveCount);
  const recommendations = Array.from(
    new Set([
      "Prefer explicit HTTPS URLs for all scripts, stylesheets, media, forms, and links.",
      "For third-party dependencies, migrate to HTTPS-capable providers or serve vetted copies locally.",
      activeCount > 0
        ? "Prioritize active mixed content (scripts, stylesheets, iframes) because browsers may block it and it enables high-impact tampering."
        : "",
      passiveCount > 0
        ? "Resolve passive mixed content (images/media/links/forms) to remove browser warnings and reduce downgrade risk."
        : ""
    ].filter(Boolean))
  );

  const base: Omit<MixedContentAnalysis, "summary"> = {
    available: true,
    scannedUrl,
    finalUrl: parsedPageUrl.toString(),
    isHttpsPage: true,
    totalMixedContentCount: findings.length,
    activeCount,
    passiveCount,
    score,
    maxScore,
    grade: scoreToGrade(score, maxScore),
    findings,
    recommendations
  };

  return {
    ...base,
    summary: summarizeAnalysis(base)
  };
}

export const __private__ = {
  parseTagAttributes,
  linkIsStylesheet,
  classifyCategory,
  calculateScore
};

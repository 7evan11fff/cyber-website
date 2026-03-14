export type BadgeStyle = "flat" | "plastic";
export type BadgeTheme = "default" | "slate" | "light";

export const DEFAULT_BADGE_LABEL = "security headers";
const FALLBACK_COLOR = "#9f9f9f";
const GRADE_COLORS: Record<string, string> = {
  A: "#4c1",
  B: "#97ca00",
  C: "#dfb317",
  D: "#fe7d37",
  F: "#e05d44"
};

const THEME_COLORS: Record<BadgeTheme, { leftBackground: string }> = {
  default: { leftBackground: "#555555" },
  slate: { leftBackground: "#334155" },
  light: { leftBackground: "#e2e8f0" }
};

function clampLabel(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return DEFAULT_BADGE_LABEL;
  return trimmed.slice(0, 42);
}

export function normalizeBadgeStyle(input: string | null): BadgeStyle {
  if (input === "plastic") return "plastic";
  return "flat";
}

export function normalizeBadgeTheme(input: string | null): BadgeTheme {
  if (input === "slate" || input === "light") return input;
  return "default";
}

export function normalizeBadgeLabel(input: string | null): string {
  if (typeof input !== "string") return DEFAULT_BADGE_LABEL;
  return clampLabel(input.replace(/\s+/g, " "));
}

export function normalizeGrade(input: string): string {
  const upper = input.trim().toUpperCase();
  return ["A", "B", "C", "D", "F"].includes(upper) ? upper : "F";
}

function badgeColor(grade: string) {
  return GRADE_COLORS[grade] ?? FALLBACK_COLOR;
}

function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function textWidth(value: string) {
  return value.length * 6 + 10;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const compact = hex.replace("#", "").trim();
  if (!/^[\da-f]{6}$/i.test(compact)) {
    return null;
  }
  const intValue = Number.parseInt(compact, 16);
  return {
    r: (intValue >> 16) & 255,
    g: (intValue >> 8) & 255,
    b: intValue & 255
  };
}

function relativeLuminance(channel: number) {
  const normalized = channel / 255;
  return normalized <= 0.03928 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
}

function pickContrastTextColor(backgroundHex: string) {
  const rgb = hexToRgb(backgroundHex);
  if (!rgb) return "#ffffff";
  const luminance =
    0.2126 * relativeLuminance(rgb.r) + 0.7152 * relativeLuminance(rgb.g) + 0.0722 * relativeLuminance(rgb.b);
  return luminance > 0.44 ? "#0f172a" : "#ffffff";
}

export function renderBadgeSvg({
  grade,
  style,
  label,
  theme
}: {
  grade: string;
  style: BadgeStyle;
  label: string;
  theme: BadgeTheme;
}) {
  const safeGrade = escapeXml(normalizeGrade(grade));
  const safeLabel = escapeXml(normalizeBadgeLabel(label));
  const themeColors = THEME_COLORS[theme];
  const rightFill = badgeColor(safeGrade);
  const leftFill = themeColors.leftBackground;
  const leftText = pickContrastTextColor(leftFill);
  const rightText = pickContrastTextColor(rightFill);
  const leftWidth = Math.max(92, textWidth(safeLabel));
  const rightWidth = Math.max(26, textWidth(safeGrade));
  const totalWidth = leftWidth + rightWidth;
  const radius = 3;
  const labelX = Math.floor(leftWidth / 2);
  const gradeX = leftWidth + Math.floor(rightWidth / 2);

  if (style === "plastic") {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${totalWidth}" height="20" role="img" aria-label="${safeLabel}: ${safeGrade}">
  <title>${safeLabel}: ${safeGrade}</title>
  <defs>
    <linearGradient id="badge-plastic" x2="0" y2="100%">
      <stop offset="0" stop-color="#ffffff" stop-opacity=".72"/>
      <stop offset=".1" stop-color="#ffffff" stop-opacity=".24"/>
      <stop offset=".6" stop-color="#000000" stop-opacity=".08"/>
      <stop offset="1" stop-color="#000000" stop-opacity=".2"/>
    </linearGradient>
  </defs>
  <mask id="badge-mask">
    <rect width="${totalWidth}" height="20" rx="${radius}" fill="#fff"/>
  </mask>
  <g mask="url(#badge-mask)">
    <rect width="${leftWidth}" height="20" fill="${leftFill}"/>
    <rect x="${leftWidth}" width="${rightWidth}" height="20" fill="${rightFill}"/>
    <rect width="${totalWidth}" height="20" fill="url(#badge-plastic)"/>
  </g>
  <g text-anchor="middle" font-family="Verdana,Geneva,DejaVu Sans,sans-serif" text-rendering="geometricPrecision" font-size="11">
    <text aria-hidden="true" x="${labelX}" y="15" fill="#010101" fill-opacity=".28">${safeLabel}</text>
    <text x="${labelX}" y="14" fill="${leftText}">${safeLabel}</text>
    <text aria-hidden="true" x="${gradeX}" y="15" fill="#010101" fill-opacity=".28">${safeGrade}</text>
    <text x="${gradeX}" y="14" fill="${rightText}">${safeGrade}</text>
  </g>
</svg>`;
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${totalWidth}" height="20" role="img" aria-label="${safeLabel}: ${safeGrade}">
  <title>${safeLabel}: ${safeGrade}</title>
  <mask id="badge-mask">
    <rect width="${totalWidth}" height="20" rx="${radius}" fill="#fff"/>
  </mask>
  <g mask="url(#badge-mask)">
    <rect width="${leftWidth}" height="20" fill="${leftFill}"/>
    <rect x="${leftWidth}" width="${rightWidth}" height="20" fill="${rightFill}"/>
  </g>
  <g text-anchor="middle" font-family="Verdana,Geneva,DejaVu Sans,sans-serif" text-rendering="geometricPrecision" font-size="11">
    <text x="${labelX}" y="14" fill="${leftText}">${safeLabel}</text>
    <text x="${gradeX}" y="14" fill="${rightText}">${safeGrade}</text>
  </g>
</svg>`;
}

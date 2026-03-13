import { NextResponse } from "next/server";
import { getOrCreateDomainReport, normalizeDomain } from "@/lib/securityReport";

type BadgeStyle = "flat" | "flat-square";

const LEFT_LABEL = "security headers";
const FALLBACK_COLOR = "#9f9f9f";
const GRADE_COLORS: Record<string, string> = {
  A: "#4c1",
  B: "#97ca00",
  C: "#dfb317",
  D: "#fe7d37",
  F: "#e05d44"
};

function normalizeStyle(input: string | null): BadgeStyle {
  return input === "flat-square" ? "flat-square" : "flat";
}

function normalizeGrade(input: string): string {
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

function renderBadgeSvg(grade: string, style: BadgeStyle) {
  const safeGrade = escapeXml(grade);
  const leftWidth = Math.max(92, textWidth(LEFT_LABEL));
  const rightWidth = Math.max(26, textWidth(safeGrade));
  const totalWidth = leftWidth + rightWidth;
  const radius = style === "flat-square" ? 0 : 3;
  const rightFill = badgeColor(grade);
  const labelX = Math.floor(leftWidth / 2);
  const gradeX = leftWidth + Math.floor(rightWidth / 2);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${totalWidth}" height="20" role="img" aria-label="${LEFT_LABEL}: ${safeGrade}">
  <title>${LEFT_LABEL}: ${safeGrade}</title>
  <linearGradient id="badge-shine" x2="0" y2="100%">
    <stop offset="0" stop-color="#fff" stop-opacity=".7"/>
    <stop offset=".1" stop-color="#aaa" stop-opacity=".1"/>
    <stop offset=".9" stop-opacity=".3"/>
    <stop offset="1" stop-opacity=".5"/>
  </linearGradient>
  <mask id="badge-mask">
    <rect width="${totalWidth}" height="20" rx="${radius}" fill="#fff"/>
  </mask>
  <g mask="url(#badge-mask)">
    <rect width="${leftWidth}" height="20" fill="#555"/>
    <rect x="${leftWidth}" width="${rightWidth}" height="20" fill="${rightFill}"/>
    <rect width="${totalWidth}" height="20" fill="url(#badge-shine)"/>
  </g>
  <g fill="#fff" text-anchor="middle" font-family="Verdana,Geneva,DejaVu Sans,sans-serif" text-rendering="geometricPrecision" font-size="11">
    <text aria-hidden="true" x="${labelX}" y="15" fill="#010101" fill-opacity=".3">${LEFT_LABEL}</text>
    <text x="${labelX}" y="14">${LEFT_LABEL}</text>
    <text aria-hidden="true" x="${gradeX}" y="15" fill="#010101" fill-opacity=".3">${safeGrade}</text>
    <text x="${gradeX}" y="14">${safeGrade}</text>
  </g>
</svg>`;
}

export async function GET(request: Request, { params }: { params: { domain: string } }) {
  const url = new URL(request.url);
  const style = normalizeStyle(url.searchParams.get("style"));

  let normalizedDomain: string;
  try {
    normalizedDomain = normalizeDomain(params.domain);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Invalid domain.";
    return NextResponse.json({ error: errorMessage }, { status: 400 });
  }

  let grade = "F";
  try {
    const report = await getOrCreateDomainReport(normalizedDomain);
    grade = normalizeGrade(report.grade);
  } catch {
    grade = "F";
  }

  const svg = renderBadgeSvg(grade, style);
  return new NextResponse(svg, {
    status: 200,
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400"
    }
  });
}

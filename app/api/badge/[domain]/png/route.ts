import { ImageResponse } from "next/og";
import { createElement } from "react";
import { enforceApiRateLimit, withApiRateLimitHeaders } from "@/lib/apiRateLimit";
import { getOrCreateDomainReport, normalizeDomain } from "@/lib/securityReport";

type BadgeStyle = "flat" | "flat-square";

export const runtime = "edge";

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

function textWidth(value: string) {
  return value.length * 6 + 10;
}

export async function GET(request: Request, { params }: { params: { domain: string } }) {
  const rateLimitResult = enforceApiRateLimit({
    request,
    route: "badge:png:get"
  });
  if (!rateLimitResult.ok) {
    return rateLimitResult.response;
  }
  const respondJson = (body: unknown, init?: ResponseInit) =>
    withApiRateLimitHeaders(Response.json(body, init), rateLimitResult.state);

  const requestUrl = new URL(request.url);
  const style = normalizeStyle(requestUrl.searchParams.get("style"));

  let normalizedDomain: string;
  try {
    normalizedDomain = normalizeDomain(params.domain);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Invalid domain.";
    return respondJson({ error: errorMessage }, { status: 400 });
  }

  let grade = "F";
  try {
    const report = await getOrCreateDomainReport(normalizedDomain);
    grade = normalizeGrade(report.grade);
  } catch {
    grade = "F";
  }

  const leftWidth = Math.max(92, textWidth(LEFT_LABEL));
  const rightWidth = Math.max(26, textWidth(grade));
  const totalWidth = leftWidth + rightWidth;
  const borderRadius = style === "flat-square" ? 0 : 3;

  const image = new ImageResponse(
    createElement(
      "div",
      {
        style: {
          width: `${totalWidth}px`,
          height: "20px",
          display: "flex",
          borderRadius: `${borderRadius}px`,
          overflow: "hidden",
          fontFamily: "Verdana, Geneva, DejaVu Sans, sans-serif",
          fontSize: "11px",
          color: "#ffffff",
          lineHeight: 1
        }
      },
      createElement(
        "div",
        {
          style: {
            width: `${leftWidth}px`,
            height: "20px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "#555555"
          }
        },
        LEFT_LABEL
      ),
      createElement(
        "div",
        {
          style: {
            width: `${rightWidth}px`,
            height: "20px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: badgeColor(grade)
          }
        },
        grade
      )
    ),
    {
      width: totalWidth,
      height: 20
    }
  );

  image.headers.set("Cache-Control", "public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400");
  return withApiRateLimitHeaders(image, rateLimitResult.state);
}

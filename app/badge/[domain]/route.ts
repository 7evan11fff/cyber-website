import { NextResponse } from "next/server";
import { enforceApiRateLimit, withApiRateLimitHeaders } from "@/lib/apiRateLimit";
import { normalizeBadgeLabel, normalizeBadgeStyle, normalizeBadgeTheme, normalizeGrade, renderBadgeSvg } from "@/lib/badge";
import { getOrCreateDomainReport, normalizeDomain } from "@/lib/securityReport";

export const runtime = "nodejs";

export async function GET(request: Request, { params }: { params: { domain: string } }) {
  const rateLimitResult = enforceApiRateLimit({
    request,
    route: "badge:public:get"
  });
  if (!rateLimitResult.ok) {
    return rateLimitResult.response;
  }
  const respondJson = (body: unknown, init?: ResponseInit) =>
    withApiRateLimitHeaders(NextResponse.json(body, init), rateLimitResult.state);

  const url = new URL(request.url);
  const style = normalizeBadgeStyle(url.searchParams.get("style"));
  const label = normalizeBadgeLabel(url.searchParams.get("label"));
  const theme = normalizeBadgeTheme(url.searchParams.get("theme"));

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

  const svg = renderBadgeSvg({
    grade,
    style,
    label,
    theme
  });
  return withApiRateLimitHeaders(
    new NextResponse(svg, {
      status: 200,
      headers: {
        "Content-Type": "image/svg+xml; charset=utf-8",
        "Cache-Control": "public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400"
      }
    }),
    rateLimitResult.state
  );
}

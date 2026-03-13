import { NextResponse } from "next/server";
import { analyzeSecurityHeaders, calculateGrade } from "@/lib/securityHeaders";

const REQUEST_TIMEOUT_MS = 12000;

function normalizeTargetUrl(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) {
    throw new Error("Please enter a URL.");
  }

  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;

  try {
    const parsed = new URL(withProtocol);
    if (!["http:", "https:"].includes(parsed.protocol)) {
      throw new Error("Only http and https URLs are supported.");
    }
    return parsed.toString();
  } catch {
    throw new Error("Please enter a valid URL.");
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const inputUrl = String(body?.url ?? "");
    const targetUrl = normalizeTargetUrl(inputUrl);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    let upstreamResponse: Response;
    try {
      upstreamResponse = await fetch(targetUrl, {
        method: "GET",
        redirect: "follow",
        cache: "no-store",
        signal: controller.signal,
        headers: {
          "user-agent": "SecurityHeaderChecker/1.0 (+https://vercel.com)"
        }
      });
    } finally {
      clearTimeout(timeout);
    }

    const results = analyzeSecurityHeaders(upstreamResponse.headers);
    const { score, grade } = calculateGrade(results);

    return NextResponse.json({
      checkedUrl: targetUrl,
      finalUrl: upstreamResponse.url,
      statusCode: upstreamResponse.status,
      score,
      grade,
      results,
      checkedAt: new Date().toISOString()
    });
  } catch (error) {
    const message =
      error instanceof Error && error.name === "AbortError"
        ? "Request timed out while fetching headers."
        : error instanceof Error
          ? error.message
          : "Unable to check headers.";

    return NextResponse.json({ error: message }, { status: 400 });
  }
}

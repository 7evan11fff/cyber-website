import { NextRequest, NextResponse } from "next/server";
import { analyzeSecurityHeaders, normalizeAndValidateUrl } from "@/lib/security-headers";

export const runtime = "nodejs";

interface FetchedHeaderData {
  headers: Headers;
  statusCode: number;
  finalUrl: string;
}

async function fetchWithTimeout(url: string, method: "HEAD" | "GET", timeoutMs = 10_000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      method,
      redirect: "follow",
      cache: "no-store",
      signal: controller.signal,
      headers: {
        "user-agent": "CyberSecurityHeaderChecker/1.0 (+https://vercel.com)"
      }
    });

    if (method === "GET") {
      await response.body?.cancel();
    }

    return response;
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchTargetHeaders(targetUrl: string): Promise<FetchedHeaderData> {
  try {
    const headResponse = await fetchWithTimeout(targetUrl, "HEAD");
    if (headResponse.status !== 405 && headResponse.status !== 501) {
      return {
        headers: headResponse.headers,
        statusCode: headResponse.status,
        finalUrl: headResponse.url
      };
    }
  } catch {
    // Fall through to GET fallback.
  }

  const getResponse = await fetchWithTimeout(targetUrl, "GET");
  return {
    headers: getResponse.headers,
    statusCode: getResponse.status,
    finalUrl: getResponse.url
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { url?: string };
    const parsedUrl = normalizeAndValidateUrl(body.url ?? "");
    const fetched = await fetchTargetHeaders(parsedUrl.toString());
    const analysis = analyzeSecurityHeaders(fetched.headers);

    const present = analysis.results.filter((item) => item.status === "present").length;
    const missing = analysis.results.filter((item) => item.status === "missing").length;
    const misconfigured = analysis.results.filter((item) => item.status === "misconfigured").length;

    return NextResponse.json({
      targetUrl: parsedUrl.toString(),
      finalUrl: fetched.finalUrl,
      statusCode: fetched.statusCode,
      scannedAt: new Date().toISOString(),
      score: analysis.score,
      grade: analysis.grade,
      summary: {
        present,
        missing,
        misconfigured
      },
      results: analysis.results
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to scan the provided URL.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

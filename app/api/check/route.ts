import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { consumeRateLimit, getClientIp } from "@/lib/rateLimit";
import { runSecurityScan } from "@/lib/securityReport";
import { getUserKeyFromSessionUser } from "@/lib/userDataStore";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  const userKey = getUserKeyFromSessionUser(session?.user);
  const isAuthenticated = Boolean(userKey);
  const rateLimit = isAuthenticated ? 200 : 60;
  const ip = getClientIp(request);
  const rateLimitKey = `${isAuthenticated ? "auth" : "anon"}:${ip}`;
  const rateLimitResult = consumeRateLimit(rateLimitKey, rateLimit);

  if (!rateLimitResult.allowed) {
    const retryAfterSeconds = Math.max(Math.ceil((rateLimitResult.resetAt - Date.now()) / 1000), 1);
    return NextResponse.json(
      {
        error:
          "You have reached the scan limit for this minute. Please wait a moment and try again."
      },
      {
        status: 429,
        headers: {
          "Retry-After": String(retryAfterSeconds),
          "X-RateLimit-Limit": String(rateLimit),
          "X-RateLimit-Remaining": "0"
        }
      }
    );
  }

  try {
    const body = await request.json();
    const inputUrl = String(body?.url ?? "");
    const report = await runSecurityScan(inputUrl);
    return NextResponse.json(report, {
      headers: {
        "X-RateLimit-Limit": String(rateLimit),
        "X-RateLimit-Remaining": String(rateLimitResult.remaining)
      }
    });
  } catch (error) {
    const message =
      error instanceof Error && error.name === "AbortError"
        ? "Request timed out while fetching headers."
        : error instanceof Error
          ? error.message
          : "Unable to check headers.";

    return NextResponse.json(
      { error: message },
      {
        status: 400,
        headers: {
          "X-RateLimit-Limit": String(rateLimit),
          "X-RateLimit-Remaining": String(rateLimitResult.remaining)
        }
      }
    );
  }
}

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { consumeRateLimit, getClientIp } from "@/lib/rateLimit";
import { runSecurityScan } from "@/lib/securityReport";
import { getUserByApiKey, getUserKeyFromSessionUser } from "@/lib/userDataStore";

export const runtime = "nodejs";

const CHECK_REQUEST_SCHEMA = z.object({
  url: z.string().trim().min(1, "URL is required.").max(2048, "URL is too long.")
});

function extractApiKey(request: Request): string | null {
  const directHeader = request.headers.get("x-api-key")?.trim();
  if (directHeader) {
    return directHeader;
  }

  const authorization = request.headers.get("authorization")?.trim();
  if (!authorization) {
    return null;
  }

  const [scheme, token] = authorization.split(/\s+/, 2);
  if (scheme?.toLowerCase() !== "bearer" || !token) {
    return null;
  }
  return token.trim() || null;
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  const sessionUserKey = getUserKeyFromSessionUser(session?.user);
  let authenticatedUserKey = sessionUserKey;
  const providedApiKey = extractApiKey(request);

  if (!authenticatedUserKey && providedApiKey) {
    const apiKeyOwner = await getUserByApiKey(providedApiKey);
    if (!apiKeyOwner) {
      return NextResponse.json({ error: "Invalid API key." }, { status: 401 });
    }
    authenticatedUserKey = apiKeyOwner.userKey;
  }

  const isAuthenticated = Boolean(authenticatedUserKey);
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
    const body = (await request.json().catch(() => null)) as unknown;
    const parsedBody = CHECK_REQUEST_SCHEMA.safeParse(body);
    if (!parsedBody.success) {
      const issue = parsedBody.error.issues[0];
      return NextResponse.json(
        { error: issue?.message ?? "Invalid request payload." },
        {
          status: 422,
          headers: {
            "X-RateLimit-Limit": String(rateLimit),
            "X-RateLimit-Remaining": String(rateLimitResult.remaining)
          }
        }
      );
    }

    const inputUrl = parsedBody.data.url;
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
          ? error.message || "Unable to check headers."
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

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import * as Sentry from "@sentry/nextjs";
import { z } from "zod";
import { enforceApiRateLimit, withApiRateLimitHeaders } from "@/lib/apiRateLimit";
import { authOptions } from "@/lib/auth";
import { runSecurityScan } from "@/lib/securityReport";
import { getUserByApiKey, getUserKeyFromSessionUser } from "@/lib/userDataStore";

export const runtime = "nodejs";

const CHECK_REQUEST_SCHEMA = z.object({
  url: z.string().trim().min(1, "URL is required.").max(2048, "URL is too long."),
  options: z
    .object({
      userAgent: z.string().trim().min(1).max(512).optional(),
      followRedirects: z.boolean().optional(),
      timeoutMs: z.union([z.literal(5000), z.literal(10000), z.literal(15000)]).optional()
    })
    .strict()
    .optional()
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

function parsePositiveInteger(value: string | undefined, fallback: number) {
  if (!value) return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  const floored = Math.floor(parsed);
  return floored > 0 ? floored : fallback;
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  const sessionUserKey = getUserKeyFromSessionUser(session?.user);
  let authenticatedUserKey = sessionUserKey;
  let authenticatedViaApiKey = false;
  const providedApiKey = extractApiKey(request);

  if (!authenticatedUserKey && providedApiKey) {
    const apiKeyOwner = await getUserByApiKey(providedApiKey);
    if (!apiKeyOwner) {
      const invalidApiKeyLimitResult = enforceApiRateLimit({
        request,
        route: "check",
        identity: {
          isAuthenticated: false
        }
      });
      if (!invalidApiKeyLimitResult.ok) {
        return invalidApiKeyLimitResult.response;
      }
      return withApiRateLimitHeaders(
        NextResponse.json({ error: "Invalid API key." }, { status: 401 }),
        invalidApiKeyLimitResult.state
      );
    }
    authenticatedUserKey = apiKeyOwner.userKey;
    authenticatedViaApiKey = true;
  }

  const isAuthenticated = Boolean(authenticatedUserKey);
  const apiKeyAuthenticatedLimit = parsePositiveInteger(
    process.env.API_RATE_LIMIT_API_KEY_PER_MINUTE,
    300
  );
  const rateLimitResult = enforceApiRateLimit({
    request,
    route: "check",
    identity: {
      isAuthenticated,
      userKey: authenticatedUserKey
    },
    authenticatedLimit: authenticatedViaApiKey ? apiKeyAuthenticatedLimit : undefined
  });
  if (!rateLimitResult.ok) {
    return rateLimitResult.response;
  }

  const respond = (body: unknown, init?: ResponseInit) =>
    withApiRateLimitHeaders(NextResponse.json(body, init), rateLimitResult.state);

  try {
    const body = (await request.json().catch(() => null)) as unknown;
    const parsedBody = CHECK_REQUEST_SCHEMA.safeParse(body);
    if (!parsedBody.success) {
      const issue = parsedBody.error.issues[0];
      return respond({ error: issue?.message ?? "Invalid request payload." }, { status: 422 });
    }

    const inputUrl = parsedBody.data.url;
    const report = await runSecurityScan(inputUrl, parsedBody.data.options);
    return respond(report);
  } catch (error) {
    if (!(error instanceof Error && error.name === "AbortError")) {
      Sentry.captureException(error, {
        tags: {
          endpoint: "/api/check"
        }
      });
    }

    const message =
      error instanceof Error && error.name === "AbortError"
        ? "Request timed out while fetching headers."
        : error instanceof Error
          ? error.message || "Unable to check headers."
          : "Unable to check headers.";

    return respond({ error: message }, { status: 400 });
  }
}

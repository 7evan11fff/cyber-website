import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import * as Sentry from "@sentry/nextjs";
import { z } from "zod";
import { enforceApiRateLimit, withApiRateLimitHeaders } from "@/lib/apiRateLimit";
import { authOptions } from "@/lib/auth";
import { recordPublicScan } from "@/lib/publicStatsStore";
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

function getNestedErrorCode(error: unknown): string | null {
  if (!(error instanceof Error)) return null;
  const cause = (error as Error & { cause?: unknown }).cause;
  if (!cause || typeof cause !== "object") return null;
  const code = (cause as { code?: unknown }).code;
  return typeof code === "string" ? code : null;
}

function isDomainUnreachableError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const message = error.message.toLowerCase();
  const nestedCode = getNestedErrorCode(error);
  const code = nestedCode?.toUpperCase() ?? "";

  if (["ENOTFOUND", "EAI_AGAIN", "ECONNREFUSED", "ECONNRESET", "ETIMEDOUT", "UND_ERR_CONNECT_TIMEOUT"].includes(code)) {
    return true;
  }

  return (
    message.includes("fetch failed") ||
    message.includes("enotfound") ||
    message.includes("eai_again") ||
    message.includes("econnrefused") ||
    message.includes("econnreset") ||
    message.includes("timed out") ||
    message.includes("network")
  );
}

function toFriendlyCheckErrorMessage(error: unknown): string {
  if (error instanceof Error && error.name === "AbortError") {
    return "The scan timed out while waiting for the site to respond.";
  }

  if (isDomainUnreachableError(error)) {
    return "We couldn't reach that domain. Check the URL and confirm the site is online, then try again.";
  }

  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return "Unable to check headers right now.";
}

const CORS_ALLOWED_METHODS = "POST, OPTIONS";
const CORS_ALLOWED_HEADERS = "Content-Type, Authorization, X-API-Key";

function getAllowedCorsOrigin(request: Request): string | null {
  const origin = request.headers.get("origin")?.trim();
  if (!origin) {
    return null;
  }

  if (origin.startsWith("chrome-extension://")) {
    return origin;
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (!siteUrl) {
    return null;
  }

  try {
    const allowedOrigin = new URL(siteUrl).origin;
    return origin === allowedOrigin ? origin : null;
  } catch {
    return null;
  }
}

function withCorsHeaders(response: Response, request: Request): Response {
  const origin = getAllowedCorsOrigin(request);
  if (!origin) {
    return response;
  }
  response.headers.set("Access-Control-Allow-Origin", origin);
  response.headers.set("Access-Control-Allow-Methods", CORS_ALLOWED_METHODS);
  response.headers.set("Access-Control-Allow-Headers", CORS_ALLOWED_HEADERS);
  response.headers.set("Access-Control-Max-Age", "86400");
  response.headers.append("Vary", "Origin");
  return response;
}

export async function OPTIONS(request: Request) {
  return withCorsHeaders(new NextResponse(null, { status: 204 }), request);
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
        return withCorsHeaders(invalidApiKeyLimitResult.response, request);
      }
      return withCorsHeaders(
        withApiRateLimitHeaders(
          NextResponse.json(
            { error: "API key not recognized. Double-check the key and try again." },
            { status: 401 }
          ),
          invalidApiKeyLimitResult.state
        ),
        request
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
    return withCorsHeaders(rateLimitResult.response, request);
  }

  const respond = (body: unknown, init?: ResponseInit) =>
    withCorsHeaders(withApiRateLimitHeaders(NextResponse.json(body, init), rateLimitResult.state), request);

  try {
    const body = (await request.json().catch(() => null)) as unknown;
    const parsedBody = CHECK_REQUEST_SCHEMA.safeParse(body);
    if (!parsedBody.success) {
      const issue = parsedBody.error.issues[0];
      return respond({ error: issue?.message ?? "Invalid request payload." }, { status: 422 });
    }

    const inputUrl = parsedBody.data.url;
    const report = await runSecurityScan(inputUrl, parsedBody.data.options);
    void recordPublicScan(report).catch(() => {
      // Public stats should not block scan responses.
    });
    return respond(report);
  } catch (error) {
    if (!(error instanceof Error && error.name === "AbortError")) {
      Sentry.captureException(error, {
        tags: {
          endpoint: "/api/check"
        }
      });
    }

    const message = toFriendlyCheckErrorMessage(error);

    return respond({ error: message }, { status: 400 });
  }
}

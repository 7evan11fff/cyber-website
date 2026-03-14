import { NextResponse } from "next/server";
import { consumeRateLimit, getClientIp } from "@/lib/rateLimit";

const DEFAULT_UNAUTHENTICATED_LIMIT = 30;
const DEFAULT_AUTHENTICATED_LIMIT = 100;

type RateLimitIdentity = {
  isAuthenticated: boolean;
  userKey?: string | null;
};

type ApiRateLimitOptions = {
  request: Request;
  route: string;
  identity?: RateLimitIdentity;
  unauthenticatedLimit?: number;
  authenticatedLimit?: number;
};

type RateLimitHeaderState = {
  limit: number;
  remaining: number;
  resetAt: number;
};

const DEFAULT_API_CACHE_CONTROL = "private, no-store, max-age=0, must-revalidate";

export type ApiRateLimitResult =
  | {
      ok: true;
      state: RateLimitHeaderState;
    }
  | {
      ok: false;
      response: Response;
    };

function parsePositiveInteger(value: string | undefined, fallback: number) {
  if (!value) return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  const floored = Math.floor(parsed);
  if (floored <= 0) return fallback;
  return floored;
}

function resolveRateLimit(identity: RateLimitIdentity | undefined, options: ApiRateLimitOptions) {
  if (identity?.isAuthenticated) {
    return parsePositiveInteger(
      process.env.API_RATE_LIMIT_AUTH_PER_MINUTE,
      options.authenticatedLimit ?? DEFAULT_AUTHENTICATED_LIMIT
    );
  }

  return parsePositiveInteger(
    process.env.API_RATE_LIMIT_ANON_PER_MINUTE,
    options.unauthenticatedLimit ?? DEFAULT_UNAUTHENTICATED_LIMIT
  );
}

function normalizeIdentityKey(identity: RateLimitIdentity | undefined, ip: string) {
  if (!identity?.isAuthenticated) return ip;
  const trimmedUserKey = identity.userKey?.trim().toLowerCase();
  if (trimmedUserKey) return trimmedUserKey;
  return ip;
}

function applyRateLimitHeaders(response: Response, state: RateLimitHeaderState) {
  response.headers.set("X-RateLimit-Limit", String(state.limit));
  response.headers.set("X-RateLimit-Remaining", String(state.remaining));
  response.headers.set("X-RateLimit-Reset", String(Math.ceil(state.resetAt / 1000)));
  if (!response.headers.has("Cache-Control")) {
    response.headers.set("Cache-Control", DEFAULT_API_CACHE_CONTROL);
  }
  return response;
}

export function enforceApiRateLimit(options: ApiRateLimitOptions): ApiRateLimitResult {
  const identity = options.identity ?? { isAuthenticated: false };
  const limit = resolveRateLimit(identity, options);
  const ip = getClientIp(options.request);
  const identityKey = normalizeIdentityKey(identity, ip);
  const authScope = identity.isAuthenticated ? "auth" : "anon";
  const bucketKey = `api:${options.route}:${authScope}:${identityKey}`;
  const result = consumeRateLimit(bucketKey, limit);
  const state: RateLimitHeaderState = {
    limit,
    remaining: result.remaining,
    resetAt: result.resetAt
  };

  if (!result.allowed) {
    const retryAfterSeconds = Math.max(Math.ceil((result.resetAt - Date.now()) / 1000), 1);
    const response = NextResponse.json(
      {
        error: "Rate limit exceeded. Please wait a moment and try again."
      },
      {
        status: 429,
        headers: {
          "Retry-After": String(retryAfterSeconds)
        }
      }
    );
    return { ok: false, response: applyRateLimitHeaders(response, { ...state, remaining: 0 }) };
  }

  return { ok: true, state };
}

export function withApiRateLimitHeaders(response: Response, state: RateLimitHeaderState): Response {
  return applyRateLimitHeaders(response, state);
}

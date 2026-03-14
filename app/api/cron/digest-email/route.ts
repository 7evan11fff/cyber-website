import { NextResponse } from "next/server";
import { sendWatchlistDigestEmail } from "@/lib/email";
import { buildDigestSummary, shouldSendDigestNow } from "@/lib/digestEmail";
import { getClientIp, consumeRateLimit } from "@/lib/rateLimit";
import { getUsersWithWatchlistData, updateUserDataForUser } from "@/lib/userDataStore";

export const runtime = "nodejs";

const NO_STORE_HEADERS = {
  "Cache-Control": "private, no-store, max-age=0, must-revalidate"
};

function clampPositiveInteger(value: string | undefined, fallback: number, min: number, max: number) {
  if (!value) return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(Math.floor(parsed), min), max);
}

function isLikelyEmailAddress(value: string | null | undefined) {
  if (!value) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function resolveRecipientEmail(userKey: string, alertEmail: string | null) {
  if (alertEmail && isLikelyEmailAddress(alertEmail)) return alertEmail.trim();
  if (isLikelyEmailAddress(userKey)) return userKey;
  return null;
}

function isAuthorizedCronRequest(request: Request) {
  const configuredSecret = process.env.CRON_SECRET?.trim();
  const authorization = request.headers.get("authorization");
  const headerSecret = request.headers.get("x-cron-secret");
  const isVercelCron = request.headers.get("x-vercel-cron") === "1";

  if (configuredSecret) {
    return (
      authorization === `Bearer ${configuredSecret}` ||
      headerSecret === configuredSecret ||
      (isVercelCron && headerSecret === configuredSecret)
    );
  }

  if (isVercelCron) {
    return true;
  }

  return process.env.NODE_ENV !== "production";
}

function jsonNoStore(body: unknown, init?: ResponseInit) {
  return NextResponse.json(body, {
    ...init,
    headers: {
      ...NO_STORE_HEADERS,
      ...(init?.headers ?? {})
    }
  });
}

export async function GET(request: Request) {
  if (!isAuthorizedCronRequest(request)) {
    return jsonNoStore({ error: "Unauthorized" }, { status: 401 });
  }

  const routeRateLimit = clampPositiveInteger(process.env.CRON_ROUTE_RATE_LIMIT_PER_MINUTE, 4, 1, 100);
  const routeRateLimitKey = `cron:digest-email:${getClientIp(request)}`;
  const routeRateLimitResult = consumeRateLimit(routeRateLimitKey, routeRateLimit);
  if (!routeRateLimitResult.allowed) {
    const retryAfter = Math.max(Math.ceil((routeRateLimitResult.resetAt - Date.now()) / 1000), 1);
    return jsonNoStore(
      { error: "Too many cron invocations. Please retry later." },
      {
        status: 429,
        headers: {
          ...NO_STORE_HEADERS,
          "Retry-After": String(retryAfter)
        }
      }
    );
  }

  const requestUrl = new URL(request.url);
  const force = requestUrl.searchParams.get("force") === "1";
  const dryRun = requestUrl.searchParams.get("dryRun") === "1";
  const now = new Date();
  const nowIso = now.toISOString();
  const maxEmailsPerRun = clampPositiveInteger(process.env.CRON_DIGEST_MAX_EMAILS_PER_RUN, 500, 1, 5000);

  const users = await getUsersWithWatchlistData();
  if (users.length === 0) {
    return jsonNoStore({
      ok: true,
      message: "No users with personal watchlist entries.",
      totals: {
        usersScanned: 0,
        digestsSent: 0,
        dryRunUsers: 0,
        skippedDisabled: 0,
        skippedSchedule: 0,
        skippedMissingRecipient: 0,
        skippedNoDomains: 0,
        skippedCapacity: 0,
        failed: 0
      }
    });
  }

  if (!dryRun && !process.env.RESEND_API_KEY) {
    return jsonNoStore(
      {
        error: "Missing RESEND_API_KEY. Digest emails are not configured."
      },
      { status: 503 }
    );
  }

  let digestsSent = 0;
  let dryRunUsers = 0;
  let skippedDisabled = 0;
  let skippedSchedule = 0;
  let skippedMissingRecipient = 0;
  let skippedNoDomains = 0;
  let skippedCapacity = 0;
  let failed = 0;
  const warnings: string[] = [];

  for (const user of users) {
    try {
      const recipientEmail = resolveRecipientEmail(user.userKey, user.data.alertEmail);
      if (!recipientEmail) {
        skippedMissingRecipient += 1;
        continue;
      }

      const timing = shouldSendDigestNow({
        frequency: user.data.digestFrequency,
        now,
        lastSentAt: user.data.digestLastSentAt,
        enforceSchedule: !force
      });
      if (!timing.shouldSend) {
        if (timing.reason === "digest_disabled") {
          skippedDisabled += 1;
        } else {
          skippedSchedule += 1;
        }
        continue;
      }

      if (digestsSent >= maxEmailsPerRun) {
        skippedCapacity += 1;
        continue;
      }

      const summary = buildDigestSummary(user.data.watchlist, user.data.digestGradeSnapshot);
      if (summary.stats.totalDomainsMonitored === 0) {
        skippedNoDomains += 1;
        continue;
      }

      if (dryRun) {
        dryRunUsers += 1;
        continue;
      }

      const digestFrequency = user.data.digestFrequency;
      if (digestFrequency === "off") {
        skippedDisabled += 1;
        continue;
      }

      await sendWatchlistDigestEmail({
        toEmail: recipientEmail,
        frequency: digestFrequency,
        summary
      });
      await updateUserDataForUser(user.userKey, {
        digestLastSentAt: nowIso,
        digestGradeSnapshot: summary.snapshot
      });
      digestsSent += 1;
    } catch (error) {
      failed += 1;
      if (warnings.length < 50) {
        warnings.push(
          `digest failed for ${user.userKey}: ${error instanceof Error ? error.message : "unknown error"}`
        );
      }
    }
  }

  return jsonNoStore({
    ok: true,
    totals: {
      usersScanned: users.length,
      digestsSent,
      dryRunUsers,
      skippedDisabled,
      skippedSchedule,
      skippedMissingRecipient,
      skippedNoDomains,
      skippedCapacity,
      failed
    },
    warnings
  });
}

export async function POST(request: Request) {
  return GET(request);
}

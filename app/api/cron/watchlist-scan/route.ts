import { NextResponse } from "next/server";
import { sendGradeChangeEmail, getNotificationThrottleMs } from "@/lib/email";
import { consumeRateLimit, getClientIp } from "@/lib/rateLimit";
import { runSecurityScan } from "@/lib/securityReport";
import { recordDomainGradeHistoryPoint, type NotificationFrequency, type WatchlistEntry } from "@/lib/userData";
import { getUsersWithWatchlistData, updateUserDataForUser } from "@/lib/userDataStore";

export const runtime = "nodejs";

type ScanResult =
  | {
      ok: true;
      checkedUrl: string;
      grade: string;
      checkedAt: string;
    }
  | {
      ok: false;
      error: string;
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

async function scanDomains(urls: string[], concurrency: number) {
  const results = new Map<string, ScanResult>();
  let cursor = 0;

  async function worker() {
    while (true) {
      const index = cursor;
      cursor += 1;
      const targetUrl = urls[index];
      if (!targetUrl) break;
      try {
        const report = await runSecurityScan(targetUrl);
        results.set(targetUrl.toLowerCase(), {
          ok: true,
          checkedUrl: report.checkedUrl,
          grade: report.grade.toUpperCase(),
          checkedAt: report.checkedAt
        });
      } catch (error) {
        results.set(targetUrl.toLowerCase(), {
          ok: false,
          error: error instanceof Error ? error.message : "Unable to scan domain."
        });
      }
    }
  }

  const safeConcurrency = Math.max(1, Math.min(concurrency, 10));
  await Promise.all(Array.from({ length: safeConcurrency }, () => worker()));
  return results;
}

function shouldSendNow(
  frequency: NotificationFrequency,
  lastSentAt: string | undefined,
  nowMs: number
): { allowed: boolean; nextEligibleAt?: string } {
  const throttleMs = getNotificationThrottleMs(frequency);
  if (throttleMs <= 0) return { allowed: true };
  if (!lastSentAt) return { allowed: true };

  const lastSentAtMs = new Date(lastSentAt).getTime();
  if (!Number.isFinite(lastSentAtMs)) return { allowed: true };
  if (nowMs - lastSentAtMs >= throttleMs) return { allowed: true };

  return { allowed: false, nextEligibleAt: new Date(lastSentAtMs + throttleMs).toISOString() };
}

export async function GET(request: Request) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const routeRateLimit = clampPositiveInteger(process.env.CRON_ROUTE_RATE_LIMIT_PER_MINUTE, 4, 1, 100);
  const routeRateLimitKey = `cron:watchlist-scan:${getClientIp(request)}`;
  const routeRateLimitResult = consumeRateLimit(routeRateLimitKey, routeRateLimit);
  if (!routeRateLimitResult.allowed) {
    const retryAfter = Math.max(Math.ceil((routeRateLimitResult.resetAt - Date.now()) / 1000), 1);
    return NextResponse.json(
      { error: "Too many cron invocations. Please retry later." },
      {
        status: 429,
        headers: {
          "Retry-After": String(retryAfter)
        }
      }
    );
  }

  const users = await getUsersWithWatchlistData();
  if (users.length === 0) {
    return NextResponse.json({
      ok: true,
      message: "No users with watchlist entries.",
      totals: {
        usersScanned: 0,
        domainsScanned: 0,
        usersUpdated: 0,
        gradeChanges: 0,
        emailsSent: 0,
        emailsFailed: 0,
        emailsThrottled: 0
      }
    });
  }

  const maxDomainsPerRun = clampPositiveInteger(process.env.CRON_WATCHLIST_MAX_DOMAINS_PER_RUN, 200, 1, 2000);
  const maxEmailsPerRun = clampPositiveInteger(process.env.CRON_WATCHLIST_MAX_EMAILS_PER_RUN, 250, 1, 5000);
  const scanConcurrency = clampPositiveInteger(process.env.CRON_WATCHLIST_SCAN_CONCURRENCY, 3, 1, 10);

  const uniqueUrls = new Set<string>();
  for (const user of users) {
    for (const entry of user.data.watchlist) {
      if (!entry.url) continue;
      const trimmed = entry.url.trim();
      if (!trimmed) continue;
      uniqueUrls.add(trimmed);
    }
  }

  const targetUrls = Array.from(uniqueUrls).slice(0, maxDomainsPerRun);
  const scanResults = await scanDomains(targetUrls, scanConcurrency);
  const now = Date.now();

  let usersUpdated = 0;
  let gradeChanges = 0;
  let emailsSent = 0;
  let emailsFailed = 0;
  let emailsThrottled = 0;
  let emailsSuppressed = 0;
  const errors: string[] = [];

  for (const user of users) {
    try {
      let userChanged = false;
      let nextHistory = user.data.history;
      let nextWatchlist: WatchlistEntry[] = user.data.watchlist.map((entry) => ({ ...entry }));
      let nextNotificationLog = { ...user.data.watchlistNotificationLog };
      const recipientEmail = resolveRecipientEmail(user.userKey, user.data.alertEmail);

      for (const [index, entry] of nextWatchlist.entries()) {
        const scanned = scanResults.get(entry.url.trim().toLowerCase());
        if (!scanned || !scanned.ok) {
          if (scanned && errors.length < 50) {
            errors.push(`scan failed for ${entry.url}: ${scanned.error}`);
          }
          continue;
        }

        const previousGrade = entry.lastGrade.toUpperCase();
        const currentGrade = scanned.grade.toUpperCase();
        const changed = previousGrade !== currentGrade;

        nextWatchlist[index] = {
          ...entry,
          url: scanned.checkedUrl,
          lastGrade: currentGrade,
          previousGrade: changed ? previousGrade : null,
          lastCheckedAt: scanned.checkedAt
        };
        nextHistory = recordDomainGradeHistoryPoint(nextHistory, {
          url: scanned.checkedUrl,
          grade: currentGrade,
          checkedAt: scanned.checkedAt
        });
        userChanged = true;

        if (!changed) {
          continue;
        }

        gradeChanges += 1;
        if (!user.data.notificationOnGradeChange || !recipientEmail) {
          emailsSuppressed += 1;
          continue;
        }

        if (!process.env.RESEND_API_KEY) {
          emailsSuppressed += 1;
          continue;
        }

        if (emailsSent >= maxEmailsPerRun) {
          emailsSuppressed += 1;
          continue;
        }

        const notificationKey = scanned.checkedUrl.toLowerCase();
        const timing = shouldSendNow(
          user.data.notificationFrequency,
          nextNotificationLog[notificationKey],
          now
        );
        if (!timing.allowed) {
          emailsThrottled += 1;
          continue;
        }

        try {
          await sendGradeChangeEmail({
            toEmail: recipientEmail,
            url: scanned.checkedUrl,
            previousGrade,
            currentGrade,
            checkedAt: scanned.checkedAt,
            frequency: user.data.notificationFrequency
          });
          nextNotificationLog[notificationKey] = new Date(now).toISOString();
          userChanged = true;
          emailsSent += 1;
        } catch (error) {
          emailsFailed += 1;
          if (errors.length < 50) {
            const message = error instanceof Error ? error.message : "email delivery failed";
            errors.push(`email failed for ${recipientEmail} (${scanned.checkedUrl}): ${message}`);
          }
        }
      }

      if (userChanged) {
        await updateUserDataForUser(user.userKey, {
          watchlist: nextWatchlist,
          history: nextHistory,
          watchlistNotificationLog: nextNotificationLog
        });
        usersUpdated += 1;
      }
    } catch (error) {
      if (errors.length < 50) {
        errors.push(
          `user update failed for ${user.userKey}: ${
            error instanceof Error ? error.message : "unexpected error"
          }`
        );
      }
    }
  }

  return NextResponse.json({
    ok: true,
    totals: {
      usersScanned: users.length,
      domainsScanned: targetUrls.length,
      usersUpdated,
      gradeChanges,
      emailsSent,
      emailsFailed,
      emailsThrottled,
      emailsSuppressed
    },
    warnings: errors
  });
}

export async function POST(request: Request) {
  return GET(request);
}

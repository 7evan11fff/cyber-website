import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { enforceApiRateLimit, withApiRateLimitHeaders } from "@/lib/apiRateLimit";
import { authOptions } from "@/lib/auth";
import { getNotificationThrottleMs, sendGradeChangeEmail } from "@/lib/email";
import { normalizeTargetUrl } from "@/lib/securityReport";
import { getUserDataForUser, getUserKeyFromSessionUser, updateUserDataForUser } from "@/lib/userDataStore";

export const runtime = "nodejs";

const WATCHLIST_ALERT_SCHEMA = z.object({
  url: z.string().min(1, "URL is required."),
  previousGrade: z.string().regex(/^[A-F]$/i, "Previous grade must be between A and F."),
  currentGrade: z.string().regex(/^[A-F]$/i, "Current grade must be between A and F."),
  checkedAt: z.string().datetime({ message: "checkedAt must be an ISO timestamp." })
});

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  const userKey = getUserKeyFromSessionUser(session?.user);
  const rateLimitResult = enforceApiRateLimit({
    request,
    route: "watchlist-notifications:post",
    identity: {
      isAuthenticated: Boolean(userKey),
      userKey
    }
  });
  if (!rateLimitResult.ok) {
    return rateLimitResult.response;
  }
  const respond = (body: unknown, init?: ResponseInit) =>
    withApiRateLimitHeaders(NextResponse.json(body, init), rateLimitResult.state);

  if (!userKey) {
    return respond({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as unknown;
  const parsed = WATCHLIST_ALERT_SCHEMA.safeParse(body);
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0];
    return respond(
      { error: firstIssue?.message ?? "Invalid watchlist notification payload." },
      { status: 400 }
    );
  }

  let normalizedUrl: string;
  try {
    normalizedUrl = normalizeTargetUrl(parsed.data.url);
  } catch (error) {
    return respond(
      {
        error: error instanceof Error ? error.message : "Please enter a valid URL."
      },
      { status: 400 }
    );
  }

  const userData = await getUserDataForUser(userKey);
  if (!userData.notificationOnGradeChange) {
    return respond({ sent: false, reason: "notifications_disabled" });
  }
  if (!userData.alertEmail) {
    return respond({ sent: false, reason: "missing_alert_email" });
  }

  const frequency = userData.notificationFrequency;
  const throttleMs = getNotificationThrottleMs(frequency);
  const key = normalizedUrl.toLowerCase();
  const lastSentAt = userData.watchlistNotificationLog[key];

  if (throttleMs > 0 && typeof lastSentAt === "string") {
    const lastSentAtMs = new Date(lastSentAt).getTime();
    const now = Date.now();
    if (Number.isFinite(lastSentAtMs) && now - lastSentAtMs < throttleMs) {
      return respond({
        sent: false,
        reason: "frequency_throttled",
        nextEligibleAt: new Date(lastSentAtMs + throttleMs).toISOString()
      });
    }
  }

  if (!process.env.RESEND_API_KEY) {
    return respond(
      {
        error: "Email notifications are not configured on the server."
      },
      { status: 503 }
    );
  }

  try {
    await sendGradeChangeEmail({
      toEmail: userData.alertEmail,
      url: normalizedUrl,
      previousGrade: parsed.data.previousGrade.toUpperCase(),
      currentGrade: parsed.data.currentGrade.toUpperCase(),
      checkedAt: parsed.data.checkedAt,
      frequency
    });

    const nextLog = {
      ...userData.watchlistNotificationLog,
      [key]: new Date().toISOString()
    };
    await updateUserDataForUser(userKey, { watchlistNotificationLog: nextLog });

    return respond({ sent: true, reason: "email_sent" });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to send watchlist notification email.";
    return respond({ error: message }, { status: 502 });
  }
}

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { sendWatchlistGradeChangeEmail } from "@/lib/emailNotifications";
import { normalizeTargetUrl } from "@/lib/securityReport";
import { getUserDataForUser, getUserKeyFromSessionUser, updateUserDataForUser } from "@/lib/userDataStore";

export const runtime = "nodejs";

const WATCHLIST_ALERT_SCHEMA = z.object({
  url: z.string().min(1, "URL is required."),
  previousGrade: z.string().regex(/^[A-F]$/i, "Previous grade must be between A and F."),
  currentGrade: z.string().regex(/^[A-F]$/i, "Current grade must be between A and F."),
  checkedAt: z.string().datetime({ message: "checkedAt must be an ISO timestamp." })
});

const THROTTLE_BY_FREQUENCY_MS = {
  instant: 0,
  daily: 1000 * 60 * 60 * 24,
  weekly: 1000 * 60 * 60 * 24 * 7
} as const;

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  const userKey = getUserKeyFromSessionUser(session?.user);
  if (!userKey) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as unknown;
  const parsed = WATCHLIST_ALERT_SCHEMA.safeParse(body);
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0];
    return NextResponse.json(
      { error: firstIssue?.message ?? "Invalid watchlist notification payload." },
      { status: 400 }
    );
  }

  let normalizedUrl: string;
  try {
    normalizedUrl = normalizeTargetUrl(parsed.data.url);
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Please enter a valid URL."
      },
      { status: 400 }
    );
  }

  const userData = await getUserDataForUser(userKey);
  if (!userData.notificationOnGradeChange) {
    return NextResponse.json({ sent: false, reason: "notifications_disabled" });
  }
  if (!userData.alertEmail) {
    return NextResponse.json({ sent: false, reason: "missing_alert_email" });
  }

  const frequency = userData.notificationFrequency;
  const throttleMs = THROTTLE_BY_FREQUENCY_MS[frequency] ?? 0;
  const key = normalizedUrl.toLowerCase();
  const lastSentAt = userData.watchlistNotificationLog[key];

  if (throttleMs > 0 && typeof lastSentAt === "string") {
    const lastSentAtMs = new Date(lastSentAt).getTime();
    const now = Date.now();
    if (Number.isFinite(lastSentAtMs) && now - lastSentAtMs < throttleMs) {
      return NextResponse.json({
        sent: false,
        reason: "frequency_throttled",
        nextEligibleAt: new Date(lastSentAtMs + throttleMs).toISOString()
      });
    }
  }

  if (!process.env.RESEND_API_KEY) {
    return NextResponse.json(
      {
        error: "Email notifications are not configured on the server."
      },
      { status: 503 }
    );
  }

  try {
    await sendWatchlistGradeChangeEmail({
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

    return NextResponse.json({ sent: true, reason: "email_sent" });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to send watchlist notification email.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

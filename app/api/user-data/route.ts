import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  deleteUserDataForUser,
  getUserDataForUser,
  getUserKeyFromSessionUser,
  updateUserDataForUser
} from "@/lib/userDataStore";
import {
  isNotificationFrequency,
  normalizeScanHistoryEntries,
  normalizeWatchlistEntries,
  normalizeWatchlistNotificationLog
} from "@/lib/userData";

export const runtime = "nodejs";

export async function GET() {
  const session = await getServerSession(authOptions);
  const userKey = getUserKeyFromSessionUser(session?.user);
  if (!userKey) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const data = await getUserDataForUser(userKey);
  return NextResponse.json(data);
}

export async function PUT(request: Request) {
  const session = await getServerSession(authOptions);
  const userKey = getUserKeyFromSessionUser(session?.user);
  if (!userKey) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as
    | {
        watchlist?: unknown;
        scanHistory?: unknown;
        alertEmail?: unknown;
        notificationOnGradeChange?: unknown;
        notificationFrequency?: unknown;
        watchlistNotificationLog?: unknown;
      }
    | null;

  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request payload." }, { status: 400 });
  }

  const patch: {
    watchlist?: ReturnType<typeof normalizeWatchlistEntries>;
    scanHistory?: ReturnType<typeof normalizeScanHistoryEntries>;
    alertEmail?: string | null;
    notificationOnGradeChange?: boolean;
    notificationFrequency?: "instant" | "daily" | "weekly";
    watchlistNotificationLog?: Record<string, string>;
  } = {};

  if (body.watchlist !== undefined && !Array.isArray(body.watchlist)) {
    return NextResponse.json(
      { error: 'Invalid "watchlist". Expected an array of watchlist entries.' },
      { status: 400 }
    );
  }
  if (Array.isArray(body.watchlist)) {
    patch.watchlist = normalizeWatchlistEntries(body.watchlist);
  }

  if (body.scanHistory !== undefined && !Array.isArray(body.scanHistory)) {
    return NextResponse.json(
      { error: 'Invalid "scanHistory". Expected an array of scan history entries.' },
      { status: 400 }
    );
  }
  if (Array.isArray(body.scanHistory)) {
    patch.scanHistory = normalizeScanHistoryEntries(body.scanHistory);
  }

  if (body.alertEmail !== undefined && body.alertEmail !== null && typeof body.alertEmail !== "string") {
    return NextResponse.json(
      { error: 'Invalid "alertEmail". Expected a string email address or null.' },
      { status: 400 }
    );
  }
  if (body.alertEmail === null || typeof body.alertEmail === "string") {
    patch.alertEmail = body.alertEmail;
  }

  if (
    body.notificationOnGradeChange !== undefined &&
    typeof body.notificationOnGradeChange !== "boolean"
  ) {
    return NextResponse.json(
      { error: 'Invalid "notificationOnGradeChange". Expected true or false.' },
      { status: 400 }
    );
  }
  if (typeof body.notificationOnGradeChange === "boolean") {
    patch.notificationOnGradeChange = body.notificationOnGradeChange;
  }

  if (body.notificationFrequency !== undefined) {
    if (!isNotificationFrequency(body.notificationFrequency)) {
      return NextResponse.json(
        {
          error:
            'Invalid "notificationFrequency". Use one of: instant, daily, weekly.'
        },
        { status: 400 }
      );
    }
    patch.notificationFrequency = body.notificationFrequency;
  }

  if (body.watchlistNotificationLog !== undefined) {
    if (!body.watchlistNotificationLog || typeof body.watchlistNotificationLog !== "object") {
      return NextResponse.json(
        {
          error: 'Invalid "watchlistNotificationLog". Expected a URL-to-timestamp object.'
        },
        { status: 400 }
      );
    }
    patch.watchlistNotificationLog = normalizeWatchlistNotificationLog(body.watchlistNotificationLog);
  }

  const saved = await updateUserDataForUser(userKey, patch);
  return NextResponse.json(saved);
}

export async function DELETE() {
  const session = await getServerSession(authOptions);
  const userKey = getUserKeyFromSessionUser(session?.user);
  if (!userKey) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await deleteUserDataForUser(userKey);
  return NextResponse.json({ success: true });
}

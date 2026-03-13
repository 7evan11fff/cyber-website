import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  deleteUserDataForUser,
  getUserDataForUser,
  getUserKeyFromSessionUser,
  updateUserDataForUser
} from "@/lib/userDataStore";
import { normalizeScanHistoryEntries, normalizeWatchlistEntries } from "@/lib/userData";

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
  } = {};

  if (Array.isArray(body.watchlist)) {
    patch.watchlist = normalizeWatchlistEntries(body.watchlist);
  }

  if (Array.isArray(body.scanHistory)) {
    patch.scanHistory = normalizeScanHistoryEntries(body.scanHistory);
  }

  if (body.alertEmail === null || typeof body.alertEmail === "string") {
    patch.alertEmail = body.alertEmail;
  }

  if (typeof body.notificationOnGradeChange === "boolean") {
    patch.notificationOnGradeChange = body.notificationOnGradeChange;
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

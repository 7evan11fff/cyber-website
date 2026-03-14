import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { enforceApiRateLimit, withApiRateLimitHeaders } from "@/lib/apiRateLimit";
import { authOptions } from "@/lib/auth";
import {
  deleteUserDataForUser,
  getUserDataForUser,
  getUserKeyFromSessionUser,
  updateUserDataForUser
} from "@/lib/userDataStore";
import {
  isApiKey,
  normalizeComparisonHistoryEntries,
  isNotificationFrequency,
  normalizeDomainGradeHistory,
  normalizeScanHistoryEntries,
  normalizeWebhookRegistrations,
  normalizeWatchlistEntries,
  normalizeWatchlistNotificationLog
} from "@/lib/userData";

export const runtime = "nodejs";

function createResponder(request: Request, route: string, userKey: string | null) {
  const rateLimitResult = enforceApiRateLimit({
    request,
    route,
    identity: {
      isAuthenticated: Boolean(userKey),
      userKey
    }
  });
  if (!rateLimitResult.ok) {
    return { blocked: rateLimitResult.response, respond: null };
  }

  return {
    blocked: null,
    respond: (body: unknown, init?: ResponseInit) =>
      withApiRateLimitHeaders(NextResponse.json(body, init), rateLimitResult.state)
  };
}

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  const userKey = getUserKeyFromSessionUser(session?.user);
  const { blocked, respond } = createResponder(request, "user-data:get", userKey);
  if (blocked) return blocked;
  if (!userKey) {
    return respond!({ error: "Unauthorized" }, { status: 401 });
  }

  const data = await getUserDataForUser(userKey);
  return respond!(data);
}

export async function PUT(request: Request) {
  const session = await getServerSession(authOptions);
  const userKey = getUserKeyFromSessionUser(session?.user);
  const { blocked, respond } = createResponder(request, "user-data:put", userKey);
  if (blocked) return blocked;
  if (!userKey) {
    return respond!({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as
    | {
        watchlist?: unknown;
        scanHistory?: unknown;
        comparisonHistory?: unknown;
        history?: unknown;
        alertEmail?: unknown;
        notificationOnGradeChange?: unknown;
        notificationFrequency?: unknown;
        browserNotificationsEnabled?: unknown;
        watchlistNotificationLog?: unknown;
        webhooks?: unknown;
        apiKey?: unknown;
      }
    | null;

  if (!body || typeof body !== "object") {
    return respond!({ error: "Invalid request payload." }, { status: 400 });
  }

  const patch: {
    watchlist?: ReturnType<typeof normalizeWatchlistEntries>;
    scanHistory?: ReturnType<typeof normalizeScanHistoryEntries>;
    comparisonHistory?: ReturnType<typeof normalizeComparisonHistoryEntries>;
    history?: ReturnType<typeof normalizeDomainGradeHistory>;
    alertEmail?: string | null;
    notificationOnGradeChange?: boolean;
    notificationFrequency?: "instant" | "daily" | "weekly";
    browserNotificationsEnabled?: boolean;
    watchlistNotificationLog?: Record<string, string>;
    webhooks?: ReturnType<typeof normalizeWebhookRegistrations>;
    apiKey?: string | null;
  } = {};

  if (body.watchlist !== undefined && !Array.isArray(body.watchlist)) {
    return respond!(
      { error: 'Invalid "watchlist". Expected an array of watchlist entries.' },
      { status: 400 }
    );
  }
  if (Array.isArray(body.watchlist)) {
    patch.watchlist = normalizeWatchlistEntries(body.watchlist);
  }

  if (body.scanHistory !== undefined && !Array.isArray(body.scanHistory)) {
    return respond!(
      { error: 'Invalid "scanHistory". Expected an array of scan history entries.' },
      { status: 400 }
    );
  }
  if (Array.isArray(body.scanHistory)) {
    patch.scanHistory = normalizeScanHistoryEntries(body.scanHistory);
  }

  if (body.comparisonHistory !== undefined && !Array.isArray(body.comparisonHistory)) {
    return respond!(
      { error: 'Invalid "comparisonHistory". Expected an array of comparison history entries.' },
      { status: 400 }
    );
  }
  if (Array.isArray(body.comparisonHistory)) {
    patch.comparisonHistory = normalizeComparisonHistoryEntries(body.comparisonHistory);
  }

  if (body.history !== undefined) {
    if (!body.history || typeof body.history !== "object" || Array.isArray(body.history)) {
      return respond!(
        { error: 'Invalid "history". Expected a domain-to-history object.' },
        { status: 400 }
      );
    }
    patch.history = normalizeDomainGradeHistory(body.history);
  }

  if (body.alertEmail !== undefined && body.alertEmail !== null && typeof body.alertEmail !== "string") {
    return respond!(
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
    return respond!(
      { error: 'Invalid "notificationOnGradeChange". Expected true or false.' },
      { status: 400 }
    );
  }
  if (typeof body.notificationOnGradeChange === "boolean") {
    patch.notificationOnGradeChange = body.notificationOnGradeChange;
  }

  if (body.notificationFrequency !== undefined) {
    if (!isNotificationFrequency(body.notificationFrequency)) {
      return respond!(
        {
          error:
            'Invalid "notificationFrequency". Use one of: instant, daily, weekly.'
        },
        { status: 400 }
      );
    }
    patch.notificationFrequency = body.notificationFrequency;
  }

  if (
    body.browserNotificationsEnabled !== undefined &&
    typeof body.browserNotificationsEnabled !== "boolean"
  ) {
    return respond!(
      { error: 'Invalid "browserNotificationsEnabled". Expected true or false.' },
      { status: 400 }
    );
  }
  if (typeof body.browserNotificationsEnabled === "boolean") {
    patch.browserNotificationsEnabled = body.browserNotificationsEnabled;
  }

  if (body.watchlistNotificationLog !== undefined) {
    if (!body.watchlistNotificationLog || typeof body.watchlistNotificationLog !== "object") {
      return respond!(
        {
          error: 'Invalid "watchlistNotificationLog". Expected a URL-to-timestamp object.'
        },
        { status: 400 }
      );
    }
    patch.watchlistNotificationLog = normalizeWatchlistNotificationLog(body.watchlistNotificationLog);
  }

  if (body.webhooks !== undefined) {
    if (!Array.isArray(body.webhooks)) {
      return respond!(
        { error: 'Invalid "webhooks". Expected an array of webhook records.' },
        { status: 400 }
      );
    }
    patch.webhooks = normalizeWebhookRegistrations(body.webhooks);
  }

  if (body.apiKey !== undefined && body.apiKey !== null && typeof body.apiKey !== "string") {
    return respond!(
      { error: 'Invalid "apiKey". Expected a valid API key string or null.' },
      { status: 400 }
    );
  }
  if (typeof body.apiKey === "string" && !isApiKey(body.apiKey)) {
    return respond!(
      { error: 'Invalid "apiKey". Expected a key formatted like shc_xxx.' },
      { status: 400 }
    );
  }
  if (body.apiKey === null || typeof body.apiKey === "string") {
    patch.apiKey = body.apiKey;
  }

  const saved = await updateUserDataForUser(userKey, patch);
  return respond!(saved);
}

export async function DELETE(request: Request) {
  const session = await getServerSession(authOptions);
  const userKey = getUserKeyFromSessionUser(session?.user);
  const { blocked, respond } = createResponder(request, "user-data:delete", userKey);
  if (blocked) return blocked;
  if (!userKey) {
    return respond!({ error: "Unauthorized" }, { status: 401 });
  }

  await deleteUserDataForUser(userKey);
  return respond!({ success: true });
}

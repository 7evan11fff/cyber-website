import { NextResponse } from "next/server";
import { enforceApiRateLimit, withApiRateLimitHeaders } from "@/lib/apiRateLimit";
import { runSecurityScan } from "@/lib/securityReport";
import { hasTeamAccess } from "@/lib/teamAccess";
import {
  addOrUpdateTeamWatchlistEntryBySlug,
  listTeamWatchlistBySlugForUser,
  removeTeamWatchlistEntryBySlug
} from "@/lib/teamDataStore";
import { resolveTeamRequestIdentity } from "@/lib/teamRequestIdentity";

export const runtime = "nodejs";

function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

function forbidden() {
  return NextResponse.json({ error: "Team features are not available for this account." }, { status: 403 });
}

function mapAccessError(error: unknown) {
  const message = error instanceof Error ? error.message : "Forbidden.";
  if (message === "Forbidden.") return 403;
  if (message === "Team not found.") return 404;
  return 400;
}

export async function GET(_request: Request, { params }: { params: { slug: string } }) {
  const identity = await resolveTeamRequestIdentity(_request);
  const rateLimit = enforceApiRateLimit({
    request: _request,
    route: "teams.slug.watchlist",
    identity: {
      isAuthenticated: Boolean(identity.userKey),
      userKey: identity.userKey
    }
  });
  if (!rateLimit.ok) {
    return rateLimit.response;
  }

  const userKey = identity.userKey;
  if (!userKey) {
    return withApiRateLimitHeaders(unauthorized(), rateLimit.state);
  }
  if (!hasTeamAccess(identity.sessionUser)) {
    return withApiRateLimitHeaders(forbidden(), rateLimit.state);
  }

  try {
    const watchlist = await listTeamWatchlistBySlugForUser({
      slug: params.slug,
      userId: userKey
    });
    return withApiRateLimitHeaders(NextResponse.json({ watchlist }), rateLimit.state);
  } catch (error) {
    return withApiRateLimitHeaders(
      NextResponse.json({ error: "Team not found." }, { status: mapAccessError(error) }),
      rateLimit.state
    );
  }
}

export async function POST(request: Request, { params }: { params: { slug: string } }) {
  const identity = await resolveTeamRequestIdentity(request);
  const rateLimit = enforceApiRateLimit({
    request,
    route: "teams.slug.watchlist",
    identity: {
      isAuthenticated: Boolean(identity.userKey),
      userKey: identity.userKey
    }
  });
  if (!rateLimit.ok) {
    return rateLimit.response;
  }

  const userKey = identity.userKey;
  if (!userKey) {
    return withApiRateLimitHeaders(unauthorized(), rateLimit.state);
  }
  if (!hasTeamAccess(identity.sessionUser)) {
    return withApiRateLimitHeaders(forbidden(), rateLimit.state);
  }

  const body = (await request.json().catch(() => null)) as { url?: unknown } | null;
  const url = typeof body?.url === "string" ? body.url : "";
  if (!url.trim()) {
    return withApiRateLimitHeaders(NextResponse.json({ error: "URL is required." }, { status: 400 }), rateLimit.state);
  }

  try {
    const report = await runSecurityScan(url);
    const { entry, activity } = await addOrUpdateTeamWatchlistEntryBySlug({
      slug: params.slug,
      actorUserId: userKey,
      url: report.checkedUrl,
      grade: report.grade,
      checkedAt: report.checkedAt
    });
    return withApiRateLimitHeaders(NextResponse.json({ entry, activity }, { status: 201 }), rateLimit.state);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not save watchlist entry.";
    return withApiRateLimitHeaders(NextResponse.json({ error: message }, { status: mapAccessError(error) }), rateLimit.state);
  }
}

export async function PATCH(request: Request, { params }: { params: { slug: string } }) {
  const identity = await resolveTeamRequestIdentity(request);
  const rateLimit = enforceApiRateLimit({
    request,
    route: "teams.slug.watchlist",
    identity: {
      isAuthenticated: Boolean(identity.userKey),
      userKey: identity.userKey
    }
  });
  if (!rateLimit.ok) {
    return rateLimit.response;
  }

  const userKey = identity.userKey;
  if (!userKey) {
    return withApiRateLimitHeaders(unauthorized(), rateLimit.state);
  }
  if (!hasTeamAccess(identity.sessionUser)) {
    return withApiRateLimitHeaders(forbidden(), rateLimit.state);
  }

  const body = (await request.json().catch(() => null)) as { entryId?: unknown } | null;
  const entryId = typeof body?.entryId === "string" ? body.entryId : null;

  try {
    const watchlist = await listTeamWatchlistBySlugForUser({
      slug: params.slug,
      userId: userKey
    });
    const targets = entryId ? watchlist.filter((entry) => entry.id === entryId) : watchlist;
    const updated = [];
    const activities = [];
    const errors: string[] = [];

    for (const entry of targets) {
      try {
        const report = await runSecurityScan(entry.url);
        const saved = await addOrUpdateTeamWatchlistEntryBySlug({
          slug: params.slug,
          actorUserId: userKey,
          url: report.checkedUrl,
          grade: report.grade,
          checkedAt: report.checkedAt
        });
        updated.push(saved.entry);
        activities.push(saved.activity);
      } catch (error) {
        if (errors.length < 20) {
          errors.push(
            `${entry.url}: ${error instanceof Error ? error.message : "Could not refresh this entry."}`
          );
        }
      }
    }

    return withApiRateLimitHeaders(NextResponse.json({ updated, activities, errors }), rateLimit.state);
  } catch (error) {
    return withApiRateLimitHeaders(
      NextResponse.json(
        { error: error instanceof Error ? error.message : "Could not refresh watchlist." },
        { status: mapAccessError(error) }
      ),
      rateLimit.state
    );
  }
}

export async function DELETE(request: Request, { params }: { params: { slug: string } }) {
  const identity = await resolveTeamRequestIdentity(request);
  const rateLimit = enforceApiRateLimit({
    request,
    route: "teams.slug.watchlist",
    identity: {
      isAuthenticated: Boolean(identity.userKey),
      userKey: identity.userKey
    }
  });
  if (!rateLimit.ok) {
    return rateLimit.response;
  }

  const userKey = identity.userKey;
  if (!userKey) {
    return withApiRateLimitHeaders(unauthorized(), rateLimit.state);
  }
  if (!hasTeamAccess(identity.sessionUser)) {
    return withApiRateLimitHeaders(forbidden(), rateLimit.state);
  }

  const body = (await request.json().catch(() => null)) as { entryId?: unknown } | null;
  const entryId = typeof body?.entryId === "string" ? body.entryId : "";
  if (!entryId.trim()) {
    return withApiRateLimitHeaders(NextResponse.json({ error: "entryId is required." }, { status: 400 }), rateLimit.state);
  }

  try {
    const removed = await removeTeamWatchlistEntryBySlug({
      slug: params.slug,
      actorUserId: userKey,
      entryId
    });
    return withApiRateLimitHeaders(NextResponse.json({ removed }), rateLimit.state);
  } catch (error) {
    return withApiRateLimitHeaders(
      NextResponse.json(
        { error: error instanceof Error ? error.message : "Could not remove watchlist entry." },
        { status: mapAccessError(error) }
      ),
      rateLimit.state
    );
  }
}

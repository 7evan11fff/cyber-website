import { NextResponse } from "next/server";
import { enforceApiRateLimit, withApiRateLimitHeaders } from "@/lib/apiRateLimit";
import { hasTeamAccess } from "@/lib/teamAccess";
import { deleteTeamBySlug, getTeamSnapshotBySlugForUser, leaveTeamBySlug, renameTeamBySlug } from "@/lib/teamDataStore";
import { resolveTeamRequestIdentity } from "@/lib/teamRequestIdentity";

export const runtime = "nodejs";

function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

function forbidden() {
  return NextResponse.json({ error: "Team features are not available for this account." }, { status: 403 });
}

export async function GET(request: Request, { params }: { params: { slug: string } }) {
  const identity = await resolveTeamRequestIdentity(request);
  const rateLimit = enforceApiRateLimit({
    request,
    route: "teams.slug",
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

  const snapshot = await getTeamSnapshotBySlugForUser({
    slug: params.slug,
    userId: userKey,
    includeInvites: true
  });
  if (!snapshot) {
    return withApiRateLimitHeaders(NextResponse.json({ error: "Team not found." }, { status: 404 }), rateLimit.state);
  }
  return withApiRateLimitHeaders(NextResponse.json(snapshot), rateLimit.state);
}

export async function PATCH(request: Request, { params }: { params: { slug: string } }) {
  const identity = await resolveTeamRequestIdentity(request);
  const rateLimit = enforceApiRateLimit({
    request,
    route: "teams.slug",
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

  const body = (await request.json().catch(() => null)) as { name?: unknown } | null;
  const name = typeof body?.name === "string" ? body.name : "";
  if (!name.trim()) {
    return withApiRateLimitHeaders(NextResponse.json({ error: "Team name is required." }, { status: 400 }), rateLimit.state);
  }

  try {
    const team = await renameTeamBySlug({
      slug: params.slug,
      actorUserId: userKey,
      name
    });
    return withApiRateLimitHeaders(NextResponse.json({ team }), rateLimit.state);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not update team.";
    const status = message === "Forbidden." ? 403 : message === "Team not found." ? 404 : 400;
    return withApiRateLimitHeaders(NextResponse.json({ error: message }, { status }), rateLimit.state);
  }
}

export async function DELETE(request: Request, { params }: { params: { slug: string } }) {
  const identity = await resolveTeamRequestIdentity(request);
  const rateLimit = enforceApiRateLimit({
    request,
    route: "teams.slug",
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

  const body = (await request.json().catch(() => null)) as { action?: unknown } | null;
  const action = typeof body?.action === "string" ? body.action : "";
  if (action !== "leave" && action !== "delete") {
    return withApiRateLimitHeaders(
      NextResponse.json({ error: "action must be either 'leave' or 'delete'." }, { status: 400 }),
      rateLimit.state
    );
  }

  try {
    if (action === "leave") {
      const ok = await leaveTeamBySlug({
        slug: params.slug,
        actorUserId: userKey
      });
      return withApiRateLimitHeaders(NextResponse.json({ ok }), rateLimit.state);
    }

    const ok = await deleteTeamBySlug({
      slug: params.slug,
      actorUserId: userKey
    });
    return withApiRateLimitHeaders(NextResponse.json({ ok }), rateLimit.state);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not update team membership.";
    const status = message === "Forbidden." ? 403 : message === "Team not found." ? 404 : 400;
    return withApiRateLimitHeaders(NextResponse.json({ error: message }, { status }), rateLimit.state);
  }
}

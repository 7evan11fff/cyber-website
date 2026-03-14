import { NextResponse } from "next/server";
import { enforceApiRateLimit, withApiRateLimitHeaders } from "@/lib/apiRateLimit";
import { hasTeamAccess } from "@/lib/teamAccess";
import { getTeamSnapshotBySlugForUser, inviteUserToTeamBySlug } from "@/lib/teamDataStore";
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
    route: "teams.slug.invites",
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
  return withApiRateLimitHeaders(NextResponse.json({ invites: snapshot.invites }), rateLimit.state);
}

export async function POST(request: Request, { params }: { params: { slug: string } }) {
  const identity = await resolveTeamRequestIdentity(request);
  const rateLimit = enforceApiRateLimit({
    request,
    route: "teams.slug.invites",
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

  const body = (await request.json().catch(() => null)) as { email?: unknown; resend?: unknown } | null;
  const email = typeof body?.email === "string" ? body.email : "";
  const resend = body?.resend === true;
  if (!email.trim()) {
    return withApiRateLimitHeaders(NextResponse.json({ error: "Email is required." }, { status: 400 }), rateLimit.state);
  }

  try {
    const invite = await inviteUserToTeamBySlug({
      slug: params.slug,
      actorUserId: userKey,
      email,
      resend
    });
    const inviteLink = new URL(`/teams/invite/${invite.token}`, request.url).toString();
    return withApiRateLimitHeaders(NextResponse.json({ invite: { ...invite, inviteLink } }, { status: 201 }), rateLimit.state);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not create invite.";
    const status = message === "Forbidden." ? 403 : message === "Team not found." ? 404 : 400;
    return withApiRateLimitHeaders(NextResponse.json({ error: message }, { status }), rateLimit.state);
  }
}

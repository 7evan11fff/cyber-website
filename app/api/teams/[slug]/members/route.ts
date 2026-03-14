import { NextResponse } from "next/server";
import { enforceApiRateLimit, withApiRateLimitHeaders } from "@/lib/apiRateLimit";
import { hasTeamAccess } from "@/lib/teamAccess";
import { isTeamRole } from "@/lib/teamData";
import { removeTeamMemberBySlug, updateTeamMemberRoleBySlug } from "@/lib/teamDataStore";
import { resolveTeamRequestIdentity } from "@/lib/teamRequestIdentity";

export const runtime = "nodejs";

function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

function forbidden() {
  return NextResponse.json({ error: "Team features are not available for this account." }, { status: 403 });
}

export async function PATCH(request: Request, { params }: { params: { slug: string } }) {
  const identity = await resolveTeamRequestIdentity(request);
  const rateLimit = enforceApiRateLimit({
    request,
    route: "teams.slug.members",
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

  const body = (await request.json().catch(() => null)) as
    | {
        targetUserId?: unknown;
        role?: unknown;
      }
    | null;
  const targetUserId = typeof body?.targetUserId === "string" ? body.targetUserId : "";
  const role = body?.role;
  if (!targetUserId.trim()) {
    return withApiRateLimitHeaders(NextResponse.json({ error: "targetUserId is required." }, { status: 400 }), rateLimit.state);
  }
  if (!isTeamRole(role) || role === "owner") {
    return withApiRateLimitHeaders(NextResponse.json({ error: "Role must be admin or member." }, { status: 400 }), rateLimit.state);
  }

  try {
    const member = await updateTeamMemberRoleBySlug({
      slug: params.slug,
      actorUserId: userKey,
      targetUserId,
      role
    });
    return withApiRateLimitHeaders(NextResponse.json({ member }), rateLimit.state);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not update role.";
    const status = message === "Forbidden." ? 403 : message === "Team not found." ? 404 : 400;
    return withApiRateLimitHeaders(NextResponse.json({ error: message }, { status }), rateLimit.state);
  }
}

export async function DELETE(request: Request, { params }: { params: { slug: string } }) {
  const identity = await resolveTeamRequestIdentity(request);
  const rateLimit = enforceApiRateLimit({
    request,
    route: "teams.slug.members",
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

  const body = (await request.json().catch(() => null)) as { targetUserId?: unknown } | null;
  const targetUserId = typeof body?.targetUserId === "string" ? body.targetUserId : "";
  if (!targetUserId.trim()) {
    return withApiRateLimitHeaders(NextResponse.json({ error: "targetUserId is required." }, { status: 400 }), rateLimit.state);
  }

  try {
    const removed = await removeTeamMemberBySlug({
      slug: params.slug,
      actorUserId: userKey,
      targetUserId
    });
    return withApiRateLimitHeaders(NextResponse.json({ removed }), rateLimit.state);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not remove member.";
    const status = message === "Forbidden." ? 403 : message === "Team not found." ? 404 : 400;
    return withApiRateLimitHeaders(NextResponse.json({ error: message }, { status }), rateLimit.state);
  }
}

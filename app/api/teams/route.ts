import { NextResponse } from "next/server";
import { enforceApiRateLimit, withApiRateLimitHeaders } from "@/lib/apiRateLimit";
import { hasTeamAccess } from "@/lib/teamAccess";
import { createTeamForUser, listTeamsForUser } from "@/lib/teamDataStore";
import { resolveTeamRequestIdentity } from "@/lib/teamRequestIdentity";

export const runtime = "nodejs";

function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

function forbidden() {
  return NextResponse.json({ error: "Team features are not available for this account." }, { status: 403 });
}

export async function GET(request: Request) {
  const identity = await resolveTeamRequestIdentity(request);
  const rateLimit = enforceApiRateLimit({
    request,
    route: "teams",
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

  const teams = await listTeamsForUser(userKey);
  return withApiRateLimitHeaders(NextResponse.json({ teams }), rateLimit.state);
}

export async function POST(request: Request) {
  const identity = await resolveTeamRequestIdentity(request);
  const rateLimit = enforceApiRateLimit({
    request,
    route: "teams",
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
    const team = await createTeamForUser({ userId: userKey, name });
    return withApiRateLimitHeaders(NextResponse.json({ team }, { status: 201 }), rateLimit.state);
  } catch (error) {
    return withApiRateLimitHeaders(
      NextResponse.json({ error: error instanceof Error ? error.message : "Could not create team." }, { status: 400 }),
      rateLimit.state
    );
  }
}

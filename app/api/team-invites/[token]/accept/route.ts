import { NextResponse } from "next/server";
import { enforceApiRateLimit, withApiRateLimitHeaders } from "@/lib/apiRateLimit";
import { hasTeamAccess } from "@/lib/teamAccess";
import { acceptTeamInvite } from "@/lib/teamDataStore";
import { resolveTeamRequestIdentity } from "@/lib/teamRequestIdentity";

export const runtime = "nodejs";

function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

function forbidden() {
  return NextResponse.json({ error: "Team features are not available for this account." }, { status: 403 });
}

export async function POST(_request: Request, { params }: { params: { token: string } }) {
  const identity = await resolveTeamRequestIdentity(_request);
  const rateLimit = enforceApiRateLimit({
    request: _request,
    route: "team-invites.accept",
    identity: {
      isAuthenticated: Boolean(identity.userKey),
      userKey: identity.userKey
    }
  });
  if (!rateLimit.ok) {
    return rateLimit.response;
  }

  const userKey = identity.userKey;
  const userEmail = identity.userEmail;
  if (!userKey || !userEmail) {
    return withApiRateLimitHeaders(unauthorized(), rateLimit.state);
  }
  if (!hasTeamAccess(identity.sessionUser)) {
    return withApiRateLimitHeaders(forbidden(), rateLimit.state);
  }

  const result = await acceptTeamInvite({
    token: params.token,
    acceptingUserId: userKey,
    acceptingEmail: userEmail
  });
  if (!result.ok) {
    return withApiRateLimitHeaders(
      NextResponse.json(
        {
          error:
            result.reason === "expired"
              ? "This invite link has expired."
              : result.reason === "already_accepted"
                ? "This invite has already been accepted."
                : result.reason === "email_mismatch"
                  ? "This invite was sent to a different email address."
                  : "Invite not found."
        },
        { status: 400 }
      ),
      rateLimit.state
    );
  }

  return withApiRateLimitHeaders(NextResponse.json({ ok: true, teamSlug: result.teamSlug }), rateLimit.state);
}

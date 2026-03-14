import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { hasTeamAccess } from "@/lib/teamAccess";
import { acceptTeamInvite } from "@/lib/teamDataStore";
import { getUserKeyFromSessionUser } from "@/lib/userDataStore";

export const runtime = "nodejs";

function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

function forbidden() {
  return NextResponse.json({ error: "Team features are not available for this account." }, { status: 403 });
}

export async function POST(_request: Request, { params }: { params: { token: string } }) {
  const session = await getServerSession(authOptions);
  const userKey = getUserKeyFromSessionUser(session?.user);
  const userEmail = session?.user?.email?.trim().toLowerCase() ?? null;
  if (!userKey || !userEmail) {
    return unauthorized();
  }
  if (!hasTeamAccess(session?.user)) {
    return forbidden();
  }

  const result = await acceptTeamInvite({
    token: params.token,
    acceptingUserId: userKey,
    acceptingEmail: userEmail
  });
  if (!result.ok) {
    return NextResponse.json(
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
    );
  }

  return NextResponse.json({ ok: true, teamSlug: result.teamSlug });
}

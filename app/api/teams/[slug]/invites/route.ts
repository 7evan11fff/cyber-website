import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { hasTeamAccess } from "@/lib/teamAccess";
import { getTeamSnapshotBySlugForUser, inviteUserToTeamBySlug } from "@/lib/teamDataStore";
import { getUserKeyFromSessionUser } from "@/lib/userDataStore";

export const runtime = "nodejs";

function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

function forbidden() {
  return NextResponse.json({ error: "Team features are not available for this account." }, { status: 403 });
}

export async function GET(_request: Request, { params }: { params: { slug: string } }) {
  const session = await getServerSession(authOptions);
  const userKey = getUserKeyFromSessionUser(session?.user);
  if (!userKey) {
    return unauthorized();
  }
  if (!hasTeamAccess(session?.user)) {
    return forbidden();
  }

  const snapshot = await getTeamSnapshotBySlugForUser({
    slug: params.slug,
    userId: userKey,
    includeInvites: true
  });
  if (!snapshot) {
    return NextResponse.json({ error: "Team not found." }, { status: 404 });
  }
  return NextResponse.json({ invites: snapshot.invites });
}

export async function POST(request: Request, { params }: { params: { slug: string } }) {
  const session = await getServerSession(authOptions);
  const userKey = getUserKeyFromSessionUser(session?.user);
  if (!userKey) {
    return unauthorized();
  }
  if (!hasTeamAccess(session?.user)) {
    return forbidden();
  }

  const body = (await request.json().catch(() => null)) as { email?: unknown } | null;
  const email = typeof body?.email === "string" ? body.email : "";
  if (!email.trim()) {
    return NextResponse.json({ error: "Email is required." }, { status: 400 });
  }

  try {
    const invite = await inviteUserToTeamBySlug({
      slug: params.slug,
      actorUserId: userKey,
      email
    });
    const inviteLink = new URL(`/teams/invite/${invite.token}`, request.url).toString();
    return NextResponse.json({ invite: { ...invite, inviteLink } }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not create invite.";
    const status = message === "Forbidden." ? 403 : message === "Team not found." ? 404 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { hasTeamAccess } from "@/lib/teamAccess";
import { createTeamForUser, listTeamsForUser } from "@/lib/teamDataStore";
import { getUserKeyFromSessionUser } from "@/lib/userDataStore";

export const runtime = "nodejs";

function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

function forbidden() {
  return NextResponse.json({ error: "Team features are not available for this account." }, { status: 403 });
}

export async function GET() {
  const session = await getServerSession(authOptions);
  const userKey = getUserKeyFromSessionUser(session?.user);
  if (!userKey) {
    return unauthorized();
  }
  if (!hasTeamAccess(session?.user)) {
    return forbidden();
  }

  const teams = await listTeamsForUser(userKey);
  return NextResponse.json({ teams });
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  const userKey = getUserKeyFromSessionUser(session?.user);
  if (!userKey) {
    return unauthorized();
  }
  if (!hasTeamAccess(session?.user)) {
    return forbidden();
  }

  const body = (await request.json().catch(() => null)) as { name?: unknown } | null;
  const name = typeof body?.name === "string" ? body.name : "";
  if (!name.trim()) {
    return NextResponse.json({ error: "Team name is required." }, { status: 400 });
  }

  try {
    const team = await createTeamForUser({ userId: userKey, name });
    return NextResponse.json({ team }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not create team." },
      { status: 400 }
    );
  }
}

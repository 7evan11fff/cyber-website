import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { hasTeamAccess } from "@/lib/teamAccess";
import { isTeamRole } from "@/lib/teamData";
import { removeTeamMemberBySlug, updateTeamMemberRoleBySlug } from "@/lib/teamDataStore";
import { getUserKeyFromSessionUser } from "@/lib/userDataStore";

export const runtime = "nodejs";

function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

function forbidden() {
  return NextResponse.json({ error: "Team features are not available for this account." }, { status: 403 });
}

export async function PATCH(request: Request, { params }: { params: { slug: string } }) {
  const session = await getServerSession(authOptions);
  const userKey = getUserKeyFromSessionUser(session?.user);
  if (!userKey) {
    return unauthorized();
  }
  if (!hasTeamAccess(session?.user)) {
    return forbidden();
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
    return NextResponse.json({ error: "targetUserId is required." }, { status: 400 });
  }
  if (!isTeamRole(role) || role === "owner") {
    return NextResponse.json({ error: "Role must be admin or member." }, { status: 400 });
  }

  try {
    const member = await updateTeamMemberRoleBySlug({
      slug: params.slug,
      actorUserId: userKey,
      targetUserId,
      role
    });
    return NextResponse.json({ member });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not update role.";
    const status = message === "Forbidden." ? 403 : message === "Team not found." ? 404 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE(request: Request, { params }: { params: { slug: string } }) {
  const session = await getServerSession(authOptions);
  const userKey = getUserKeyFromSessionUser(session?.user);
  if (!userKey) {
    return unauthorized();
  }
  if (!hasTeamAccess(session?.user)) {
    return forbidden();
  }

  const body = (await request.json().catch(() => null)) as
    | {
        targetUserId?: unknown;
      }
    | null;
  const targetUserId = typeof body?.targetUserId === "string" ? body.targetUserId : "";
  if (!targetUserId.trim()) {
    return NextResponse.json({ error: "targetUserId is required." }, { status: 400 });
  }

  try {
    const removed = await removeTeamMemberBySlug({
      slug: params.slug,
      actorUserId: userKey,
      targetUserId
    });
    return NextResponse.json({ removed });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not remove member.";
    const status = message === "Forbidden." ? 403 : message === "Team not found." ? 404 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}

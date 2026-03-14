import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { runSecurityScan } from "@/lib/securityReport";
import { hasTeamAccess } from "@/lib/teamAccess";
import {
  addOrUpdateTeamWatchlistEntryBySlug,
  listTeamWatchlistBySlugForUser,
  removeTeamWatchlistEntryBySlug
} from "@/lib/teamDataStore";
import { getUserKeyFromSessionUser } from "@/lib/userDataStore";

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
  const session = await getServerSession(authOptions);
  const userKey = getUserKeyFromSessionUser(session?.user);
  if (!userKey) {
    return unauthorized();
  }
  if (!hasTeamAccess(session?.user)) {
    return forbidden();
  }

  try {
    const watchlist = await listTeamWatchlistBySlugForUser({
      slug: params.slug,
      userId: userKey
    });
    return NextResponse.json({ watchlist });
  } catch (error) {
    return NextResponse.json({ error: "Team not found." }, { status: mapAccessError(error) });
  }
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

  const body = (await request.json().catch(() => null)) as { url?: unknown } | null;
  const url = typeof body?.url === "string" ? body.url : "";
  if (!url.trim()) {
    return NextResponse.json({ error: "URL is required." }, { status: 400 });
  }

  try {
    const report = await runSecurityScan(url);
    const entry = await addOrUpdateTeamWatchlistEntryBySlug({
      slug: params.slug,
      actorUserId: userKey,
      url: report.checkedUrl,
      grade: report.grade,
      checkedAt: report.checkedAt,
      source: "add"
    });
    return NextResponse.json({ entry }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not save watchlist entry.";
    return NextResponse.json({ error: message }, { status: mapAccessError(error) });
  }
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

  const body = (await request.json().catch(() => null)) as { entryId?: unknown } | null;
  const entryId = typeof body?.entryId === "string" ? body.entryId : null;

  try {
    const watchlist = await listTeamWatchlistBySlugForUser({
      slug: params.slug,
      userId: userKey
    });
    const targets = entryId ? watchlist.filter((entry) => entry.id === entryId) : watchlist;
    const updated = [];
    const errors: string[] = [];

    for (const entry of targets) {
      try {
        const report = await runSecurityScan(entry.url);
        const saved = await addOrUpdateTeamWatchlistEntryBySlug({
          slug: params.slug,
          actorUserId: userKey,
          url: report.checkedUrl,
          grade: report.grade,
          checkedAt: report.checkedAt,
          source: "scan"
        });
        updated.push(saved);
      } catch (error) {
        if (errors.length < 20) {
          errors.push(
            `${entry.url}: ${error instanceof Error ? error.message : "Could not refresh this entry."}`
          );
        }
      }
    }

    return NextResponse.json({ updated, errors });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not refresh watchlist." },
      { status: mapAccessError(error) }
    );
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

  const body = (await request.json().catch(() => null)) as { entryId?: unknown } | null;
  const entryId = typeof body?.entryId === "string" ? body.entryId : "";
  if (!entryId.trim()) {
    return NextResponse.json({ error: "entryId is required." }, { status: 400 });
  }

  try {
    const removed = await removeTeamWatchlistEntryBySlug({
      slug: params.slug,
      actorUserId: userKey,
      entryId
    });
    return NextResponse.json({ removed });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not remove watchlist entry." },
      { status: mapAccessError(error) }
    );
  }
}

import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getServerSession } from "next-auth";
import { SiteNav } from "@/app/components/SiteNav";
import { TeamDashboardClient } from "@/app/components/TeamDashboardClient";
import { authOptions } from "@/lib/auth";
import { buildPageMetadata } from "@/lib/seo";
import { hasTeamAccess } from "@/lib/teamAccess";
import { getTeamSnapshotBySlugForUser } from "@/lib/teamDataStore";
import { getUserKeyFromSessionUser } from "@/lib/userDataStore";

export const metadata: Metadata = buildPageMetadata({
  title: "Team Dashboard",
  description: "Shared team watchlist and membership overview.",
  path: "/teams",
  robots: { index: false, follow: false, googleBot: { index: false, follow: false } }
});

export default async function TeamDashboardPage({ params }: { params: { slug: string } }) {
  const session = await getServerSession(authOptions);
  const userKey = getUserKeyFromSessionUser(session?.user);
  if (!session?.user || !userKey) {
    redirect(`/auth/signin?callbackUrl=/teams/${encodeURIComponent(params.slug)}`);
  }
  if (!hasTeamAccess(session.user)) {
    redirect("/pricing");
  }

  const snapshot = await getTeamSnapshotBySlugForUser({
    slug: params.slug,
    userId: userKey,
    includeInvites: false
  });
  if (!snapshot) {
    redirect("/teams");
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-4 py-10 sm:px-6 lg:px-8">
      <SiteNav />
      <section className="mb-6 rounded-2xl border border-sky-500/20 bg-gradient-to-br from-slate-900/90 via-slate-900/80 to-sky-950/40 p-6 shadow-2xl shadow-slate-950/70">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-300">Team watchlist</p>
        <h1 className="mt-2 text-2xl font-semibold text-slate-100 sm:text-3xl">{snapshot.team.name}</h1>
        <p className="mt-2 text-sm text-slate-300">
          Shared watchlist for {snapshot.members.length} members. Personal scans remain in{" "}
          <Link href="/dashboard" className="text-sky-300 transition hover:text-sky-200">
            My Watchlist
          </Link>
          .
        </p>
      </section>

      <TeamDashboardClient slug={params.slug} initialSnapshot={snapshot} />

      <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <Link
          href="/teams"
          className="inline-flex justify-center rounded-lg border border-slate-700 px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-300 transition hover:border-sky-500/60 hover:text-sky-200"
        >
          Back to teams
        </Link>
        <Link
          href={`/teams/${params.slug}/settings`}
          className="inline-flex justify-center rounded-lg border border-slate-700 px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-300 transition hover:border-sky-500/60 hover:text-sky-200"
        >
          Team settings
        </Link>
      </div>
    </main>
  );
}

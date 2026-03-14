import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getServerSession } from "next-auth";
import { SiteNav } from "@/app/components/SiteNav";
import { TeamsPageClient } from "@/app/components/TeamsPageClient";
import { authOptions } from "@/lib/auth";
import { buildPageMetadata } from "@/lib/seo";
import { hasTeamAccess } from "@/lib/teamAccess";
import { listTeamsForUser } from "@/lib/teamDataStore";
import { getUserKeyFromSessionUser } from "@/lib/userDataStore";

export const metadata: Metadata = buildPageMetadata({
  title: "Teams",
  description: "Create and manage team workspaces with shared watchlists.",
  path: "/teams",
  robots: { index: false, follow: false, googleBot: { index: false, follow: false } }
});

export default async function TeamsPage() {
  const session = await getServerSession(authOptions);
  const userKey = getUserKeyFromSessionUser(session?.user);
  if (!session?.user || !userKey) {
    redirect("/auth/signin?callbackUrl=/teams");
  }
  if (!hasTeamAccess(session.user)) {
    redirect("/pricing");
  }

  const teams = await listTeamsForUser(userKey);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col px-4 py-10 sm:px-6 lg:px-8">
      <SiteNav />
      <section className="mb-6 rounded-2xl border border-sky-500/20 bg-gradient-to-br from-slate-900/90 via-slate-900/80 to-sky-950/40 p-4 sm:p-6 shadow-2xl shadow-slate-950/70">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-300">Teams</p>
        <h1 className="mt-2 text-3xl font-semibold text-slate-100">Team collaboration workspace</h1>
        <p className="mt-2 text-sm text-slate-300">
          Create a team, invite collaborators, and manage shared watchlists. Your personal watchlist remains available
          in the dashboard.
        </p>
      </section>

      <TeamsPageClient initialTeams={teams} />

      <Link
        href="/dashboard"
        className="mt-6 inline-flex w-fit rounded-lg border border-slate-700 px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-300 transition hover:border-sky-500/60 hover:text-sky-200"
      >
        Back to dashboard
      </Link>
    </main>
  );
}

import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getServerSession } from "next-auth";
import { SiteNav } from "@/app/components/SiteNav";
import { TeamSettingsClient } from "@/app/components/TeamSettingsClient";
import { authOptions } from "@/lib/auth";
import { buildPageMetadata } from "@/lib/seo";
import { hasTeamAccess } from "@/lib/teamAccess";
import { getTeamSnapshotBySlugForUser } from "@/lib/teamDataStore";
import { getUserKeyFromSessionUser } from "@/lib/userDataStore";

export const metadata: Metadata = buildPageMetadata({
  title: "Team Settings",
  description: "Manage team members, invites, and team name.",
  path: "/teams",
  robots: { index: false, follow: false, googleBot: { index: false, follow: false } }
});

export default async function TeamSettingsPage({ params }: { params: { slug: string } }) {
  const session = await getServerSession(authOptions);
  const userKey = getUserKeyFromSessionUser(session?.user);
  if (!session?.user || !userKey) {
    redirect(`/auth/signin?callbackUrl=/teams/${encodeURIComponent(params.slug)}/settings`);
  }
  if (!hasTeamAccess(session.user)) {
    redirect("/pricing");
  }

  const snapshot = await getTeamSnapshotBySlugForUser({
    slug: params.slug,
    userId: userKey,
    includeInvites: true
  });
  if (!snapshot) {
    redirect("/teams");
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-4 py-10 sm:px-6 lg:px-8">
      <SiteNav />
      <section className="mb-6 rounded-2xl border border-sky-500/20 bg-gradient-to-br from-slate-900/90 via-slate-900/80 to-sky-950/40 p-6 shadow-2xl shadow-slate-950/70">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-300">Team settings</p>
        <h1 className="mt-2 text-3xl font-semibold text-slate-100">{snapshot.team.name}</h1>
        <p className="mt-2 text-sm text-slate-300">Manage team name, member roles, and invite links.</p>
      </section>

      <TeamSettingsClient slug={params.slug} initialSnapshot={snapshot} />

      <div className="mt-6 flex flex-wrap gap-2">
        <Link
          href={`/teams/${params.slug}`}
          className="inline-flex rounded-lg border border-slate-700 px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-300 transition hover:border-sky-500/60 hover:text-sky-200"
        >
          Back to team
        </Link>
        <Link
          href="/teams"
          className="inline-flex rounded-lg border border-slate-700 px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-300 transition hover:border-sky-500/60 hover:text-sky-200"
        >
          All teams
        </Link>
      </div>
    </main>
  );
}

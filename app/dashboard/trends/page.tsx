import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getServerSession } from "next-auth";
import { DashboardActions } from "@/app/components/DashboardActions";
import { SiteNav } from "@/app/components/SiteNav";
import { WatchlistTrendsTable } from "@/app/components/WatchlistTrendsTable";
import { authOptions } from "@/lib/auth";
import { buildPageMetadata } from "@/lib/seo";
import { getUserDataForUser, getUserKeyFromSessionUser } from "@/lib/userDataStore";
import { buildWatchlistTrendDashboardData } from "@/lib/watchlistTrends";

export const metadata: Metadata = buildPageMetadata({
  title: "Dashboard Trends",
  description: "Watchlist trend analytics with historical grades and change reporting.",
  path: "/dashboard/trends",
  robots: { index: false, follow: false, googleBot: { index: false, follow: false } }
});

function statTone(value: number, type: "improve" | "regress"): string {
  if (value === 0) {
    return "border-slate-700 bg-slate-900/80 text-slate-300";
  }
  if (type === "improve") {
    return "border-emerald-500/30 bg-emerald-500/10 text-emerald-300";
  }
  return "border-rose-500/30 bg-rose-500/10 text-rose-300";
}

export default async function DashboardTrendsPage() {
  const session = await getServerSession(authOptions);
  const userKey = getUserKeyFromSessionUser(session?.user);
  if (!session?.user || !userKey) {
    redirect("/auth/signin?callbackUrl=/dashboard/trends");
  }

  const userData = await getUserDataForUser(userKey);
  const trendData = buildWatchlistTrendDashboardData(userData);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-4 py-10 sm:px-6 lg:px-8">
      <SiteNav />

      <section className="mb-6 rounded-2xl border border-sky-500/20 bg-gradient-to-br from-slate-900/90 via-slate-900/80 to-sky-950/40 p-6 shadow-2xl shadow-slate-950/70">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-300">Dashboard trends</p>
        <h1 className="mt-2 text-2xl font-semibold text-slate-100 sm:text-3xl">Watchlist trend insights</h1>
        <p className="mt-2 text-sm text-slate-300">
          Monitor grade movements over time, surface regressions, and export trend snapshots for reporting.
        </p>
        <p className="mt-2 text-sm text-slate-300">
          Signed in as <span className="font-medium text-slate-100">{session.user.email ?? session.user.name}</span>
        </p>
        <DashboardActions />
      </section>

      <section className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <article className="rounded-xl border border-slate-800/90 bg-slate-900/70 p-4 shadow-lg shadow-slate-950/60">
          <p className="text-xs uppercase tracking-[0.14em] text-slate-500">Total domains monitored</p>
          <p className="mt-2 text-2xl font-semibold text-slate-100">{trendData.aggregate.totalDomainsMonitored}</p>
        </article>
        <article className="rounded-xl border border-slate-800/90 bg-slate-900/70 p-4 shadow-lg shadow-slate-950/60">
          <p className="text-xs uppercase tracking-[0.14em] text-slate-500">Average grade</p>
          <p className="mt-2 text-2xl font-semibold text-slate-100">
            {trendData.aggregate.averageGrade}
            {trendData.aggregate.averageScore !== null ? (
              <span className="ml-2 text-sm font-normal text-slate-400">{`(${trendData.aggregate.averageScore.toFixed(2)}/5)`}</span>
            ) : null}
          </p>
        </article>
        <article
          className={`rounded-xl border p-4 shadow-lg shadow-slate-950/60 ${statTone(
            trendData.aggregate.improvedThisWeek,
            "improve"
          )}`}
        >
          <p className="text-xs uppercase tracking-[0.14em]">Improved this week</p>
          <p className="mt-2 text-2xl font-semibold">{trendData.aggregate.improvedThisWeek}</p>
        </article>
        <article
          className={`rounded-xl border p-4 shadow-lg shadow-slate-950/60 ${statTone(
            trendData.aggregate.regressedThisWeek,
            "regress"
          )}`}
        >
          <p className="text-xs uppercase tracking-[0.14em]">Regressed this week</p>
          <p className="mt-2 text-2xl font-semibold">{trendData.aggregate.regressedThisWeek}</p>
        </article>
      </section>

      <WatchlistTrendsTable aggregate={trendData.aggregate} domains={trendData.domains} />

      <div className="mt-6 flex flex-wrap gap-2">
        <Link
          href="/dashboard"
          className="inline-flex w-fit rounded-lg border border-slate-700 px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-300 transition hover:border-sky-500/60 hover:text-sky-200"
        >
          Back to dashboard
        </Link>
      </div>
    </main>
  );
}

import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getServerSession } from "next-auth";
import { DashboardActions } from "@/app/components/DashboardActions";
import { DashboardTabs } from "@/app/components/DashboardTabs";
import { DashboardTrendsClient } from "@/app/components/DashboardTrendsClient";
import { SiteNav } from "@/app/components/SiteNav";
import { authOptions } from "@/lib/auth";
import { buildPageMetadata } from "@/lib/seo";
import { getUserDataForUser, getUserKeyFromSessionUser } from "@/lib/userDataStore";

export const metadata: Metadata = buildPageMetadata({
  title: "Dashboard Trends",
  description: "Watchlist trends, grade history, and header-change timelines across monitored domains.",
  path: "/dashboard/trends",
  robots: { index: false, follow: false, googleBot: { index: false, follow: false } }
});

export default async function DashboardTrendsPage() {
  const session = await getServerSession(authOptions);
  const userKey = getUserKeyFromSessionUser(session?.user);
  if (!session?.user || !userKey) {
    redirect("/auth/signin?callbackUrl=/dashboard/trends");
  }

  const userData = await getUserDataForUser(userKey);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-4 py-10 sm:px-6 lg:px-8">
      <SiteNav />

      <section className="mb-6 rounded-2xl border border-sky-500/20 bg-gradient-to-br from-slate-900/90 via-slate-900/80 to-sky-950/40 p-6 shadow-2xl shadow-slate-950/70">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-300">Dashboard trends</p>
        <h1 className="mt-2 text-2xl font-semibold text-slate-100 sm:text-3xl">Watchlist trend analytics</h1>
        <p className="mt-2 text-sm text-slate-300">
          Signed in as <span className="font-medium text-slate-100">{session.user.email ?? session.user.name}</span>
        </p>
        <DashboardActions />
        <DashboardTabs active="trends" />
      </section>

      <DashboardTrendsClient
        initialWatchlist={userData.watchlist}
        initialScanHistory={userData.scanHistory}
        initialHistory={userData.history}
      />
    </main>
  );
}

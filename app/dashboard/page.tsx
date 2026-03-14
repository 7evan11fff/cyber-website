import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getServerSession } from "next-auth";
import { DashboardActions } from "@/app/components/DashboardActions";
import { SiteNav } from "@/app/components/SiteNav";
import { TrendChart } from "@/app/components/TrendChart";
import { authOptions } from "@/lib/auth";
import { getTrendDirection } from "@/lib/gradeTrends";
import { buildPageMetadata } from "@/lib/seo";
import { getDomainKeyFromUrl } from "@/lib/userData";
import { getUserDataForUser, getUserKeyFromSessionUser } from "@/lib/userDataStore";

export const metadata: Metadata = buildPageMetadata({
  title: "Dashboard",
  description: "Signed-in dashboard for watchlist monitoring and scan history.",
  path: "/dashboard",
  robots: { index: false, follow: false, googleBot: { index: false, follow: false } }
});

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  const userKey = getUserKeyFromSessionUser(session?.user);
  if (!session?.user || !userKey) {
    redirect("/auth/signin?callbackUrl=/dashboard");
  }

  const userData = await getUserDataForUser(userKey);

  const trendTone = {
    improving: {
      label: "Improving",
      className: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
      chartClass: "text-emerald-300"
    },
    degrading: {
      label: "Degrading",
      className: "border-rose-500/30 bg-rose-500/10 text-rose-300",
      chartClass: "text-rose-300"
    },
    stable: {
      label: "Stable",
      className: "border-slate-700 bg-slate-900/80 text-slate-300",
      chartClass: "text-slate-300"
    }
  } as const;

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-4 py-10 sm:px-6 lg:px-8">
      <SiteNav />

      <section className="mb-6 rounded-2xl border border-sky-500/20 bg-gradient-to-br from-slate-900/90 via-slate-900/80 to-sky-950/40 p-6 shadow-2xl shadow-slate-950/70">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-300">Dashboard</p>
        <h1 className="mt-2 text-2xl font-semibold text-slate-100 sm:text-3xl">Your security monitoring workspace</h1>
        <p className="mt-2 text-sm text-slate-300">
          Signed in as <span className="font-medium text-slate-100">{session.user.email ?? session.user.name}</span>
        </p>
        <DashboardActions />
      </section>

      <section className="lazy-section grid gap-6 lg:grid-cols-2">
        <article className="motion-card rounded-2xl border border-slate-800/90 bg-slate-900/70 p-5 shadow-xl shadow-slate-950/60">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-slate-100">Saved watchlist</h2>
            <span className="rounded-full border border-slate-700 px-2.5 py-1 text-xs text-slate-300">
              {userData.watchlist.length} items
            </span>
          </div>
          {userData.watchlist.length === 0 ? (
            <div className="mt-4 rounded-lg border border-sky-500/20 bg-sky-500/5 p-4">
              <div className="empty-state-float inline-flex rounded-lg border border-sky-500/30 bg-sky-500/10 p-2 text-sky-200">
                <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
                  <path
                    d="M4 6.8C4 5.8 4.8 5 5.8 5h12.4c1 0 1.8.8 1.8 1.8v10.4c0 1-.8 1.8-1.8 1.8H5.8c-1 0-1.8-.8-1.8-1.8V6.8Zm2 .2v10h12V7H6Zm2 2h8v2H8V9Zm0 4h6v2H8v-2Z"
                    fill="currentColor"
                  />
                </svg>
              </div>
              <p className="mt-2 text-sm text-slate-300">
                No watchlist items yet. Save scans from the scanner page to monitor grade changes.
              </p>
              <Link
                href="/"
                className="cta-attention mt-3 inline-flex rounded-md border border-slate-700 bg-slate-950/70 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-slate-200 transition hover:border-sky-500/60 hover:text-sky-200"
              >
                Open scanner
              </Link>
            </div>
          ) : (
            <ul className="mt-4 space-y-2">
              {userData.watchlist.map((entry) => {
                const domain = getDomainKeyFromUrl(entry.url);
                const history = domain ? (userData.history[domain] ?? []) : [];
                const tone = trendTone[getTrendDirection(history)];
                const historyHref = domain ? `/dashboard/history/${encodeURIComponent(domain)}` : null;

                return (
                  <li key={entry.id} className="motion-card rounded-lg border border-slate-800 bg-slate-950/60 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="min-w-0">
                        {historyHref ? (
                          <Link
                            href={historyHref}
                            className="truncate text-sm text-slate-100 transition hover:text-sky-200"
                          >
                            {entry.url}
                          </Link>
                        ) : (
                          <p className="truncate text-sm text-slate-100">{entry.url}</p>
                        )}
                        <p className="mt-1 text-xs text-slate-500">
                          Last checked {new Date(entry.lastCheckedAt).toLocaleString()}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-3">
                        <div className="w-20 sm:w-24">
                          <TrendChart
                            points={history}
                            className={`h-9 w-full ${tone.chartClass}`}
                            ariaLabel={`Recent grade trend for ${domain ?? entry.url}`}
                          />
                        </div>
                        <p className="grade-badge-in text-sm font-semibold text-sky-200">Grade {entry.lastGrade}</p>
                      </div>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <span className={`inline-flex rounded-md border px-2 py-1 text-xs ${tone.className}`}>
                        {tone.label}
                      </span>
                      <span className="text-xs text-slate-500">
                        {history.length > 0 ? `${Math.min(history.length, 30)} scans tracked` : "No trend data yet"}
                      </span>
                      {historyHref && (
                        <Link
                          href={historyHref}
                          className="text-xs font-medium text-sky-300 transition hover:text-sky-200"
                        >
                          View full history
                        </Link>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </article>

        <article className="motion-card rounded-2xl border border-slate-800/90 bg-slate-900/70 p-5 shadow-xl shadow-slate-950/60">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-slate-100">Scan history</h2>
            <span className="rounded-full border border-slate-700 px-2.5 py-1 text-xs text-slate-300">
              {userData.scanHistory.length} entries
            </span>
          </div>
          {userData.scanHistory.length === 0 ? (
            <div className="mt-4 rounded-lg border border-sky-500/20 bg-sky-500/5 p-4">
              <div className="empty-state-float inline-flex rounded-lg border border-sky-500/30 bg-sky-500/10 p-2 text-sky-200">
                <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
                  <path
                    d="M12 3 4 7v6c0 4.8 3.2 8.9 8 10 4.8-1.1 8-5.2 8-10V7l-8-4Zm0 2.2L18 8v5c0 3.8-2.4 7.1-6 8.2-3.6-1.1-6-4.4-6-8.2V8l6-2.8ZM8.5 11h7v2h-7v-2Zm0 3.4h5v2h-5v-2Z"
                    fill="currentColor"
                  />
                </svg>
              </div>
              <p className="mt-2 text-sm text-slate-300">
                No scans recorded yet. Run checks from the scanner to build your history.
              </p>
            </div>
          ) : (
            <ul className="mt-4 space-y-2">
              {userData.scanHistory.map((entry) => (
                <li key={entry.id} className="motion-card rounded-lg border border-slate-800 bg-slate-950/60 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="truncate text-sm text-slate-100">{entry.url}</p>
                    <p className="text-sm font-semibold text-sky-200">{entry.grade}</p>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    Scanned {new Date(entry.checkedAt).toLocaleString()}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </article>
      </section>

      <Link
        href="/"
        className="mt-6 inline-flex w-fit rounded-lg border border-slate-700 px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-300 transition hover:border-sky-500/60 hover:text-sky-200"
      >
        Back to scanner
      </Link>
    </main>
  );
}

import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import type { CSSProperties } from "react";
import { getServerSession } from "next-auth";
import { DashboardActions } from "@/app/components/DashboardActions";
import { DashboardTabs } from "@/app/components/DashboardTabs";
import { MiniScoreTrendChart } from "@/app/components/MiniScoreTrendChart";
import { ScanHistoryCsvDownloadButton } from "@/app/components/ScanHistoryCsvDownloadButton";
import { SiteNav } from "@/app/components/SiteNav";
import { TrendChart } from "@/app/components/TrendChart";
import { WatchlistTrendRangeChart } from "@/app/components/WatchlistTrendRangeChart";
import { WatchlistSchedulePanel } from "@/app/components/WatchlistSchedulePanel";
import { authOptions } from "@/lib/auth";
import { getTrendDirection, gradeToScore } from "@/lib/gradeTrends";
import { listRecentPublicScans } from "@/lib/sharedReportsStore";
import { buildPageMetadata } from "@/lib/seo";
import { getDomainKeyFromUrl, type DomainGradeHistoryRecord } from "@/lib/userData";
import { getUserDataForUser, getUserKeyFromSessionUser } from "@/lib/userDataStore";

export const metadata: Metadata = buildPageMetadata({
  title: "Dashboard",
  description: "Signed-in dashboard for watchlist monitoring and scan history.",
  path: "/dashboard",
  robots: { index: false, follow: false, googleBot: { index: false, follow: false } }
});

type DailyAveragePoint = {
  isoDate: string;
  label: string;
  value: number | null;
  sampleCount: number;
};

function extractHost(value: string): string {
  try {
    const withProtocol = /^https?:\/\//i.test(value) ? value : `https://${value}`;
    return new URL(withProtocol).hostname || value;
  } catch {
    return value;
  }
}

function anonymizeHost(value: string): string {
  const host = extractHost(value).toLowerCase();
  const labels = host.split(".").filter(Boolean);
  if (labels.length === 0) return "hidden-domain";
  const first = labels[0] ?? "site";
  const visiblePrefixLength = Math.min(2, first.length);
  const maskedLength = Math.max(2, Math.min(8, first.length - visiblePrefixLength));
  const maskedFirst = `${first.slice(0, visiblePrefixLength)}${"*".repeat(maskedLength)}`;
  return [maskedFirst, ...labels.slice(1)].join(".");
}

function buildSevenDayAverageTrend(history: DomainGradeHistoryRecord): DailyAveragePoint[] {
  const today = new Date();
  const dailyBuckets = new Map<string, number[]>();
  const dayOrder: Array<{ isoDate: string; label: string }> = [];

  for (let offset = 6; offset >= 0; offset -= 1) {
    const date = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - offset));
    const isoDate = date.toISOString().slice(0, 10);
    dayOrder.push({
      isoDate,
      label: date.toLocaleDateString(undefined, { weekday: "short" })
    });
    dailyBuckets.set(isoDate, []);
  }

  for (const points of Object.values(history)) {
    for (const point of points) {
      const timestamp = new Date(point.checkedAt).getTime();
      if (!Number.isFinite(timestamp)) continue;
      const dayKey = new Date(timestamp).toISOString().slice(0, 10);
      const bucket = dailyBuckets.get(dayKey);
      if (!bucket) continue;
      const score = gradeToScore(point.grade);
      if (score > 0) {
        bucket.push(score);
      }
    }
  }

  return dayOrder.map(({ isoDate, label }) => {
    const scores = dailyBuckets.get(isoDate) ?? [];
    if (scores.length === 0) {
      return { isoDate, label, value: null, sampleCount: 0 };
    }
    const average = scores.reduce((sum, score) => sum + score, 0) / scores.length;
    return {
      isoDate,
      label,
      value: Number(average.toFixed(2)),
      sampleCount: scores.length
    };
  });
}

function asStaggerStyle(delayMs: number): CSSProperties {
  return { "--stagger-delay": `${delayMs}ms` } as CSSProperties;
}

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  const userKey = getUserKeyFromSessionUser(session?.user);
  if (!session?.user || !userKey) {
    redirect("/auth/signin?callbackUrl=/dashboard");
  }

  const [userData, recentPublicScans] = await Promise.all([
    getUserDataForUser(userKey),
    listRecentPublicScans(5)
  ]);
  const sevenDayAverageTrend = buildSevenDayAverageTrend(userData.history);
  const latestAveragePoint = sevenDayAverageTrend[sevenDayAverageTrend.length - 1] ?? null;
  const previousAveragePoint = [...sevenDayAverageTrend]
    .slice(0, Math.max(0, sevenDayAverageTrend.length - 1))
    .reverse()
    .find((point) => point.value !== null);

  const trendDelta =
    latestAveragePoint &&
    latestAveragePoint.value !== null &&
    previousAveragePoint &&
    previousAveragePoint.value !== null
      ? Number((latestAveragePoint.value - previousAveragePoint.value).toFixed(2))
      : null;
  const trendDeltaLabel =
    trendDelta === null
      ? "Collecting baseline"
      : trendDelta > 0
        ? `+${trendDelta} vs previous active day`
        : trendDelta < 0
          ? `${trendDelta} vs previous active day`
          : "No change vs previous active day";
  const trendDeltaClassName =
    trendDelta === null
      ? "border-slate-700 bg-slate-900/80 text-slate-300"
      : trendDelta > 0
        ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
        : trendDelta < 0
          ? "border-rose-500/30 bg-rose-500/10 text-rose-300"
          : "border-slate-700 bg-slate-900/80 text-slate-300";

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
        <DashboardTabs active="overview" />
      </section>

      <section className="lazy-section grid gap-6 lg:grid-cols-2">
        <article
          className="motion-card stagger-card-enter rounded-2xl border border-slate-800/90 bg-slate-900/70 p-5 shadow-xl shadow-slate-950/60 lg:col-span-2"
          style={asStaggerStyle(0)}
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-slate-100">Watchlist historical trends</h2>
              <p className="mt-1 text-sm text-slate-400">
                Follow each monitored domain with 7d, 30d, and 90d grade trajectories.
              </p>
            </div>
            <span className="rounded-full border border-slate-700 px-2.5 py-1 text-xs text-slate-300">
              {userData.watchlist.length} monitored
            </span>
          </div>
          <WatchlistTrendRangeChart watchlist={userData.watchlist} history={userData.history} className="mt-4" />
        </article>

        <article
          className="motion-card stagger-card-enter rounded-2xl border border-slate-800/90 bg-slate-900/70 p-5 shadow-xl shadow-slate-950/60"
          style={asStaggerStyle(80)}
        >
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-slate-100">My watchlist</h2>
            <span className="rounded-full border border-slate-700 px-2.5 py-1 text-xs text-slate-300">
              {userData.watchlist.length} items
            </span>
          </div>
          {userData.watchlist.length === 0 ? (
            <div className="mt-4 rounded-lg border border-sky-500/20 bg-sky-500/5 p-4">
              <div className="empty-state-float inline-flex rounded-xl border border-sky-500/30 bg-sky-500/10 p-2.5 text-sky-200">
                <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
                  <path
                    d="M4 6.5A1.5 1.5 0 0 1 5.5 5h13A1.5 1.5 0 0 1 20 6.5v11a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 17.5v-11ZM6 7v10h12V7H6Zm2 2h8v2H8V9Zm0 4h6v2H8v-2Z"
                    fill="currentColor"
                  />
                </svg>
              </div>
              <h3 className="mt-3 text-sm font-semibold text-slate-100">Start your watchlist</h3>
              <p className="mt-1 text-sm text-slate-300">Save scans to track changes and get trend visibility over time.</p>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-slate-400">
                <li>Run a scan from the scanner page.</li>
                <li>Use “Save current scan” to add domains.</li>
                <li>Refresh all entries when preparing a release.</li>
              </ul>
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
                          className="inline-flex rounded-md border border-slate-700 px-2.5 py-1.5 text-xs font-medium text-sky-300 transition hover:border-sky-500/60 hover:text-sky-200"
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
          <WatchlistSchedulePanel entries={userData.watchlist} />
        </article>

        <article
          className="motion-card stagger-card-enter rounded-2xl border border-slate-800/90 bg-slate-900/70 p-5 shadow-xl shadow-slate-950/60"
          style={asStaggerStyle(160)}
        >
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-slate-100">Scan history</h2>
            <div className="flex flex-wrap items-center justify-end gap-2">
              <ScanHistoryCsvDownloadButton entries={userData.scanHistory} fileNamePrefix="dashboard-scan-history" />
              <span className="rounded-full border border-slate-700 px-2.5 py-1 text-xs text-slate-300">
                {userData.scanHistory.length} entries
              </span>
            </div>
          </div>
          {userData.scanHistory.length === 0 ? (
            <div className="mt-4 rounded-lg border border-sky-500/20 bg-sky-500/5 p-4">
              <div className="empty-state-float inline-flex rounded-xl border border-sky-500/30 bg-sky-500/10 p-2.5 text-sky-200">
                <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
                  <path
                    d="M12 3 4 7v6c0 4.8 3.2 8.9 8 10 4.8-1.1 8-5.2 8-10V7l-8-4Zm0 2.2L18 8v5c0 3.8-2.4 7.1-6 8.2-3.6-1.1-6-4.4-6-8.2V8l6-2.8ZM8.5 11h7v2h-7v-2Zm0 3.4h5v2h-5v-2Z"
                    fill="currentColor"
                  />
                </svg>
              </div>
              <h3 className="mt-3 text-sm font-semibold text-slate-100">Build your baseline</h3>
              <p className="mt-1 text-sm text-slate-300">Run checks regularly to compare grades and spot regressions sooner.</p>
              <p className="mt-2 text-xs text-slate-400">Tip: use bulk scans for weekly snapshots across key domains.</p>
            </div>
          ) : (
            <ul className="mt-4 space-y-2">
              {userData.scanHistory.map((entry) => (
                <li key={entry.id} className="motion-card rounded-lg border border-slate-800 bg-slate-950/60 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
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

        <article
          className="motion-card stagger-card-enter rounded-2xl border border-slate-800/90 bg-slate-900/70 p-5 shadow-xl shadow-slate-950/60"
          style={asStaggerStyle(240)}
        >
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-slate-100">Quick actions</h2>
            <span className="rounded-full border border-slate-700 px-2.5 py-1 text-xs text-slate-300">One click</span>
          </div>
          <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            <Link
              href="/"
              className="pressable rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-2 text-center text-xs font-semibold uppercase tracking-[0.12em] text-slate-200 transition hover:border-sky-500/60 hover:text-sky-200"
            >
              New Scan
            </Link>
            <Link
              href="/bulk"
              className="pressable rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-2 text-center text-xs font-semibold uppercase tracking-[0.12em] text-slate-200 transition hover:border-sky-500/60 hover:text-sky-200"
            >
              Bulk Scan
            </Link>
            <Link
              href="/compare"
              className="pressable rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-2 text-center text-xs font-semibold uppercase tracking-[0.12em] text-slate-200 transition hover:border-sky-500/60 hover:text-sky-200"
            >
              Compare Sites
            </Link>
          </div>
          <p className="mt-3 text-xs text-slate-500">
            Press <span className="text-slate-300">Cmd/Ctrl+K</span> to jump back to the scanner URL input.
          </p>
        </article>

        <article
          className="motion-card stagger-card-enter rounded-2xl border border-slate-800/90 bg-slate-900/70 p-5 shadow-xl shadow-slate-950/60"
          style={asStaggerStyle(320)}
        >
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-slate-100">Security trend (7 days)</h2>
            <span className="rounded-full border border-slate-700 px-2.5 py-1 text-xs text-slate-300">Watchlist avg</span>
          </div>
          {sevenDayAverageTrend.some((point) => point.value !== null) ? (
            <>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <p className="text-sm text-slate-300">
                  Latest score{" "}
                  <span className="font-semibold text-slate-100">
                    {latestAveragePoint?.value !== null ? `${latestAveragePoint?.value.toFixed(2)}/5` : "--"}
                  </span>
                </p>
                <span className={`inline-flex rounded-md border px-2 py-1 text-xs ${trendDeltaClassName}`}>
                  {trendDeltaLabel}
                </span>
              </div>
              <MiniScoreTrendChart
                points={sevenDayAverageTrend.map((point) => ({ label: point.label, value: point.value }))}
                className="mt-3 h-24 w-full text-slate-300"
                ariaLabel="Seven day average watchlist score trend"
              />
              <div className="mt-2 grid grid-cols-7 gap-1 text-center text-[11px] text-slate-400">
                {sevenDayAverageTrend.map((point) => (
                  <span key={`trend-label-${point.isoDate}`}>{point.label}</span>
                ))}
              </div>
            </>
          ) : (
            <div className="mt-4 rounded-lg border border-sky-500/20 bg-sky-500/5 p-4">
              <div className="empty-state-float inline-flex rounded-xl border border-sky-500/30 bg-sky-500/10 p-2.5 text-sky-200">
                <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
                  <path
                    d="M4 17h16v2H4v-2Zm1.5-2.2 4.7-5 3.2 2.8 4.4-5.6 1.7 1.4-5.7 7.3-3.3-2.9-3.4 3.6-1.6-1.6Z"
                    fill="currentColor"
                  />
                </svg>
              </div>
              <p className="mt-2 text-sm text-slate-300">
                No trend data yet. Add watchlist domains and run scans to populate your 7-day average chart.
              </p>
            </div>
          )}
        </article>

        <article
          className="motion-card stagger-card-enter rounded-2xl border border-slate-800/90 bg-slate-900/70 p-5 shadow-xl shadow-slate-950/60 lg:col-span-2"
          style={asStaggerStyle(400)}
        >
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-slate-100">Recent scans across the platform</h2>
            <span className="rounded-full border border-slate-700 px-2.5 py-1 text-xs text-slate-300">
              Last {recentPublicScans.length}
            </span>
          </div>
          {recentPublicScans.length === 0 ? (
            <div className="mt-4 rounded-lg border border-sky-500/20 bg-sky-500/5 p-4">
              <div className="empty-state-float inline-flex rounded-xl border border-sky-500/30 bg-sky-500/10 p-2.5 text-sky-200">
                <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
                  <path
                    d="M3 5.5A2.5 2.5 0 0 1 5.5 3h13A2.5 2.5 0 0 1 21 5.5v9A2.5 2.5 0 0 1 18.5 17h-4.8l-3.3 3.5a1 1 0 0 1-1.7-.7V17H5.5A2.5 2.5 0 0 1 3 14.5v-9Zm2.5-.5a.5.5 0 0 0-.5.5v9a.5.5 0 0 0 .5.5h4.2a1 1 0 0 1 1 1v1.3l2-2.1a1 1 0 0 1 .7-.2h5.1a.5.5 0 0 0 .5-.5v-9a.5.5 0 0 0-.5-.5h-13Z"
                    fill="currentColor"
                  />
                </svg>
              </div>
              <p className="mt-2 text-sm text-slate-300">
                Public scan activity will appear here once shareable reports are generated.
              </p>
            </div>
          ) : (
            <ul className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {recentPublicScans.map((entry) => (
                <li key={entry.id} className="motion-card rounded-lg border border-slate-800 bg-slate-950/60 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="truncate text-sm text-slate-100">{anonymizeHost(entry.report.finalUrl || entry.report.checkedUrl)}</p>
                    <span className="grade-badge-in text-sm font-semibold text-sky-200">Grade {entry.report.grade}</span>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    Shared {new Date(entry.createdAt).toLocaleString()} • anonymized public sample
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

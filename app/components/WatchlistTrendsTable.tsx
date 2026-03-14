"use client";

import { useMemo, useState } from "react";
import { TrendChart } from "@/app/components/TrendChart";
import { TrendReportExportButtons } from "@/app/components/TrendReportExportButtons";
import type {
  AggregateTrendStats,
  DomainTrendSummary,
  HeaderStatusChange,
  TrendWindowSummary
} from "@/lib/watchlistTrends";

function formatPercent(window: TrendWindowSummary): string {
  if (!window.hasEnoughData || window.percentChange === null) return "No baseline";
  const prefix = window.percentChange > 0 ? "+" : "";
  return `${prefix}${window.percentChange.toFixed(1)}%`;
}

function windowTone(window: TrendWindowSummary): {
  arrow: string;
  className: string;
} {
  if (!window.hasEnoughData || window.percentChange === null) {
    return {
      arrow: "•",
      className: "border-slate-700 bg-slate-900/80 text-slate-300"
    };
  }
  if (window.direction === "improving") {
    return {
      arrow: "↑",
      className: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
    };
  }
  if (window.direction === "degrading") {
    return {
      arrow: "↓",
      className: "border-rose-500/30 bg-rose-500/10 text-rose-300"
    };
  }
  return {
    arrow: "→",
    className: "border-slate-700 bg-slate-900/80 text-slate-300"
  };
}

function domainTone(domain: DomainTrendSummary): {
  label: string;
  className: string;
  chartClassName: string;
} {
  if (domain.overallDirection === "improving") {
    return {
      label: "Improving",
      className: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
      chartClassName: "text-emerald-300"
    };
  }
  if (domain.overallDirection === "degrading") {
    return {
      label: "Regressing",
      className: "border-rose-500/30 bg-rose-500/10 text-rose-300",
      chartClassName: "text-rose-300"
    };
  }
  return {
    label: "Stable",
    className: "border-slate-700 bg-slate-900/80 text-slate-300",
    chartClassName: "text-slate-300"
  };
}

function headerChangeTone(change: HeaderStatusChange): string {
  const rank: Record<HeaderStatusChange["from"], number> = {
    missing: 1,
    weak: 2,
    good: 3
  };
  const fromRank = rank[change.from];
  const toRank = rank[change.to];
  if (toRank > fromRank) {
    return "border-emerald-500/30 bg-emerald-500/10 text-emerald-200";
  }
  if (toRank < fromRank) {
    return "border-rose-500/30 bg-rose-500/10 text-rose-200";
  }
  return "border-slate-700 bg-slate-900/80 text-slate-300";
}

export function WatchlistTrendsTable({
  aggregate,
  domains
}: {
  aggregate: AggregateTrendStats;
  domains: DomainTrendSummary[];
}) {
  const [expandedDomain, setExpandedDomain] = useState<string | null>(domains[0]?.domain ?? null);

  const populatedTimelineCount = useMemo(
    () => domains.reduce((sum, domain) => sum + domain.timeline.filter((entry) => entry.headerChanges.length > 0).length, 0),
    [domains]
  );

  return (
    <section className="rounded-2xl border border-slate-800/90 bg-slate-900/70 p-5 shadow-xl shadow-slate-950/60">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-100">Domain trend breakdown</h2>
          <p className="mt-1 text-xs text-slate-500">
            {domains.length} monitored domains • {populatedTimelineCount} timeline events with header-level changes
          </p>
        </div>
        <TrendReportExportButtons aggregate={aggregate} domains={domains} />
      </div>

      {domains.length === 0 ? (
        <div className="mt-4 rounded-lg border border-sky-500/20 bg-sky-500/5 p-4">
          <p className="text-sm text-slate-300">
            No watchlist domains found yet. Save scans to your watchlist, then come back to analyze trends.
          </p>
        </div>
      ) : (
        <div className="mt-4 overflow-hidden rounded-xl border border-slate-800/90">
          <ul className="divide-y divide-slate-800/90">
            {domains.map((domain) => {
              const expanded = expandedDomain === domain.domain;
              const sevenDayTone = windowTone(domain.trend7d);
              const thirtyDayTone = windowTone(domain.trend30d);
              const trendTone = domainTone(domain);

              return (
                <li key={domain.domain} className="bg-slate-950/55">
                  <button
                    type="button"
                    aria-expanded={expanded}
                    onClick={() => setExpandedDomain((current) => (current === domain.domain ? null : domain.domain))}
                    className="w-full px-4 py-4 text-left transition hover:bg-slate-900/70"
                  >
                    <div className="grid gap-3 lg:grid-cols-[minmax(0,2fr)_120px_110px_120px_120px_120px] lg:items-center">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-slate-100">{domain.domain}</p>
                        <p className="truncate text-xs text-slate-500">{domain.displayUrl}</p>
                      </div>
                      <div className="w-full lg:w-[110px]">
                        <TrendChart
                          points={domain.sparklinePoints}
                          className={`h-10 w-full ${trendTone.chartClassName}`}
                          ariaLabel={`Grade trend sparkline for ${domain.domain}`}
                        />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-sky-200">{domain.latestGrade ?? "--"}</p>
                        <p className="text-[11px] text-slate-500">
                          {domain.latestCheckedAt ? new Date(domain.latestCheckedAt).toLocaleDateString() : "No scans"}
                        </p>
                      </div>
                      <div>
                        <span className={`inline-flex rounded-md border px-2 py-1 text-[11px] ${sevenDayTone.className}`}>
                          {`7d ${sevenDayTone.arrow} ${formatPercent(domain.trend7d)}`}
                        </span>
                      </div>
                      <div>
                        <span className={`inline-flex rounded-md border px-2 py-1 text-[11px] ${thirtyDayTone.className}`}>
                          {`30d ${thirtyDayTone.arrow} ${formatPercent(domain.trend30d)}`}
                        </span>
                      </div>
                      <div>
                        <span className={`inline-flex rounded-md border px-2 py-1 text-[11px] ${trendTone.className}`}>
                          {trendTone.label}
                        </span>
                      </div>
                    </div>
                  </button>

                  {expanded && (
                    <div className="border-t border-slate-800/90 bg-slate-950/85 px-4 py-4">
                      <div className="rounded-lg border border-slate-800/90 bg-slate-900/80 p-3">
                        <p className="text-xs uppercase tracking-[0.12em] text-slate-500">Full grade history timeline</p>
                        <TrendChart
                          points={[...domain.sparklinePoints].sort(
                            (a, b) => new Date(a.checkedAt).getTime() - new Date(b.checkedAt).getTime()
                          )}
                          width={700}
                          height={170}
                          className={`mt-3 h-40 w-full ${trendTone.chartClassName}`}
                          ariaLabel={`Grade history timeline for ${domain.domain}`}
                        />
                        <p className="mt-2 text-xs text-slate-500">
                          {domain.timeline.length} points retained (max 30 over 90 days).
                        </p>
                      </div>

                      <div className="mt-3 space-y-2">
                        {domain.timeline.length === 0 ? (
                          <p className="text-sm text-slate-400">No timeline points recorded.</p>
                        ) : (
                          domain.timeline.map((entry) => (
                            <article
                              key={`${domain.domain}-${entry.checkedAt}-${entry.grade}`}
                              className="rounded-lg border border-slate-800/90 bg-slate-900/70 p-3"
                            >
                              <div className="flex flex-wrap items-center justify-between gap-3">
                                <p className="text-xs text-slate-400">{new Date(entry.checkedAt).toLocaleString()}</p>
                                <span className="rounded-md border border-slate-700 bg-slate-950/70 px-2 py-1 text-xs font-semibold text-sky-200">
                                  Grade {entry.grade}
                                </span>
                              </div>
                              {entry.headerChanges.length === 0 ? (
                                <p className="mt-2 text-xs text-slate-500">No specific header changes captured for this point.</p>
                              ) : (
                                <div className="mt-2 flex flex-wrap gap-2">
                                  {entry.headerChanges.map((change) => (
                                    <span
                                      key={`${entry.checkedAt}-${change.headerKey}-${change.from}-${change.to}`}
                                      className={`inline-flex rounded-md border px-2 py-1 text-xs ${headerChangeTone(change)}`}
                                    >
                                      {`${change.headerLabel}: ${change.from} -> ${change.to}`}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </article>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </section>
  );
}

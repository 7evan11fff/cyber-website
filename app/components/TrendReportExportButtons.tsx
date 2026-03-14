"use client";

import { useState } from "react";
import type { AggregateTrendStats, DomainTrendSummary } from "@/lib/watchlistTrends";

function escapeCsvCell(value: string): string {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, "\"\"")}"`;
  }
  return value;
}

function triggerDownload(blob: Blob, fileName: string) {
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(objectUrl);
}

function formatTrendPercent(percent: number | null, available: boolean): string {
  if (!available || percent === null) return "";
  const prefix = percent > 0 ? "+" : "";
  return `${prefix}${percent.toFixed(2)}%`;
}

export function TrendReportExportButtons({
  aggregate,
  domains
}: {
  aggregate: AggregateTrendStats;
  domains: DomainTrendSummary[];
}) {
  const [csvState, setCsvState] = useState<"idle" | "exported" | "error">("idle");
  const [pdfState, setPdfState] = useState<"idle" | "generating" | "error">("idle");

  function downloadCsv() {
    if (domains.length === 0) return;
    try {
      const summaryRows = [
        ["Metric", "Value"],
        ["Total domains monitored", String(aggregate.totalDomainsMonitored)],
        ["Average grade", aggregate.averageGrade],
        ["Average score", aggregate.averageScore !== null ? aggregate.averageScore.toFixed(2) : ""],
        ["Improved this week", String(aggregate.improvedThisWeek)],
        ["Regressed this week", String(aggregate.regressedThisWeek)],
        [""],
        [
          "Domain",
          "Display URL",
          "Latest grade",
          "Latest checked at",
          "7d direction",
          "7d change",
          "30d direction",
          "30d change",
          "Overall direction",
          "Timeline points",
          "Header change events"
        ]
      ];

      const domainRows = domains.map((domain) => [
        domain.domain,
        domain.displayUrl,
        domain.latestGrade ?? "",
        domain.latestCheckedAt ?? "",
        domain.trend7d.direction,
        formatTrendPercent(domain.trend7d.percentChange, domain.trend7d.hasEnoughData),
        domain.trend30d.direction,
        formatTrendPercent(domain.trend30d.percentChange, domain.trend30d.hasEnoughData),
        domain.overallDirection,
        String(domain.timeline.length),
        String(domain.timeline.filter((entry) => entry.headerChanges.length > 0).length)
      ]);

      const timelineRows = [
        [""],
        ["Domain", "Checked at", "Grade", "Header change details"]
      ];

      for (const domain of domains) {
        for (const entry of domain.timeline) {
          const details =
            entry.headerChanges.length === 0
              ? ""
              : entry.headerChanges
                  .map((change) => `${change.headerLabel}: ${change.from}->${change.to}`)
                  .join(" | ");
          timelineRows.push([domain.domain, entry.checkedAt, entry.grade, details]);
        }
      }

      const csvContent = [...summaryRows, ...domainRows, ...timelineRows]
        .map((row) => row.map((cell) => escapeCsvCell(String(cell))).join(","))
        .join("\n");

      triggerDownload(
        new Blob([csvContent], { type: "text/csv;charset=utf-8;" }),
        `watchlist-trends-${Date.now()}.csv`
      );
      setCsvState("exported");
    } catch {
      setCsvState("error");
    } finally {
      window.setTimeout(() => setCsvState("idle"), 2500);
    }
  }

  async function downloadPdf() {
    if (domains.length === 0 || pdfState === "generating") return;
    setPdfState("generating");
    try {
      const { buildWatchlistTrendReportPdfBlob } = await import("@/lib/trendReportPdf");
      const blob = await buildWatchlistTrendReportPdfBlob({ aggregate, domains });
      triggerDownload(blob, `watchlist-trends-${Date.now()}.pdf`);
      setPdfState("idle");
    } catch {
      setPdfState("error");
      window.setTimeout(() => setPdfState("idle"), 3000);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={downloadCsv}
        disabled={domains.length === 0}
        aria-label="Export watchlist trends as CSV"
        className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs uppercase tracking-[0.12em] text-slate-300 transition hover:border-sky-500/60 hover:text-sky-200 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {csvState === "exported" ? "CSV downloaded" : csvState === "error" ? "CSV failed" : "Export CSV"}
      </button>
      <button
        type="button"
        onClick={() => void downloadPdf()}
        disabled={domains.length === 0 || pdfState === "generating"}
        aria-label="Export watchlist trends as PDF"
        className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs uppercase tracking-[0.12em] text-slate-300 transition hover:border-sky-500/60 hover:text-sky-200 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {pdfState === "generating" ? "Preparing PDF..." : pdfState === "error" ? "PDF failed" : "Export PDF"}
      </button>
    </div>
  );
}

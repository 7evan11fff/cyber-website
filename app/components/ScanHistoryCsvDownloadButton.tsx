"use client";

import { useState } from "react";
import { useToast } from "@/app/components/ToastProvider";
import { buildScanHistoryCsv } from "@/lib/scanHistoryCsv";
import type { ScanHistoryEntry } from "@/lib/userData";

export function ScanHistoryCsvDownloadButton({
  entries,
  fileNamePrefix = "security-scan-history"
}: {
  entries: ScanHistoryEntry[];
  fileNamePrefix?: string;
}) {
  const { notify } = useToast();
  const [exportState, setExportState] = useState<"idle" | "preparing" | "exported" | "error">("idle");

  function onDownloadCsv() {
    if (entries.length === 0 || exportState === "preparing") return;
    setExportState("preparing");

    try {
      const csvContent = buildScanHistoryCsv(entries);
      const blob = new Blob(["\uFEFF", csvContent], { type: "text/csv;charset=utf-8;" });
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = `${fileNamePrefix}-${Date.now()}.csv`;
      document.body.append(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(objectUrl);

      setExportState("exported");
      notify({ tone: "success", message: "Scan history exported as CSV." });
    } catch {
      setExportState("error");
      notify({ tone: "error", message: "Could not export scan history CSV. Please try again." });
    } finally {
      window.setTimeout(() => setExportState("idle"), 2500);
    }
  }

  return (
    <button
      type="button"
      onClick={onDownloadCsv}
      disabled={entries.length === 0 || exportState === "preparing"}
      aria-label="Download scan history as CSV"
      className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs uppercase tracking-[0.12em] text-slate-300 transition hover:border-sky-500/60 hover:text-sky-200 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {exportState === "preparing"
        ? "Preparing CSV..."
        : exportState === "exported"
          ? "CSV downloaded"
          : exportState === "error"
            ? "CSV failed"
            : "Download CSV"}
    </button>
  );
}

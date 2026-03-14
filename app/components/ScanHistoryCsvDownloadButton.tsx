"use client";

import { useMemo, useState } from "react";
import { getAllHeaderInfo } from "@/lib/securityHeaders";
import type { ScanHistoryEntry } from "@/lib/userData";

function escapeCsvCell(value: string): string {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, "\"\"")}"`;
  }
  return value;
}

function extractDomain(value: string): string {
  try {
    const withProtocol = /^https?:\/\//i.test(value) ? value : `https://${value}`;
    return new URL(withProtocol).hostname || value;
  } catch {
    return value;
  }
}

export function ScanHistoryCsvDownloadButton({
  entries,
  fileNamePrefix = "security-scan-history"
}: {
  entries: ScanHistoryEntry[];
  fileNamePrefix?: string;
}) {
  const [exportState, setExportState] = useState<"idle" | "exported" | "error">("idle");
  const headerDefinitions = useMemo(() => getAllHeaderInfo().map((header) => ({ key: header.key, label: header.label })), []);

  function onDownloadCsv() {
    if (entries.length === 0) return;

    try {
      const headerRow = [
        "Domain",
        "Date",
        "Grade",
        "Score",
        ...headerDefinitions.map((header) => `${header.label} status`)
      ];
      const dataRows = entries.map((entry) => {
        const statuses = entry.headerStatuses ?? {};
        return [
          extractDomain(entry.url),
          entry.checkedAt,
          entry.grade,
          typeof entry.score === "number" && typeof entry.maxScore === "number"
            ? `${entry.score}/${entry.maxScore}`
            : "",
          ...headerDefinitions.map((header) => statuses[header.key] ?? "")
        ];
      });

      const csvContent = [headerRow, ...dataRows]
        .map((row) => row.map((cell) => escapeCsvCell(String(cell))).join(","))
        .join("\n");

      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = `${fileNamePrefix}-${Date.now()}.csv`;
      document.body.append(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(objectUrl);

      setExportState("exported");
    } catch {
      setExportState("error");
    } finally {
      window.setTimeout(() => setExportState("idle"), 2500);
    }
  }

  return (
    <button
      type="button"
      onClick={onDownloadCsv}
      disabled={entries.length === 0}
      aria-label="Download scan history as CSV"
      className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs uppercase tracking-[0.12em] text-slate-300 transition hover:border-sky-500/60 hover:text-sky-200 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {exportState === "exported" ? "CSV downloaded" : exportState === "error" ? "CSV failed" : "Download CSV"}
    </button>
  );
}

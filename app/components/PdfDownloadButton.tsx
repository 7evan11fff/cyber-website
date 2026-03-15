"use client";

import { useCallback, useEffect, useState } from "react";
import type { CookieSecurityAnalysis } from "@/lib/cookieSecurity";
import type { CorsAnalysis } from "@/lib/corsAnalysis";
import type { DnsAnalysis } from "@/lib/dnsAnalysis";
import type { SecurityTxtAnalysis } from "@/lib/securityTxtAnalysis";
import type { SriAnalysis } from "@/lib/sriAnalysis";
import type { TlsAnalysis } from "@/lib/tlsAnalysis";
import type { HeaderResult } from "@/lib/securityHeaders";

type ReportResponse = {
  checkedUrl: string;
  finalUrl: string;
  statusCode: number;
  score: number;
  grade: string;
  results: HeaderResult[];
  cookieAnalysis?: CookieSecurityAnalysis;
  corsAnalysis?: CorsAnalysis;
  tlsAnalysis?: TlsAnalysis;
  dnsAnalysis?: DnsAnalysis;
  sriAnalysis?: SriAnalysis;
  securityTxtAnalysis?: SecurityTxtAnalysis;
  checkedAt: string;
  responseTimeMs?: number;
  scanDurationMs?: number;
};

type PdfDownloadState = "idle" | "generating" | "error";

type PdfDownloadButtonProps = {
  report: ReportResponse | null;
  busy: boolean;
  requestKey: number;
  onStateChange: (state: PdfDownloadState) => void;
  onSuccess: () => void;
  onError: () => void;
};

function extractDomainFromUrl(value: string): string | null {
  try {
    const parsed = new URL(value);
    return parsed.hostname;
  } catch {
    return null;
  }
}

export function PdfDownloadButton({
  report,
  busy,
  requestKey,
  onStateChange,
  onSuccess,
  onError
}: PdfDownloadButtonProps) {
  const [state, setState] = useState<PdfDownloadState>("idle");

  const updateState = useCallback(
    (next: PdfDownloadState) => {
      setState(next);
      onStateChange(next);
    },
    [onStateChange]
  );

  const exportPdf = useCallback(async () => {
    if (!report || busy || state === "generating") return;

    updateState("generating");
    try {
      const { buildSecurityReportPdfBlob } = await import("@/lib/pdfReport");
      const blob = await buildSecurityReportPdfBlob(report);
      const objectUrl = URL.createObjectURL(blob);
      const domain = extractDomainFromUrl(report.finalUrl) ?? extractDomainFromUrl(report.checkedUrl) ?? "scan";
      const safeDomain = domain.replace(/[^a-z0-9.-]/gi, "-");

      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = `security-report-${safeDomain}-${Date.now()}.pdf`;
      document.body.append(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(objectUrl);

      updateState("idle");
      onSuccess();
    } catch {
      updateState("error");
      onError();
      window.setTimeout(() => updateState("idle"), 3000);
    }
  }, [busy, onError, onSuccess, report, state, updateState]);

  useEffect(() => {
    if (requestKey === 0) return;
    void exportPdf();
  }, [exportPdf, requestKey]);

  return (
    <button
      id="download-report-button"
      type="button"
      onClick={() => void exportPdf()}
      disabled={busy || state === "generating" || !report}
      aria-label="Download PDF report for current scan"
      className="rounded-lg border border-slate-700 bg-slate-950/80 px-3 py-1.5 text-xs uppercase tracking-[0.12em] text-slate-300 transition hover:border-sky-500/60 hover:text-sky-200 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {state === "generating" ? "Preparing report..." : "Download Report"}
    </button>
  );
}

import type { HeaderResult } from "@/lib/securityHeaders";
import type { FrameworkInfo } from "@/lib/frameworkDetection";

export type SharedScanReport = {
  checkedUrl: string;
  finalUrl: string;
  statusCode: number;
  score: number;
  grade: string;
  results: HeaderResult[];
  checkedAt: string;
  framework?: FrameworkInfo;
};

export type SharedComparisonReport = {
  siteA: SharedScanReport;
  siteB: SharedScanReport;
};

export type SharedReportPayload =
  | {
      version: 1;
      mode: "single";
      report: SharedScanReport;
    }
  | {
      version: 1;
      mode: "compare";
      comparison: SharedComparisonReport;
    };

export type SharedReportRecord = {
  id: string;
  createdAt: string;
  payload: SharedReportPayload;
};

function extractHost(value: string): string {
  try {
    return new URL(value).hostname || value;
  } catch {
    return value;
  }
}

function summarizeSingleReport(report: SharedScanReport) {
  const domain = extractHost(report.finalUrl || report.checkedUrl);
  const maxScore = report.results.length * 2;
  const missingCount = report.results.filter((entry) => entry.status === "missing").length;
  const title = `${domain} security header report (grade ${report.grade})`;
  const description = `${domain} scored ${report.score}/${maxScore} with grade ${report.grade}. Missing headers: ${missingCount}.`;
  return { title, description };
}

function summarizeComparisonReport(comparison: SharedComparisonReport) {
  const siteA = extractHost(comparison.siteA.finalUrl || comparison.siteA.checkedUrl);
  const siteB = extractHost(comparison.siteB.finalUrl || comparison.siteB.checkedUrl);
  const title = `${siteA} vs ${siteB} security headers comparison`;
  const description = `Comparison report: ${siteA} grade ${comparison.siteA.grade} vs ${siteB} grade ${comparison.siteB.grade}.`;
  return { title, description };
}

export function summarizeSharedPayload(payload: SharedReportPayload): {
  title: string;
  description: string;
} {
  if (payload.mode === "single") {
    return summarizeSingleReport(payload.report);
  }
  return summarizeComparisonReport(payload.comparison);
}

export function buildSharedReportPath(id: string): string {
  return `/report/${encodeURIComponent(id)}`;
}

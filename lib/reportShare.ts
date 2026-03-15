import type { HeaderResult } from "@/lib/securityHeaders";
import type { CookieSecurityAnalysis } from "@/lib/cookieSecurity";
import type { CorsAnalysis } from "@/lib/corsAnalysis";
import type { DnsAnalysis } from "@/lib/dnsAnalysis";
import type { EmailSecurityAnalysis } from "@/lib/emailSecurityAnalysis";
import type { FrameworkInfo } from "@/lib/frameworkDetection";
import type { MixedContentAnalysis } from "@/lib/mixedContentAnalysis";
import type { SecurityTxtAnalysis } from "@/lib/securityTxtAnalysis";
import type { SriAnalysis } from "@/lib/sriAnalysis";
import type { TlsAnalysis } from "@/lib/tlsAnalysis";

export type SharedScanReport = {
  checkedUrl: string;
  finalUrl: string;
  statusCode: number;
  score: number;
  maxScore?: number;
  grade: string;
  results: HeaderResult[];
  cookieAnalysis?: CookieSecurityAnalysis;
  corsAnalysis?: CorsAnalysis;
  tlsAnalysis?: TlsAnalysis;
  dnsAnalysis?: DnsAnalysis;
  emailSecurityAnalysis?: EmailSecurityAnalysis;
  mixedContentAnalysis?: MixedContentAnalysis;
  sriAnalysis?: SriAnalysis;
  securityTxtAnalysis?: SecurityTxtAnalysis;
  checkedAt: string;
  framework?: FrameworkInfo;
  responseTimeMs?: number;
  scanDurationMs?: number;
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
  expiresAt: string;
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
  const maxScore = typeof report.maxScore === "number" ? report.maxScore : report.results.length * 2;
  const riskyFindings = report.results.filter((entry) => entry.status !== "good");
  const missingCount = riskyFindings.filter((entry) => entry.status === "missing").length;
  const cookieSummary =
    report.cookieAnalysis && report.cookieAnalysis.cookieCount > 0
      ? ` Cookies analyzed: ${report.cookieAnalysis.cookieCount}, cookie grade ${report.cookieAnalysis.grade}.`
      : "";
  const securityTxtSummary = report.securityTxtAnalysis
    ? ` security.txt: ${report.securityTxtAnalysis.summary}`
    : "";
  const emailSecuritySummary = report.emailSecurityAnalysis
    ? ` Email auth score: ${report.emailSecurityAnalysis.score}/${report.emailSecurityAnalysis.maxScore}.`
    : "";
  const mixedContentSummary = report.mixedContentAnalysis
    ? ` Mixed content: ${report.mixedContentAnalysis.summary}`
    : "";
  const findingsPreview =
    riskyFindings.length === 0
      ? "All evaluated headers are configured."
      : `Findings: ${riskyFindings
          .slice(0, 2)
          .map((entry) => entry.label)
          .join(", ")}${riskyFindings.length > 2 ? ` (+${riskyFindings.length - 2} more)` : ""}.`;
  const title = `${domain} security header report (grade ${report.grade})`;
  const description = `${domain} scored ${report.score}/${maxScore} with grade ${report.grade}. Missing headers: ${missingCount}.${cookieSummary}${securityTxtSummary}${emailSecuritySummary}${mixedContentSummary} ${findingsPreview}`;
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

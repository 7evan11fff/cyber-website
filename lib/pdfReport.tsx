import React from "react";
import { Document, Page, Path, StyleSheet, Svg, Text, View, pdf } from "@react-pdf/renderer";
import type { CookieSecurityAnalysis } from "@/lib/cookieSecurity";
import type { CorsAnalysis } from "@/lib/corsAnalysis";
import type { DnsAnalysis } from "@/lib/dnsAnalysis";
import type { DnssecAnalysis } from "@/lib/dnssecAnalysis";
import type { CaaAnalysis } from "@/lib/caaAnalysis";
import type { EmailSecurityAnalysis } from "@/lib/emailSecurityAnalysis";
import type { HstsPreloadAnalysis } from "@/lib/hstsPreloadAnalysis";
import type { MixedContentAnalysis } from "@/lib/mixedContentAnalysis";
import type { SecurityTxtAnalysis } from "@/lib/securityTxtAnalysis";
import type { SriAnalysis } from "@/lib/sriAnalysis";
import type { TlsAnalysis } from "@/lib/tlsAnalysis";
import type { HeaderResult } from "@/lib/securityHeaders";
import { SITE_NAME } from "@/lib/seo";

type ReportResponse = {
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
  dnssecAnalysis?: DnssecAnalysis;
  caaAnalysis?: CaaAnalysis;
  emailSecurityAnalysis?: EmailSecurityAnalysis;
  mixedContentAnalysis?: MixedContentAnalysis;
  sriAnalysis?: SriAnalysis;
  securityTxtAnalysis?: SecurityTxtAnalysis;
  hstsPreloadAnalysis?: HstsPreloadAnalysis;
  checkedAt: string;
  responseTimeMs?: number;
  scanDurationMs?: number;
};

type RecommendationItem = Pick<HeaderResult, "key" | "label" | "status" | "riskLevel" | "guidance">;

const styles = StyleSheet.create({
  page: {
    paddingTop: 30,
    paddingBottom: 36,
    paddingHorizontal: 34,
    fontSize: 10,
    color: "#0f172a",
    fontFamily: "Helvetica"
  },
  header: {
    marginBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#dbeafe",
    paddingBottom: 10
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center"
  },
  brandRow: {
    flexDirection: "row",
    alignItems: "center"
  },
  brandMark: {
    width: 24,
    height: 24,
    marginRight: 8
  },
  brandName: {
    fontSize: 16,
    fontWeight: 700,
    color: "#0c4a6e"
  },
  brandTagline: {
    marginTop: 2,
    fontSize: 8.5,
    color: "#475569"
  },
  generatedLabel: {
    fontSize: 8,
    color: "#475569",
    textAlign: "right"
  },
  reportTitle: {
    marginTop: 8,
    fontSize: 12,
    fontWeight: 700,
    color: "#1e293b"
  },
  metadataGrid: {
    marginTop: 6,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 4
  },
  metadataRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0"
  },
  metadataRowLast: {
    flexDirection: "row"
  },
  metadataKey: {
    width: "30%",
    backgroundColor: "#f1f5f9",
    paddingHorizontal: 8,
    paddingVertical: 6,
    color: "#334155",
    fontWeight: 700
  },
  metadataValue: {
    width: "70%",
    paddingHorizontal: 8,
    paddingVertical: 6,
    color: "#0f172a"
  },
  highlightsSection: {
    marginBottom: 14,
    flexDirection: "row"
  },
  highlightCard: {
    width: "50%",
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 4,
    padding: 8,
    backgroundColor: "#f8fafc"
  },
  highlightCardSpaced: {
    marginLeft: 8
  },
  highlightLabel: {
    fontSize: 9,
    textTransform: "uppercase",
    color: "#475569"
  },
  highlightValue: {
    marginTop: 3,
    fontSize: 19,
    fontWeight: 700
  },
  highlightSubtext: {
    marginTop: 3,
    color: "#334155"
  },
  summarySection: {
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#bfdbfe",
    borderRadius: 4,
    padding: 8,
    backgroundColor: "#eff6ff"
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: 700,
    marginBottom: 6,
    color: "#0f172a"
  },
  summaryText: {
    color: "#334155",
    marginBottom: 2
  },
  summaryBullet: {
    marginTop: 3,
    marginLeft: 8,
    color: "#334155"
  },
  recommendationsSection: {
    marginTop: 14,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 4,
    padding: 8,
    backgroundColor: "#f8fafc"
  },
  recommendationItem: {
    marginTop: 4,
    color: "#1e293b"
  },
  recommendationMuted: {
    marginTop: 4,
    color: "#475569"
  },
  table: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 4
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#e2e8f0",
    borderBottomWidth: 1,
    borderBottomColor: "#cbd5e1"
  },
  tableHeaderCell: {
    paddingHorizontal: 6,
    paddingVertical: 6,
    fontSize: 9,
    fontWeight: 700,
    color: "#0f172a"
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0"
  },
  tableRowLast: {
    borderBottomWidth: 0
  },
  headerNameCol: {
    width: "20%"
  },
  statusCol: {
    width: "12%"
  },
  valueCol: {
    width: "24%"
  },
  rationaleCol: {
    width: "20%"
  },
  recommendationCol: {
    width: "24%"
  },
  tableCell: {
    paddingHorizontal: 6,
    paddingVertical: 6,
    color: "#1e293b"
  },
  headerLabelText: {
    fontWeight: 700
  },
  footer: {
    position: "absolute",
    left: 34,
    right: 34,
    bottom: 18,
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
    paddingTop: 6,
    fontSize: 8,
    color: "#64748b",
    flexDirection: "row",
    justifyContent: "space-between"
  },
  footerRight: {
    textAlign: "right"
  }
});

function gradeColor(grade: string) {
  if (grade === "A") return "#059669";
  if (grade === "B") return "#65a30d";
  if (grade === "C") return "#d97706";
  if (grade === "D") return "#ea580c";
  return "#dc2626";
}

function summaryLine(results: HeaderResult[]) {
  const counts = { good: 0, weak: 0, missing: 0 };
  for (const result of results) {
    counts[result.status] += 1;
  }
  return counts;
}

function statusLabel(status: HeaderResult["status"]) {
  if (status === "missing") return "Missing";
  if (status === "weak") return "Weak";
  return "Good";
}

function riskLabel(riskLevel: HeaderResult["riskLevel"]) {
  return riskLevel[0].toUpperCase() + riskLevel.slice(1);
}

export function collectRecommendationItems(results: HeaderResult[]): RecommendationItem[] {
  const statusRank: Record<HeaderResult["status"], number> = { missing: 3, weak: 2, good: 1 };
  const riskRank: Record<HeaderResult["riskLevel"], number> = { high: 3, medium: 2, low: 1 };

  return results
    .filter((result) => result.status !== "good")
    .sort((a, b) => {
      const byStatus = statusRank[b.status] - statusRank[a.status];
      if (byStatus !== 0) return byStatus;
      const byRisk = riskRank[b.riskLevel] - riskRank[a.riskLevel];
      if (byRisk !== 0) return byRisk;
      return a.label.localeCompare(b.label);
    })
    .map((result) => ({
      key: result.key,
      label: result.label,
      status: result.status,
      riskLevel: result.riskLevel,
      guidance: result.guidance
    }));
}

function formatTimestamp(input: string) {
  const date = new Date(input);
  if (!Number.isFinite(date.getTime())) return input;
  return date.toLocaleString();
}

function resolveResponseTimeMs(report: ReportResponse): number | null {
  if (typeof report.responseTimeMs === "number" && Number.isFinite(report.responseTimeMs) && report.responseTimeMs >= 0) {
    return Math.round(report.responseTimeMs);
  }
  if (typeof report.scanDurationMs === "number" && Number.isFinite(report.scanDurationMs) && report.scanDurationMs >= 0) {
    return Math.round(report.scanDurationMs);
  }
  return null;
}

function resolveMaxScore(report: ReportResponse) {
  if (typeof report.maxScore === "number" && Number.isFinite(report.maxScore)) {
    return report.maxScore;
  }
  return report.results.length * 2;
}

function BrandLogoMark() {
  return (
    <Svg viewBox="0 0 40 40" style={styles.brandMark}>
      <Path
        d="M20 2L33 7v11.5c0 10.2-6.8 16.3-13 19-6.2-2.7-13-8.8-13-19V7l13-5Z"
        fill="#0284c7"
        opacity={0.24}
      />
      <Path
        d="M20 5.3L30 9.2v9.3c0 8.3-5.2 13.3-10 15.5-4.8-2.2-10-7.2-10-15.5V9.2l10-3.9Z"
        fill="none"
        stroke="#075985"
        strokeWidth={1.8}
      />
      <Path
        d="M15 20.4h10v7h-10zM17 20.4v-2.2a3 3 0 1 1 6 0v2.2"
        fill="#0f172a"
      />
    </Svg>
  );
}

function SecurityReportDocument({ report, generatedAt }: { report: ReportResponse; generatedAt: string }) {
  const statusSummary = summaryLine(report.results);
  const recommendations = collectRecommendationItems(report.results);
  const maxScore = resolveMaxScore(report);
  const responseTimeMs = resolveResponseTimeMs(report);

  return (
    <Document title={`${SITE_NAME} Report`} author={SITE_NAME} subject="Security header scan report">
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View style={styles.headerRow}>
            <View style={styles.brandRow}>
              <BrandLogoMark />
              <View>
                <Text style={styles.brandName}>{SITE_NAME}</Text>
                <Text style={styles.brandTagline}>Security Posture Reporting for Client Delivery</Text>
              </View>
            </View>
            <Text style={styles.generatedLabel}>Generated {formatTimestamp(generatedAt)}</Text>
          </View>
          <Text style={styles.reportTitle}>Security Header Assessment Report</Text>
        </View>

        <View style={styles.metadataGrid}>
          <View style={styles.metadataRow}>
            <Text style={styles.metadataKey}>Site URL</Text>
            <Text style={styles.metadataValue}>{report.checkedUrl}</Text>
          </View>
          <View style={styles.metadataRow}>
            <Text style={styles.metadataKey}>Final URL</Text>
            <Text style={styles.metadataValue}>{report.finalUrl}</Text>
          </View>
          <View style={styles.metadataRow}>
            <Text style={styles.metadataKey}>Scan date</Text>
            <Text style={styles.metadataValue}>{formatTimestamp(report.checkedAt)}</Text>
          </View>
          <View style={styles.metadataRow}>
            <Text style={styles.metadataKey}>Response time</Text>
            <Text style={styles.metadataValue}>{responseTimeMs === null ? "Not available" : `${responseTimeMs} ms`}</Text>
          </View>
          <View style={styles.metadataRowLast}>
            <Text style={styles.metadataKey}>HTTP status</Text>
            <Text style={styles.metadataValue}>{String(report.statusCode)}</Text>
          </View>
        </View>

        <View style={styles.highlightsSection}>
          <View style={styles.highlightCard}>
            <Text style={styles.highlightLabel}>Overall grade</Text>
            <Text style={{ ...styles.highlightValue, color: gradeColor(report.grade) }}>{report.grade}</Text>
            <Text style={styles.highlightSubtext}>Security posture score</Text>
          </View>
          <View style={[styles.highlightCard, styles.highlightCardSpaced]}>
            <Text style={styles.highlightLabel}>Score</Text>
            <Text style={styles.highlightValue}>
              {report.score}/{maxScore}
            </Text>
            <Text style={styles.highlightSubtext}>Weighted header score</Text>
          </View>
        </View>

        <View style={styles.summarySection}>
          <Text style={styles.sectionTitle}>Executive Summary</Text>
          <Text style={styles.summaryText}>
            Strong headers: {statusSummary.good} · Weak headers: {statusSummary.weak} · Missing headers:{" "}
            {statusSummary.missing}
          </Text>
          <Text style={styles.summaryBullet}>
            • Overall grade is {report.grade}, based on a weighted score of {report.score}/{maxScore}.
          </Text>
          <Text style={styles.summaryBullet}>
            • CORS posture: {report.corsAnalysis?.summary ?? "Not available for this report snapshot."}
          </Text>
          <Text style={styles.summaryBullet}>
            • TLS posture: {report.tlsAnalysis?.summary ?? "Not available for this report snapshot."}
          </Text>
          <Text style={styles.summaryBullet}>
            • DNS posture: {report.dnsAnalysis?.summary ?? "Not available for this report snapshot."}
          </Text>
          <Text style={styles.summaryBullet}>
            • DNSSEC posture: {report.dnssecAnalysis?.summary ?? "Not available for this report snapshot."}
          </Text>
          <Text style={styles.summaryBullet}>
            • CAA posture: {report.caaAnalysis?.summary ?? "Not available for this report snapshot."}
          </Text>
          <Text style={styles.summaryBullet}>
            • SRI posture: {report.sriAnalysis?.summary ?? "Not available for this report snapshot."}
          </Text>
          <Text style={styles.summaryBullet}>
            • security.txt posture: {report.securityTxtAnalysis?.summary ?? "Not available for this report snapshot."}
          </Text>
          <Text style={styles.summaryBullet}>
            • HSTS preload posture: {report.hstsPreloadAnalysis?.summary ?? "Not available for this report snapshot."}
          </Text>
          <Text style={styles.summaryBullet}>
            • Email auth posture:{" "}
            {report.emailSecurityAnalysis
              ? `${report.emailSecurityAnalysis.score}/${report.emailSecurityAnalysis.maxScore} (${report.emailSecurityAnalysis.domain})`
              : "Not available for this report snapshot."}
          </Text>
          <Text style={styles.summaryBullet}>
            • Mixed content posture: {report.mixedContentAnalysis?.summary ?? "Not available for this report snapshot."}
          </Text>
          <Text style={styles.summaryBullet}>
            • Prioritize missing headers first, then weak policies, to reduce exploit surface for client-facing pages.
          </Text>
          <Text style={styles.summaryBullet}>
            • Re-scan after remediation and include this report as evidence in delivery and compliance documentation.
          </Text>
        </View>

        <View style={styles.summarySection}>
          <Text style={styles.sectionTitle}>Email Security Analysis (SPF / DKIM / DMARC)</Text>
          {report.emailSecurityAnalysis ? (
            <>
              <Text style={styles.summaryText}>
                Score {report.emailSecurityAnalysis.score}/{report.emailSecurityAnalysis.maxScore} for domain{" "}
                {report.emailSecurityAnalysis.domain}.
              </Text>
              <Text style={styles.summaryBullet}>
                • SPF policy: {report.emailSecurityAnalysis.spf.policy} · DNS lookups:{" "}
                {report.emailSecurityAnalysis.spf.dnsLookupCount}/{report.emailSecurityAnalysis.spf.lookupLimit}
                {report.emailSecurityAnalysis.spf.tooManyLookups ? " (too many)" : ""}.
              </Text>
              <Text style={styles.summaryBullet}>
                • DMARC policy: {report.emailSecurityAnalysis.dmarc.policy} · rua{" "}
                {report.emailSecurityAnalysis.dmarc.rua.length > 0
                  ? report.emailSecurityAnalysis.dmarc.rua.join(", ")
                  : "missing"}{" "}
                · ruf{" "}
                {report.emailSecurityAnalysis.dmarc.ruf.length > 0
                  ? report.emailSecurityAnalysis.dmarc.ruf.join(", ")
                  : "missing"}
                .
              </Text>
              <Text style={styles.summaryBullet}>
                • DKIM selectors detected:{" "}
                {report.emailSecurityAnalysis.dkim.presentSelectors.length > 0
                  ? report.emailSecurityAnalysis.dkim.presentSelectors.join(", ")
                  : "none"}
                .
              </Text>
              {report.emailSecurityAnalysis.findings.length > 0 ? (
                report.emailSecurityAnalysis.findings.slice(0, 4).map((finding, index) => (
                  <Text key={`email-security-finding-${finding.id}-${index}`} style={styles.summaryBullet}>
                    • {finding.severity.toUpperCase()}: {finding.message}
                  </Text>
                ))
              ) : (
                <Text style={styles.summaryBullet}>• No high-risk email authentication findings were detected.</Text>
              )}
            </>
          ) : (
            <Text style={styles.summaryText}>Email security analysis details were not available for this report snapshot.</Text>
          )}
        </View>

        <View style={styles.summarySection}>
          <Text style={styles.sectionTitle}>Mixed Content Analysis</Text>
          <Text style={styles.summaryText}>
            {report.mixedContentAnalysis?.summary ?? "Mixed-content analysis details were not available for this report snapshot."}
          </Text>
          {report.mixedContentAnalysis ? (
            <>
              <Text style={styles.summaryBullet}>
                • Grade {report.mixedContentAnalysis.grade} ({report.mixedContentAnalysis.score}/
                {report.mixedContentAnalysis.maxScore}) · Active {report.mixedContentAnalysis.activeCount} · Passive{" "}
                {report.mixedContentAnalysis.passiveCount}.
              </Text>
              {report.mixedContentAnalysis.findings.length > 0 ? (
                report.mixedContentAnalysis.findings.slice(0, 6).map((finding) => (
                  <Text key={finding.id} style={styles.summaryBullet}>
                    • {finding.severity.toUpperCase()} {finding.element} ({finding.attribute}): {finding.url}
                  </Text>
                ))
              ) : (
                <Text style={styles.summaryBullet}>• No mixed-content resource references were detected.</Text>
              )}
            </>
          ) : (
            <Text style={styles.summaryBullet}>• No mixed-content analysis data was captured.</Text>
          )}
        </View>

        <View style={styles.summarySection}>
          <Text style={styles.sectionTitle}>TLS / SSL Analysis</Text>
          <Text style={styles.summaryText}>
            {report.tlsAnalysis?.summary ?? "TLS analysis details were not available for this report snapshot."}
          </Text>
          {report.tlsAnalysis ? (
            <>
              <Text style={styles.summaryBullet}>
                • Grade {report.tlsAnalysis.grade} ({report.tlsAnalysis.score}/{report.tlsAnalysis.maxScore}) · Version{" "}
                {report.tlsAnalysis.tlsVersion ?? "Unknown"} · Cipher {report.tlsAnalysis.cipherName ?? "Unknown"}.
              </Text>
              <Text style={styles.summaryBullet}>
                • Issuer: {report.tlsAnalysis.issuer ?? "Unknown"} · Chain:{" "}
                {report.tlsAnalysis.chainComplete ? "complete" : "incomplete"} · Self-signed:{" "}
                {report.tlsAnalysis.selfSigned ? "yes" : "no"}.
              </Text>
              {report.tlsAnalysis.findings.length > 0 ? (
                report.tlsAnalysis.findings.slice(0, 4).map((finding, index) => (
                  <Text key={`${finding.id}-${index}`} style={styles.summaryBullet}>
                    • {finding.severity.toUpperCase()}: {finding.message}
                  </Text>
                ))
              ) : (
                <Text style={styles.summaryBullet}>• No risky TLS findings were detected.</Text>
              )}
            </>
          ) : (
            <Text style={styles.summaryBullet}>• No TLS analysis data was captured.</Text>
          )}
        </View>

        <View style={styles.summarySection}>
          <Text style={styles.sectionTitle}>DNS Security Analysis</Text>
          <Text style={styles.summaryText}>
            {report.dnsAnalysis?.summary ?? "DNS analysis details were not available for this report snapshot."}
          </Text>
          {report.dnsAnalysis ? (
            <>
              <Text style={styles.summaryBullet}>
                • Grade {report.dnsAnalysis.grade} ({report.dnsAnalysis.score}/{report.dnsAnalysis.maxScore}) · DNSSEC{" "}
                {report.dnsAnalysis.dnssecStatus} · CAA{" "}
                {report.dnsAnalysis.hasCaa ? "configured" : "not configured"}.
              </Text>
              <Text style={styles.summaryBullet}>
                • SPF {report.dnsAnalysis.spfPolicy} · DMARC {report.dnsAnalysis.dmarcPolicy}
                {typeof report.dnsAnalysis.dmarcPct === "number" ? ` (${report.dnsAnalysis.dmarcPct}%)` : ""} · Avg DNS{" "}
                {typeof report.dnsAnalysis.responseTimes.averageMs === "number"
                  ? `${report.dnsAnalysis.responseTimes.averageMs} ms`
                  : "unknown"}
                .
              </Text>
              {report.dnsAnalysis.findings.length > 0 ? (
                report.dnsAnalysis.findings.slice(0, 4).map((finding, index) => (
                  <Text key={`${finding.id}-${index}`} style={styles.summaryBullet}>
                    • {finding.severity.toUpperCase()}: {finding.message}
                  </Text>
                ))
              ) : (
                <Text style={styles.summaryBullet}>• No risky DNS findings were detected.</Text>
              )}
            </>
          ) : (
            <Text style={styles.summaryBullet}>• No DNS analysis data was captured.</Text>
          )}
        </View>

        <View style={styles.summarySection}>
          <Text style={styles.sectionTitle}>DNSSEC Analysis</Text>
          <Text style={styles.summaryText}>
            {report.dnssecAnalysis?.summary ?? "DNSSEC analysis details were not available for this report snapshot."}
          </Text>
          {report.dnssecAnalysis ? (
            <>
              <Text style={styles.summaryBullet}>
                • Grade {report.dnssecAnalysis.grade} ({report.dnssecAnalysis.score}/{report.dnssecAnalysis.maxScore}) ·
                Status {report.dnssecAnalysis.status} · DNSKEY {report.dnssecAnalysis.dnskeyRecordCount} · DS{" "}
                {report.dnssecAnalysis.dsRecordCount}.
              </Text>
              <Text style={styles.summaryBullet}>
                • Zone signed: {report.dnssecAnalysis.zoneSigned ? "yes" : "no"} · Parent DS:{" "}
                {report.dnssecAnalysis.parentHasDs ? "yes" : "no"} · Chain valid:{" "}
                {report.dnssecAnalysis.chainValid ? "yes" : "no"}.
              </Text>
              {report.dnssecAnalysis.findings.length > 0 ? (
                report.dnssecAnalysis.findings.slice(0, 4).map((finding, index) => (
                  <Text key={`dnssec-finding-${finding.id}-${index}`} style={styles.summaryBullet}>
                    • {finding.severity.toUpperCase()}: {finding.message}
                  </Text>
                ))
              ) : (
                <Text style={styles.summaryBullet}>• No risky DNSSEC findings were detected.</Text>
              )}
            </>
          ) : (
            <Text style={styles.summaryBullet}>• No DNSSEC analysis data was captured.</Text>
          )}
        </View>

        <View style={styles.summarySection}>
          <Text style={styles.sectionTitle}>CAA Analysis</Text>
          <Text style={styles.summaryText}>
            {report.caaAnalysis?.summary ?? "CAA analysis details were not available for this report snapshot."}
          </Text>
          {report.caaAnalysis ? (
            <>
              <Text style={styles.summaryBullet}>
                • Grade {report.caaAnalysis.grade} ({report.caaAnalysis.score}/{report.caaAnalysis.maxScore}) · Records{" "}
                {report.caaAnalysis.hasRecords ? "present" : "missing"} · Issuance restricted:{" "}
                {report.caaAnalysis.restrictsIssuance ? "yes" : "no"}.
              </Text>
              <Text style={styles.summaryBullet}>
                • Specific CAs only: {report.caaAnalysis.specificCaOnly ? "yes" : "no"} · Allowed CAs:{" "}
                {report.caaAnalysis.allowedCertificateAuthorities.length > 0
                  ? report.caaAnalysis.allowedCertificateAuthorities.join(", ")
                  : "none"}
                .
              </Text>
              {report.caaAnalysis.findings.length > 0 ? (
                report.caaAnalysis.findings.slice(0, 4).map((finding, index) => (
                  <Text key={`caa-finding-${finding.id}-${index}`} style={styles.summaryBullet}>
                    • {finding.severity.toUpperCase()}: {finding.message}
                  </Text>
                ))
              ) : (
                <Text style={styles.summaryBullet}>• No risky CAA findings were detected.</Text>
              )}
            </>
          ) : (
            <Text style={styles.summaryBullet}>• No CAA analysis data was captured.</Text>
          )}
        </View>

        <View style={styles.summarySection}>
          <Text style={styles.sectionTitle}>Subresource Integrity (SRI) Analysis</Text>
          <Text style={styles.summaryText}>
            {report.sriAnalysis?.summary ?? "SRI analysis details were not available for this report snapshot."}
          </Text>
          {report.sriAnalysis ? (
            <>
              <Text style={styles.summaryBullet}>
                • Grade {report.sriAnalysis.grade} ({report.sriAnalysis.score}/{report.sriAnalysis.maxScore}) · Coverage{" "}
                {report.sriAnalysis.coveragePercent}% · Crossorigin coverage {report.sriAnalysis.crossoriginCoveragePercent}%.
              </Text>
              <Text style={styles.summaryBullet}>
                • External resources: {report.sriAnalysis.externalResourceCount} · Missing integrity:{" "}
                {report.sriAnalysis.missingIntegrityCount} · Missing crossorigin: {report.sriAnalysis.missingCrossoriginCount}.
              </Text>
              {report.sriAnalysis.resources.length > 0 ? (
                report.sriAnalysis.resources.slice(0, 6).map((resource) => (
                  <Text key={resource.id} style={styles.summaryBullet}>
                    • {resource.resourceType.toUpperCase()} {resource.hasIntegrity ? "SRI" : "NO-SRI"} /{" "}
                    {resource.hasCrossorigin ? "crossorigin" : "no-crossorigin"}: {resource.url}
                  </Text>
                ))
              ) : (
                <Text style={styles.summaryBullet}>• No external scripts/stylesheets were detected on this page.</Text>
              )}
            </>
          ) : (
            <Text style={styles.summaryBullet}>• No SRI analysis data was captured.</Text>
          )}
        </View>

        <View style={styles.summarySection}>
          <Text style={styles.sectionTitle}>security.txt Analysis</Text>
          <Text style={styles.summaryText}>
            {report.securityTxtAnalysis?.summary ?? "security.txt analysis details were not available for this report snapshot."}
          </Text>
          {report.securityTxtAnalysis ? (
            <>
              <Text style={styles.summaryBullet}>
                • Grade {report.securityTxtAnalysis.grade} ({report.securityTxtAnalysis.score}/
                {report.securityTxtAnalysis.maxScore}) · Present{" "}
                {report.securityTxtAnalysis.validation.present ? "yes" : "no"} · HTTPS{" "}
                {report.securityTxtAnalysis.validation.usesHttps ? "yes" : "no"} · Valid{" "}
                {report.securityTxtAnalysis.validation.isValid ? "yes" : "no"}.
              </Text>
              <Text style={styles.summaryBullet}>
                • Contact{" "}
                {report.securityTxtAnalysis.fields.contact.length > 0
                  ? report.securityTxtAnalysis.fields.contact.join(", ")
                  : "missing"}{" "}
                · Expires {report.securityTxtAnalysis.fields.expires ?? "missing"}.
              </Text>
              {report.securityTxtAnalysis.warnings.length > 0 ? (
                report.securityTxtAnalysis.warnings.slice(0, 4).map((warning, index) => (
                  <Text key={`security-txt-warning-${index}`} style={styles.summaryBullet}>
                    • WARNING: {warning}
                  </Text>
                ))
              ) : (
                <Text style={styles.summaryBullet}>• No security.txt validation warnings were detected.</Text>
              )}
            </>
          ) : (
            <Text style={styles.summaryBullet}>• No security.txt analysis data was captured.</Text>
          )}
        </View>

        <View style={styles.summarySection}>
          <Text style={styles.sectionTitle}>HSTS Preload Analysis</Text>
          <Text style={styles.summaryText}>
            {report.hstsPreloadAnalysis?.summary ?? "HSTS preload analysis details were not available for this report snapshot."}
          </Text>
          {report.hstsPreloadAnalysis ? (
            <>
              <Text style={styles.summaryBullet}>
                • Grade {report.hstsPreloadAnalysis.grade} ({report.hstsPreloadAnalysis.score}/
                {report.hstsPreloadAnalysis.maxScore}) · Status {report.hstsPreloadAnalysis.status} · Eligibility{" "}
                {report.hstsPreloadAnalysis.eligibility}.
              </Text>
              <Text style={styles.summaryBullet}>
                • Header checks: max-age{" "}
                {report.hstsPreloadAnalysis.header.hasSufficientMaxAge ? "pass" : "fail"} · includeSubDomains{" "}
                {report.hstsPreloadAnalysis.header.hasIncludeSubDomains ? "pass" : "fail"} · preload{" "}
                {report.hstsPreloadAnalysis.header.hasPreloadDirective ? "pass" : "fail"}.
              </Text>
              {report.hstsPreloadAnalysis.findings.length > 0 ? (
                report.hstsPreloadAnalysis.findings.slice(0, 4).map((finding, index) => (
                  <Text key={`hsts-preload-finding-${finding.id}-${index}`} style={styles.summaryBullet}>
                    • {finding.severity.toUpperCase()}: {finding.message}
                  </Text>
                ))
              ) : (
                <Text style={styles.summaryBullet}>• No HSTS preload findings were detected.</Text>
              )}
            </>
          ) : (
            <Text style={styles.summaryBullet}>• No HSTS preload analysis data was captured.</Text>
          )}
        </View>

        <Text style={styles.sectionTitle}>Detailed Header Breakdown</Text>
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={[styles.tableHeaderCell, styles.headerNameCol]}>Header</Text>
            <Text style={[styles.tableHeaderCell, styles.statusCol]}>Status</Text>
            <Text style={[styles.tableHeaderCell, styles.valueCol]}>Current value</Text>
            <Text style={[styles.tableHeaderCell, styles.rationaleCol]}>Why it matters</Text>
            <Text style={[styles.tableHeaderCell, styles.recommendationCol]}>Recommendation</Text>
          </View>
          {report.results.map((result, index) => (
            <View
              key={result.key}
              style={index === report.results.length - 1 ? [styles.tableRow, styles.tableRowLast] : styles.tableRow}
            >
              <Text style={[styles.tableCell, styles.headerNameCol, styles.headerLabelText]}>{result.label}</Text>
              <Text style={[styles.tableCell, styles.statusCol]}>{result.status.toUpperCase()}</Text>
              <Text style={[styles.tableCell, styles.valueCol]}>{result.value ?? "Missing"}</Text>
              <Text style={[styles.tableCell, styles.rationaleCol]}>{result.whyItMatters}</Text>
              <Text style={[styles.tableCell, styles.recommendationCol]}>{result.guidance}</Text>
            </View>
          ))}
        </View>

        <View style={styles.recommendationsSection}>
          <Text style={styles.sectionTitle}>Recommendations</Text>
          {recommendations.length === 0 ? (
            <Text style={styles.recommendationMuted}>
              No missing or weak security headers were detected. Keep this baseline in CI and monitor for regressions.
            </Text>
          ) : (
            recommendations.map((item, index) => (
              <Text key={item.key} style={styles.recommendationItem}>
                {index + 1}. {item.label} ({statusLabel(item.status)}, {riskLabel(item.riskLevel)} risk): {item.guidance}
              </Text>
            ))
          )}
        </View>

        <View style={styles.footer} fixed>
          <Text>{SITE_NAME}</Text>
          <Text style={styles.footerRight} render={({ pageNumber, totalPages }) => `Page ${pageNumber}/${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}

export async function buildSecurityReportPdfBlob(report: ReportResponse): Promise<Blob> {
  const generatedAt = new Date().toISOString();
  return pdf(<SecurityReportDocument report={report} generatedAt={generatedAt} />).toBlob();
}

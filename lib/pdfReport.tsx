import React from "react";
import { Document, Page, StyleSheet, Text, View, pdf } from "@react-pdf/renderer";
import type { HeaderResult } from "@/lib/securityHeaders";
import { SITE_NAME } from "@/lib/seo";

type ReportResponse = {
  checkedUrl: string;
  finalUrl: string;
  statusCode: number;
  score: number;
  grade: string;
  results: HeaderResult[];
  checkedAt: string;
};

const styles = StyleSheet.create({
  page: {
    paddingTop: 36,
    paddingBottom: 36,
    paddingHorizontal: 34,
    fontSize: 10,
    color: "#0f172a",
    fontFamily: "Helvetica"
  },
  header: {
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
    paddingBottom: 10
  },
  brandName: {
    fontSize: 15,
    fontWeight: 700,
    color: "#0369a1"
  },
  reportTitle: {
    marginTop: 4,
    fontSize: 11,
    color: "#1e293b"
  },
  metadataGrid: {
    marginTop: 4,
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
    flexDirection: "row",
    gap: 8
  },
  highlightCard: {
    flexGrow: 1,
    flexBasis: 0,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 4,
    padding: 8
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
    borderColor: "#cbd5e1",
    borderRadius: 4,
    padding: 8,
    backgroundColor: "#f8fafc"
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

function formatTimestamp(input: string) {
  const date = new Date(input);
  if (!Number.isFinite(date.getTime())) return input;
  return date.toLocaleString();
}

function SecurityReportDocument({ report, generatedAt }: { report: ReportResponse; generatedAt: string }) {
  const statusSummary = summaryLine(report.results);

  return (
    <Document title={`${SITE_NAME} Report`} author={SITE_NAME} subject="Security header scan report">
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.brandName}>{SITE_NAME}</Text>
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
          <View style={styles.highlightCard}>
            <Text style={styles.highlightLabel}>Score</Text>
            <Text style={styles.highlightValue}>
              {report.score}/{report.results.length * 2}
            </Text>
            <Text style={styles.highlightSubtext}>Weighted header score</Text>
          </View>
        </View>

        <View style={styles.summarySection}>
          <Text style={styles.sectionTitle}>Summary</Text>
          <Text style={styles.summaryText}>
            Strong headers: {statusSummary.good} · Weak headers: {statusSummary.weak} · Missing headers:{" "}
            {statusSummary.missing}
          </Text>
          <Text style={styles.summaryText}>
            Focus first on missing and weak headers to improve browser-side defenses and overall grade.
          </Text>
        </View>

        <Text style={styles.sectionTitle}>Header Findings</Text>
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
              style={[styles.tableRow, index === report.results.length - 1 ? styles.tableRowLast : null]}
            >
              <Text style={[styles.tableCell, styles.headerNameCol, styles.headerLabelText]}>{result.label}</Text>
              <Text style={[styles.tableCell, styles.statusCol]}>{result.status.toUpperCase()}</Text>
              <Text style={[styles.tableCell, styles.valueCol]}>{result.value ?? "Missing"}</Text>
              <Text style={[styles.tableCell, styles.rationaleCol]}>{result.whyItMatters}</Text>
              <Text style={[styles.tableCell, styles.recommendationCol]}>{result.guidance}</Text>
            </View>
          ))}
        </View>

        <View style={styles.footer} fixed>
          <Text>{SITE_NAME}</Text>
          <Text>Generated {formatTimestamp(generatedAt)}</Text>
        </View>
      </Page>
    </Document>
  );
}

export async function buildSecurityReportPdfBlob(report: ReportResponse): Promise<Blob> {
  const generatedAt = new Date().toISOString();
  return pdf(<SecurityReportDocument report={report} generatedAt={generatedAt} />).toBlob();
}

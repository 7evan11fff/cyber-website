import React from "react";
import { Document, Page, StyleSheet, Text, View, pdf } from "@react-pdf/renderer";
import { SITE_NAME } from "@/lib/seo";

export type TrendReportSummary = {
  totalDomains: number;
  averageGrade: string;
  averageScore: number | null;
  improvedThisWeek: number;
  regressedThisWeek: number;
};

export type TrendReportDomain = {
  domain: string;
  latestGrade: string;
  latestCheckedAt: string | null;
  change7Percent: number | null;
  change30Percent: number | null;
  recentChanges: string[];
};

const styles = StyleSheet.create({
  page: {
    paddingTop: 30,
    paddingBottom: 30,
    paddingHorizontal: 28,
    fontSize: 9,
    color: "#0f172a",
    fontFamily: "Helvetica"
  },
  header: {
    marginBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#dbe2ea",
    paddingBottom: 8
  },
  brand: {
    fontSize: 14,
    fontWeight: 700,
    color: "#0f4c81"
  },
  subtitle: {
    marginTop: 2,
    color: "#334155"
  },
  section: {
    marginTop: 10
  },
  sectionTitle: {
    fontSize: 10,
    fontWeight: 700,
    marginBottom: 6
  },
  statRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6
  },
  statCard: {
    width: "48%",
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 6
  },
  statLabel: {
    textTransform: "uppercase",
    color: "#475569",
    fontSize: 8
  },
  statValue: {
    marginTop: 2,
    fontSize: 13,
    fontWeight: 700,
    color: "#0f172a"
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
  row: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0"
  },
  rowLast: {
    borderBottomWidth: 0
  },
  cell: {
    paddingHorizontal: 6,
    paddingVertical: 5
  },
  headerCell: {
    fontWeight: 700,
    fontSize: 8
  },
  domainCol: {
    width: "28%"
  },
  gradeCol: {
    width: "10%"
  },
  dateCol: {
    width: "21%"
  },
  trendCol: {
    width: "12%"
  },
  changeCol: {
    width: "29%"
  },
  changeText: {
    color: "#334155"
  },
  footer: {
    position: "absolute",
    left: 28,
    right: 28,
    bottom: 14,
    borderTopWidth: 1,
    borderTopColor: "#dbe2ea",
    paddingTop: 5,
    fontSize: 8,
    color: "#64748b",
    flexDirection: "row",
    justifyContent: "space-between"
  }
});

function formatDate(value: string | null): string {
  if (!value) return "N/A";
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) return value;
  return parsed.toLocaleString();
}

function formatPercent(value: number | null): string {
  if (value === null) return "N/A";
  const prefix = value > 0 ? "+" : "";
  return `${prefix}${value.toFixed(1)}%`;
}

function TrendsDocument({
  generatedAt,
  summary,
  domains
}: {
  generatedAt: string;
  summary: TrendReportSummary;
  domains: TrendReportDomain[];
}) {
  return (
    <Document title={`${SITE_NAME} Trend Report`} author={SITE_NAME} subject="Watchlist trend report">
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.brand}>{SITE_NAME}</Text>
          <Text style={styles.subtitle}>Watchlist Trend Report</Text>
          <Text style={styles.subtitle}>Generated {formatDate(generatedAt)}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Summary</Text>
          <View style={styles.statRow}>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>Domains monitored</Text>
              <Text style={styles.statValue}>{String(summary.totalDomains)}</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>Average grade</Text>
              <Text style={styles.statValue}>
                {summary.averageGrade}
                {summary.averageScore !== null ? ` (${summary.averageScore.toFixed(2)}/5)` : ""}
              </Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>Improved this week</Text>
              <Text style={styles.statValue}>{String(summary.improvedThisWeek)}</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>Regressed this week</Text>
              <Text style={styles.statValue}>{String(summary.regressedThisWeek)}</Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Domain trends</Text>
          <View style={styles.table}>
            <View style={styles.tableHeader}>
              <Text style={[styles.cell, styles.headerCell, styles.domainCol]}>Domain</Text>
              <Text style={[styles.cell, styles.headerCell, styles.gradeCol]}>Grade</Text>
              <Text style={[styles.cell, styles.headerCell, styles.dateCol]}>Last checked</Text>
              <Text style={[styles.cell, styles.headerCell, styles.trendCol]}>7d</Text>
              <Text style={[styles.cell, styles.headerCell, styles.trendCol]}>30d</Text>
              <Text style={[styles.cell, styles.headerCell, styles.changeCol]}>Recent header changes</Text>
            </View>
            {domains.slice(0, 20).map((domain, index) => (
              <View
                key={`${domain.domain}-${domain.latestCheckedAt ?? "na"}-${index}`}
                style={index === Math.min(20, domains.length) - 1 ? [styles.row, styles.rowLast] : styles.row}
              >
                <Text style={[styles.cell, styles.domainCol]}>{domain.domain}</Text>
                <Text style={[styles.cell, styles.gradeCol]}>{domain.latestGrade}</Text>
                <Text style={[styles.cell, styles.dateCol]}>{formatDate(domain.latestCheckedAt)}</Text>
                <Text style={[styles.cell, styles.trendCol]}>{formatPercent(domain.change7Percent)}</Text>
                <Text style={[styles.cell, styles.trendCol]}>{formatPercent(domain.change30Percent)}</Text>
                <Text style={[styles.cell, styles.changeCol, styles.changeText]}>
                  {domain.recentChanges.length > 0 ? domain.recentChanges.slice(0, 2).join(" | ") : "No changes"}
                </Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.footer} fixed>
          <Text>{SITE_NAME}</Text>
          <Text>Generated {formatDate(generatedAt)}</Text>
        </View>
      </Page>
    </Document>
  );
}

export async function buildTrendReportPdfBlob(input: {
  summary: TrendReportSummary;
  domains: TrendReportDomain[];
}): Promise<Blob> {
  const generatedAt = new Date().toISOString();
  return pdf(<TrendsDocument generatedAt={generatedAt} summary={input.summary} domains={input.domains} />).toBlob();
}

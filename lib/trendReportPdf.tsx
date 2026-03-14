import React from "react";
import { Document, Page, StyleSheet, Text, View, pdf } from "@react-pdf/renderer";
import { SITE_NAME } from "@/lib/seo";
import type { AggregateTrendStats, DomainTrendSummary, TrendWindowSummary } from "@/lib/watchlistTrends";

const styles = StyleSheet.create({
  page: {
    paddingTop: 30,
    paddingBottom: 30,
    paddingHorizontal: 28,
    fontSize: 10,
    fontFamily: "Helvetica",
    color: "#0f172a"
  },
  header: {
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#cbd5e1",
    paddingBottom: 8
  },
  brand: {
    fontSize: 15,
    fontWeight: 700,
    color: "#0c4a6e"
  },
  title: {
    marginTop: 3,
    fontSize: 11,
    color: "#334155"
  },
  section: {
    marginTop: 12
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: 700,
    marginBottom: 6
  },
  statsGrid: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 4
  },
  statsRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0"
  },
  statsRowLast: {
    flexDirection: "row"
  },
  statsKey: {
    width: "55%",
    paddingHorizontal: 8,
    paddingVertical: 6,
    backgroundColor: "#f8fafc",
    color: "#334155",
    fontWeight: 700
  },
  statsValue: {
    width: "45%",
    paddingHorizontal: 8,
    paddingVertical: 6
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
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0"
  },
  tableRowLast: {
    borderBottomWidth: 0
  },
  headerCell: {
    paddingHorizontal: 6,
    paddingVertical: 6,
    fontSize: 9,
    fontWeight: 700
  },
  cell: {
    paddingHorizontal: 6,
    paddingVertical: 6,
    fontSize: 9
  },
  domainCol: {
    width: "36%"
  },
  gradeCol: {
    width: "12%"
  },
  trendCol: {
    width: "16%"
  },
  statusCol: {
    width: "18%"
  },
  timelineCol: {
    width: "18%"
  },
  note: {
    marginTop: 6,
    color: "#475569"
  },
  timelineDomain: {
    marginTop: 6,
    fontSize: 10,
    fontWeight: 700,
    color: "#1e293b"
  },
  timelineItem: {
    marginTop: 2,
    color: "#334155"
  },
  footer: {
    position: "absolute",
    left: 28,
    right: 28,
    bottom: 14,
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
    paddingTop: 5,
    fontSize: 8,
    color: "#64748b",
    flexDirection: "row",
    justifyContent: "space-between"
  }
});

function formatTimestamp(input: string | null) {
  if (!input) return "--";
  const date = new Date(input);
  if (!Number.isFinite(date.getTime())) return input;
  return date.toLocaleString();
}

function formatTrendWindow(window: TrendWindowSummary): string {
  if (!window.hasEnoughData || window.percentChange === null) {
    return "No baseline";
  }
  const prefix = window.percentChange > 0 ? "+" : "";
  return `${prefix}${window.percentChange.toFixed(1)}%`;
}

function trendDirectionLabel(window: TrendWindowSummary): string {
  if (!window.hasEnoughData || window.percentChange === null) return "Collecting";
  if (window.direction === "improving") return "Improving";
  if (window.direction === "degrading") return "Regressing";
  return "Stable";
}

function TrendReportDocument({
  aggregate,
  domains,
  generatedAt
}: {
  aggregate: AggregateTrendStats;
  domains: DomainTrendSummary[];
  generatedAt: string;
}) {
  return (
    <Document title={`${SITE_NAME} Watchlist Trend Report`} author={SITE_NAME} subject="Watchlist trend report">
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.brand}>{SITE_NAME}</Text>
          <Text style={styles.title}>Watchlist Trend Report</Text>
          <Text style={styles.note}>Generated {formatTimestamp(generatedAt)}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Dashboard summary</Text>
          <View style={styles.statsGrid}>
            <View style={styles.statsRow}>
              <Text style={styles.statsKey}>Total domains monitored</Text>
              <Text style={styles.statsValue}>{String(aggregate.totalDomainsMonitored)}</Text>
            </View>
            <View style={styles.statsRow}>
              <Text style={styles.statsKey}>Average grade</Text>
              <Text style={styles.statsValue}>
                {aggregate.averageGrade}
                {aggregate.averageScore !== null ? ` (${aggregate.averageScore.toFixed(2)}/5)` : ""}
              </Text>
            </View>
            <View style={styles.statsRow}>
              <Text style={styles.statsKey}>Improved this week</Text>
              <Text style={styles.statsValue}>{String(aggregate.improvedThisWeek)}</Text>
            </View>
            <View style={styles.statsRowLast}>
              <Text style={styles.statsKey}>Regressed this week</Text>
              <Text style={styles.statsValue}>{String(aggregate.regressedThisWeek)}</Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Domain trends</Text>
          <View style={styles.table}>
            <View style={styles.tableHeader}>
              <Text style={[styles.headerCell, styles.domainCol]}>Domain</Text>
              <Text style={[styles.headerCell, styles.gradeCol]}>Grade</Text>
              <Text style={[styles.headerCell, styles.trendCol]}>7d</Text>
              <Text style={[styles.headerCell, styles.trendCol]}>30d</Text>
              <Text style={[styles.headerCell, styles.statusCol]}>Status</Text>
              <Text style={[styles.headerCell, styles.timelineCol]}>Timeline</Text>
            </View>
            {domains.map((domain, index) => (
              <View
                key={`trend-domain-${domain.domain}`}
                style={index === domains.length - 1 ? [styles.tableRow, styles.tableRowLast] : styles.tableRow}
              >
                <Text style={[styles.cell, styles.domainCol]}>{domain.domain}</Text>
                <Text style={[styles.cell, styles.gradeCol]}>{domain.latestGrade ?? "--"}</Text>
                <Text style={[styles.cell, styles.trendCol]}>{formatTrendWindow(domain.trend7d)}</Text>
                <Text style={[styles.cell, styles.trendCol]}>{formatTrendWindow(domain.trend30d)}</Text>
                <Text style={[styles.cell, styles.statusCol]}>{trendDirectionLabel(domain.trend7d)}</Text>
                <Text style={[styles.cell, styles.timelineCol]}>{`${domain.timeline.length} points`}</Text>
              </View>
            ))}
          </View>
          <Text style={styles.note}>7d/30d values indicate percentage score change within each time window.</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recent timeline highlights</Text>
          {domains.slice(0, 6).map((domain) => (
            <View key={`timeline-${domain.domain}`}>
              <Text style={styles.timelineDomain}>{domain.domain}</Text>
              {domain.timeline.slice(0, 3).map((item) => (
                <Text key={`${domain.domain}-${item.checkedAt}`} style={styles.timelineItem}>
                  {formatTimestamp(item.checkedAt)} | Grade {item.grade} | Header changes: {String(item.headerChanges.length)}
                </Text>
              ))}
            </View>
          ))}
        </View>

        <View style={styles.footer} fixed>
          <Text>{SITE_NAME}</Text>
          <Text>{`Generated ${formatTimestamp(generatedAt)}`}</Text>
        </View>
      </Page>
    </Document>
  );
}

export async function buildWatchlistTrendReportPdfBlob({
  aggregate,
  domains
}: {
  aggregate: AggregateTrendStats;
  domains: DomainTrendSummary[];
}): Promise<Blob> {
  const generatedAt = new Date().toISOString();
  return pdf(<TrendReportDocument aggregate={aggregate} domains={domains} generatedAt={generatedAt} />).toBlob();
}

import * as React from "react";
import type { DigestFrequency } from "@/lib/userData";
import type { DigestSummary } from "@/lib/digestEmail";

type WatchlistDigestEmailTemplateProps = {
  frequency: DigestFrequency;
  summary: DigestSummary;
  dashboardUrl: string;
  watchlistUrl: string;
  settingsUrl: string;
  unsubscribeUrl: string;
  siteUrl: string;
};

function getFrequencyLabel(frequency: DigestFrequency) {
  if (frequency === "monthly") return "Monthly digest";
  return "Weekly digest";
}

function getDirectionStyles(direction: "improved" | "regressed" | "changed") {
  if (direction === "improved") {
    return { label: "Improved", color: "#34d399" };
  }
  if (direction === "regressed") {
    return { label: "Regressed", color: "#fb7185" };
  }
  return { label: "Changed", color: "#cbd5e1" };
}

export function WatchlistDigestEmailTemplate({
  frequency,
  summary,
  dashboardUrl,
  watchlistUrl,
  settingsUrl,
  unsubscribeUrl,
  siteUrl
}: WatchlistDigestEmailTemplateProps) {
  const frequencyLabel = getFrequencyLabel(frequency);

  return (
    <div
      style={{
        margin: 0,
        padding: "20px 0",
        backgroundColor: "#020617",
        color: "#e2e8f0",
        fontFamily: "Inter, Arial, sans-serif"
      }}
    >
      <table
        role="presentation"
        width="100%"
        cellPadding={0}
        cellSpacing={0}
        style={{ maxWidth: "640px", margin: "0 auto", padding: "0 12px" }}
      >
        <tbody>
          <tr>
            <td>
              <div
                style={{
                  border: "1px solid #1e293b",
                  borderRadius: "14px",
                  overflow: "hidden",
                  backgroundColor: "#0f172a"
                }}
              >
                <div
                  style={{
                    padding: "22px 24px",
                    borderBottom: "1px solid #1e293b",
                    background: "linear-gradient(135deg, #0f172a 0%, #082f49 100%)"
                  }}
                >
                  <p style={{ margin: 0, color: "#7dd3fc", fontSize: "12px", letterSpacing: "0.14em" }}>
                    SECURITY HEADER CHECKER
                  </p>
                  <h1 style={{ margin: "10px 0 0", color: "#f8fafc", fontSize: "22px", lineHeight: 1.3 }}>
                    {frequencyLabel} watchlist report
                  </h1>
                  <p style={{ margin: "10px 0 0", color: "#cbd5e1", fontSize: "14px" }}>
                    Your latest summary across {summary.stats.totalDomainsMonitored} monitored domains.
                  </p>
                </div>

                <div style={{ padding: "22px 24px" }}>
                  <table role="presentation" width="100%" cellPadding={0} cellSpacing={0}>
                    <tbody>
                      <tr>
                        <td
                          style={{
                            width: "33%",
                            border: "1px solid #1e293b",
                            borderRadius: "10px",
                            backgroundColor: "#020617",
                            padding: "12px",
                            verticalAlign: "top"
                          }}
                        >
                          <p style={{ margin: 0, color: "#94a3b8", fontSize: "11px", textTransform: "uppercase" }}>
                            Total domains
                          </p>
                          <p style={{ margin: "8px 0 0", color: "#f8fafc", fontSize: "22px", fontWeight: 700 }}>
                            {summary.stats.totalDomainsMonitored}
                          </p>
                        </td>
                        <td style={{ width: "8px" }} />
                        <td
                          style={{
                            width: "33%",
                            border: "1px solid #1e293b",
                            borderRadius: "10px",
                            backgroundColor: "#020617",
                            padding: "12px",
                            verticalAlign: "top"
                          }}
                        >
                          <p style={{ margin: 0, color: "#94a3b8", fontSize: "11px", textTransform: "uppercase" }}>
                            Average grade
                          </p>
                          <p style={{ margin: "8px 0 0", color: "#f8fafc", fontSize: "22px", fontWeight: 700 }}>
                            {summary.stats.averageGrade}
                          </p>
                        </td>
                        <td style={{ width: "8px" }} />
                        <td
                          style={{
                            width: "33%",
                            border: "1px solid #1e293b",
                            borderRadius: "10px",
                            backgroundColor: "#020617",
                            padding: "12px",
                            verticalAlign: "top"
                          }}
                        >
                          <p style={{ margin: 0, color: "#94a3b8", fontSize: "11px", textTransform: "uppercase" }}>
                            Need attention
                          </p>
                          <p style={{ margin: "8px 0 0", color: "#f8fafc", fontSize: "22px", fontWeight: 700 }}>
                            {summary.stats.domainsNeedingAttention}
                          </p>
                        </td>
                      </tr>
                    </tbody>
                  </table>

                  <h2 style={{ margin: "24px 0 10px", color: "#f8fafc", fontSize: "16px" }}>Grade changes</h2>
                  {summary.changes.length === 0 ? (
                    <p
                      style={{
                        margin: 0,
                        color: "#cbd5e1",
                        fontSize: "14px",
                        border: "1px solid #1e293b",
                        borderRadius: "10px",
                        padding: "12px",
                        backgroundColor: "#020617"
                      }}
                    >
                      No grade changes since your last digest.
                    </p>
                  ) : (
                    <div style={{ border: "1px solid #1e293b", borderRadius: "10px", backgroundColor: "#020617" }}>
                      {summary.changes.map((change, index) => {
                        const style = getDirectionStyles(change.direction);
                        return (
                          <div
                            key={`${change.domain}-${change.currentGrade}-${index}`}
                            style={{
                              padding: "12px",
                              borderTop: index === 0 ? "none" : "1px solid #1e293b"
                            }}
                          >
                            <p style={{ margin: 0, color: "#f8fafc", fontSize: "14px", fontWeight: 600 }}>
                              {change.domain}
                            </p>
                            <p style={{ margin: "4px 0 0", color: "#cbd5e1", fontSize: "13px" }}>
                              {change.previousGrade} -&gt; {change.currentGrade}{" "}
                              <span style={{ color: style.color }}>({style.label})</span>
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  <h2 style={{ margin: "24px 0 10px", color: "#f8fafc", fontSize: "16px" }}>All watchlist domains</h2>
                  <div style={{ border: "1px solid #1e293b", borderRadius: "10px", overflow: "hidden" }}>
                    {summary.domains.length === 0 ? (
                      <p style={{ margin: 0, padding: "12px", color: "#cbd5e1", fontSize: "14px" }}>
                        No watchlist domains found.
                      </p>
                    ) : (
                      summary.domains.map((domain, index) => (
                        <div
                          key={`${domain.domain}-${domain.checkedAt}-${index}`}
                          style={{
                            padding: "12px",
                            backgroundColor: index % 2 === 0 ? "#020617" : "#030b1a",
                            borderTop: index === 0 ? "none" : "1px solid #1e293b"
                          }}
                        >
                          <p style={{ margin: 0, color: "#f8fafc", fontSize: "14px", fontWeight: 600 }}>
                            {domain.domain}
                          </p>
                          <p style={{ margin: "4px 0 0", color: "#cbd5e1", fontSize: "13px" }}>
                            Grade {domain.grade}
                            {domain.needsAttention ? (
                              <span style={{ color: "#fda4af" }}> • Needs attention</span>
                            ) : null}
                          </p>
                        </div>
                      ))
                    )}
                  </div>

                  <table role="presentation" cellPadding={0} cellSpacing={0} style={{ marginTop: "20px" }}>
                    <tbody>
                      <tr>
                        <td>
                          <a
                            href={dashboardUrl}
                            style={{
                              display: "inline-block",
                              padding: "10px 14px",
                              borderRadius: "8px",
                              border: "1px solid #38bdf8",
                              backgroundColor: "#0ea5e9",
                              color: "#082f49",
                              textDecoration: "none",
                              fontSize: "13px",
                              fontWeight: 700
                            }}
                          >
                            Open dashboard
                          </a>
                        </td>
                        <td style={{ width: "10px" }} />
                        <td>
                          <a
                            href={watchlistUrl}
                            style={{
                              display: "inline-block",
                              padding: "10px 14px",
                              borderRadius: "8px",
                              border: "1px solid #334155",
                              color: "#e2e8f0",
                              textDecoration: "none",
                              fontSize: "13px",
                              fontWeight: 600
                            }}
                          >
                            Review watchlist
                          </a>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <div style={{ padding: "14px 24px", borderTop: "1px solid #1e293b", color: "#94a3b8", fontSize: "12px" }}>
                  <p style={{ margin: 0 }}>
                    Sent by Security Header Checker from {siteUrl}. Manage preferences in{" "}
                    <a href={settingsUrl} style={{ color: "#7dd3fc" }}>
                      settings
                    </a>{" "}
                    or{" "}
                    <a href={unsubscribeUrl} style={{ color: "#7dd3fc" }}>
                      unsubscribe from digest emails
                    </a>
                    .
                  </p>
                </div>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

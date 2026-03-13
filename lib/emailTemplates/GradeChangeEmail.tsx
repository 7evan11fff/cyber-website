import * as React from "react";
import type { NotificationFrequency } from "@/lib/userData";

type GradeChangeEmailTemplateProps = {
  url: string;
  previousGrade: string;
  currentGrade: string;
  checkedAt: string;
  frequency: NotificationFrequency;
  dashboardUrl: string;
  siteUrl: string;
};

function getChangeDirection(previousGrade: string, currentGrade: string) {
  const rank: Record<string, number> = { A: 5, B: 4, C: 3, D: 2, F: 1 };
  const previous = rank[previousGrade.toUpperCase()] ?? 0;
  const current = rank[currentGrade.toUpperCase()] ?? 0;
  if (current > previous) return "improved";
  if (current < previous) return "regressed";
  return "changed";
}

function frequencyLabel(frequency: NotificationFrequency) {
  if (frequency === "daily") return "daily cadence";
  if (frequency === "weekly") return "weekly cadence";
  return "instant alerts";
}

export function GradeChangeEmailTemplate({
  url,
  previousGrade,
  currentGrade,
  checkedAt,
  frequency,
  dashboardUrl,
  siteUrl
}: GradeChangeEmailTemplateProps) {
  const direction = getChangeDirection(previousGrade, currentGrade);
  const checkedAtLabel = new Date(checkedAt).toLocaleString();
  const directionLabel =
    direction === "improved"
      ? "Grade improved"
      : direction === "regressed"
        ? "Grade regressed"
        : "Grade changed";

  return (
    <div
      style={{
        margin: 0,
        padding: "24px 0",
        backgroundColor: "#020617",
        color: "#e2e8f0",
        fontFamily: "Inter, Arial, sans-serif"
      }}
    >
      <div
        style={{
          maxWidth: "620px",
          margin: "0 auto",
          border: "1px solid #1e293b",
          borderRadius: "14px",
          backgroundColor: "#0f172a",
          overflow: "hidden"
        }}
      >
        <div
          style={{
            padding: "20px 24px",
            borderBottom: "1px solid #1e293b",
            background: "linear-gradient(135deg, #0f172a 0%, #082f49 100%)"
          }}
        >
          <p style={{ margin: 0, fontSize: "12px", letterSpacing: "0.12em", color: "#7dd3fc" }}>
            SECURITY HEADER CHECKER
          </p>
          <h1 style={{ margin: "10px 0 0", fontSize: "20px", color: "#f8fafc" }}>{directionLabel}</h1>
        </div>

        <div style={{ padding: "22px 24px" }}>
          <p style={{ margin: 0, color: "#cbd5e1" }}>
            A scheduled watchlist scan detected a grade update for one of your monitored domains.
          </p>

          <div
            style={{
              marginTop: "16px",
              border: "1px solid #1e293b",
              borderRadius: "10px",
              backgroundColor: "#020617",
              padding: "14px"
            }}
          >
            <p style={{ margin: "0 0 8px", fontSize: "12px", color: "#94a3b8" }}>Domain</p>
            <p style={{ margin: "0 0 14px", color: "#e2e8f0" }}>{url}</p>
            <p style={{ margin: "0 0 6px", fontSize: "12px", color: "#94a3b8" }}>Grade change</p>
            <p style={{ margin: 0, fontSize: "18px", color: "#f8fafc", fontWeight: 700 }}>
              {previousGrade.toUpperCase()} -&gt; {currentGrade.toUpperCase()}
            </p>
            <p style={{ margin: "10px 0 0", fontSize: "12px", color: "#94a3b8" }}>
              Checked at: {checkedAtLabel}
            </p>
          </div>

          <p style={{ margin: "16px 0 0", color: "#cbd5e1" }}>
            You are receiving this via your <strong>{frequencyLabel(frequency)}</strong> preference.
          </p>

          <a
            href={dashboardUrl}
            style={{
              display: "inline-block",
              marginTop: "18px",
              padding: "10px 14px",
              borderRadius: "8px",
              border: "1px solid #38bdf8",
              backgroundColor: "#0ea5e9",
              color: "#082f49",
              textDecoration: "none",
              fontWeight: 700
            }}
          >
            Open dashboard
          </a>
        </div>

        <div style={{ padding: "14px 24px", borderTop: "1px solid #1e293b", color: "#64748b", fontSize: "12px" }}>
          <p style={{ margin: 0 }}>
            Sent by Security Header Checker. Manage preferences in your settings at {siteUrl}.
          </p>
        </div>
      </div>
    </div>
  );
}

import "server-only";

import * as React from "react";
import { Resend } from "resend";
import type { DigestSummary } from "@/lib/digestEmail";
import { GradeChangeEmailTemplate } from "@/lib/emailTemplates/GradeChangeEmail";
import { WatchlistDigestEmailTemplate } from "@/lib/emailTemplates/WatchlistDigestEmail";
import type { DigestFrequency, NotificationFrequency } from "@/lib/userData";

const DEFAULT_FROM_EMAIL = "onboarding@resend.dev";
const FALLBACK_SITE_URL = "https://security-header-checker.vercel.app";

const THROTTLE_BY_FREQUENCY_MS: Record<NotificationFrequency, number> = {
  instant: 0,
  daily: 24 * 60 * 60 * 1000,
  weekly: 7 * 24 * 60 * 60 * 1000
};

function getResendClient() {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error("Missing RESEND_API_KEY. Email notifications are not configured.");
  }
  return new Resend(apiKey);
}

function resolveSiteUrl() {
  const configured = process.env.NEXT_PUBLIC_SITE_URL;
  if (!configured) return FALLBACK_SITE_URL;
  try {
    return new URL(configured).toString();
  } catch {
    return FALLBACK_SITE_URL;
  }
}

function getChangeDirection(previousGrade: string, currentGrade: string) {
  const rank: Record<string, number> = { A: 5, B: 4, C: 3, D: 2, F: 1 };
  const previous = rank[previousGrade.toUpperCase()] ?? 0;
  const current = rank[currentGrade.toUpperCase()] ?? 0;
  if (current > previous) return "improved";
  if (current < previous) return "regressed";
  return "changed";
}

function buildSubject(url: string, previousGrade: string, currentGrade: string) {
  const direction = getChangeDirection(previousGrade, currentGrade);
  if (direction === "improved") {
    return `Watchlist update: ${url} improved ${previousGrade.toUpperCase()} -> ${currentGrade.toUpperCase()}`;
  }
  if (direction === "regressed") {
    return `Watchlist alert: ${url} regressed ${previousGrade.toUpperCase()} -> ${currentGrade.toUpperCase()}`;
  }
  return `Watchlist update: ${url} changed ${previousGrade.toUpperCase()} -> ${currentGrade.toUpperCase()}`;
}

export function getNotificationThrottleMs(frequency: NotificationFrequency) {
  return THROTTLE_BY_FREQUENCY_MS[frequency] ?? 0;
}

export async function sendGradeChangeEmail({
  toEmail,
  url,
  previousGrade,
  currentGrade,
  checkedAt,
  frequency
}: {
  toEmail: string;
  url: string;
  previousGrade: string;
  currentGrade: string;
  checkedAt: string;
  frequency: NotificationFrequency;
}) {
  const resend = getResendClient();
  const siteUrl = resolveSiteUrl();
  const dashboardUrl = new URL("/dashboard", siteUrl).toString();
  const subject = buildSubject(url, previousGrade, currentGrade);
  const checkedAtLabel = new Date(checkedAt).toLocaleString();
  const from = process.env.RESEND_FROM_EMAIL || DEFAULT_FROM_EMAIL;

  const text = [
    "Security Header Checker watchlist alert",
    "",
    `URL: ${url}`,
    `Grade: ${previousGrade.toUpperCase()} -> ${currentGrade.toUpperCase()}`,
    `Checked at: ${checkedAtLabel}`,
    "",
    `Dashboard: ${dashboardUrl}`
  ].join("\n");

  const result = await resend.emails.send({
    from,
    to: [toEmail],
    subject,
    react: React.createElement(GradeChangeEmailTemplate, {
      url,
      previousGrade,
      currentGrade,
      checkedAt,
      frequency,
      dashboardUrl,
      siteUrl
    }),
    text
  });

  if (result.error) {
    throw new Error(result.error.message || "Unable to send grade change email.");
  }

  return result.data?.id ?? null;
}

function buildDigestSubject(frequency: Exclude<DigestFrequency, "off">) {
  if (frequency === "monthly") {
    return "Monthly watchlist digest report";
  }
  return "Weekly watchlist digest report";
}

export async function sendWatchlistDigestEmail({
  toEmail,
  frequency,
  summary
}: {
  toEmail: string;
  frequency: Exclude<DigestFrequency, "off">;
  summary: DigestSummary;
}) {
  const resend = getResendClient();
  const siteUrl = resolveSiteUrl();
  const dashboardUrl = new URL("/dashboard", siteUrl).toString();
  const watchlistUrl = new URL("/dashboard#watchlist", siteUrl).toString();
  const settingsUrl = new URL("/settings", siteUrl).toString();
  const unsubscribeUrl = new URL("/settings?digest=off", siteUrl).toString();
  const from = process.env.RESEND_FROM_EMAIL || DEFAULT_FROM_EMAIL;

  const text = [
    "Security Header Checker digest report",
    "",
    `Domains monitored: ${summary.stats.totalDomainsMonitored}`,
    `Average grade: ${summary.stats.averageGrade}`,
    `Domains needing attention (C or below): ${summary.stats.domainsNeedingAttention}`,
    "",
    summary.changes.length > 0
      ? "Grade changes since last digest:"
      : "No grade changes since last digest.",
    ...summary.changes.map(
      (change) => `- ${change.domain}: ${change.previousGrade} -> ${change.currentGrade}`
    ),
    "",
    `Dashboard: ${dashboardUrl}`,
    `Watchlist: ${watchlistUrl}`,
    `Unsubscribe: ${unsubscribeUrl}`
  ].join("\n");

  const result = await resend.emails.send({
    from,
    to: [toEmail],
    subject: buildDigestSubject(frequency),
    react: React.createElement(WatchlistDigestEmailTemplate, {
      frequency,
      summary,
      dashboardUrl,
      watchlistUrl,
      settingsUrl,
      unsubscribeUrl,
      siteUrl
    }),
    text
  });

  if (result.error) {
    throw new Error(result.error.message || "Unable to send watchlist digest email.");
  }

  return result.data?.id ?? null;
}

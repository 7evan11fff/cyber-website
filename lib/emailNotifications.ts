import "server-only";

import { Resend } from "resend";
import type { NotificationFrequency } from "@/lib/userData";

const DEFAULT_FROM_EMAIL = "Security Header Checker <onboarding@resend.dev>";
const FALLBACK_SITE_URL = "https://security-header-checker.vercel.app";

function getResendClient(): Resend {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error("Email notifications are not configured. Missing RESEND_API_KEY.");
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

export async function sendWatchlistGradeChangeEmail({
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
  const fromEmail = process.env.RESEND_FROM_EMAIL || DEFAULT_FROM_EMAIL;
  const dashboardLink = new URL("/dashboard", resolveSiteUrl()).toString();
  const checkedAtLabel = new Date(checkedAt).toLocaleString();

  const subject = `Watchlist alert: ${url} changed ${previousGrade} -> ${currentGrade}`;
  const cadenceLabel =
    frequency === "instant"
      ? "instant alerts"
      : frequency === "daily"
        ? "daily cadence"
        : "weekly cadence";

  const html = `
    <div style="font-family: Inter, Arial, sans-serif; line-height: 1.55; color: #0f172a;">
      <h2 style="margin-bottom: 12px;">Security Header Checker watchlist alert</h2>
      <p style="margin: 0 0 12px;">A monitored URL changed grade during refresh.</p>
      <ul style="padding-left: 20px; margin: 0 0 14px;">
        <li><strong>URL:</strong> ${url}</li>
        <li><strong>Previous grade:</strong> ${previousGrade}</li>
        <li><strong>Current grade:</strong> ${currentGrade}</li>
        <li><strong>Checked at:</strong> ${checkedAtLabel}</li>
      </ul>
      <p style="margin: 0 0 14px;">This alert was delivered using your <strong>${cadenceLabel}</strong> preference.</p>
      <a href="${dashboardLink}" style="display: inline-block; background: #0ea5e9; color: #020617; text-decoration: none; padding: 10px 14px; border-radius: 8px; font-weight: 600;">
        Open dashboard
      </a>
    </div>
  `;

  const text = [
    "Security Header Checker watchlist alert",
    "",
    "A monitored URL changed grade during refresh.",
    `URL: ${url}`,
    `Previous grade: ${previousGrade}`,
    `Current grade: ${currentGrade}`,
    `Checked at: ${checkedAtLabel}`,
    `Alert cadence: ${cadenceLabel}`,
    "",
    `Open dashboard: ${dashboardLink}`
  ].join("\n");

  const result = await resend.emails.send({
    from: fromEmail,
    to: [toEmail],
    subject,
    html,
    text
  });

  if (result.error) {
    throw new Error(result.error.message || "Unable to send notification email.");
  }

  return result.data?.id ?? null;
}

"use client";

import { FormEvent, Suspense, TouchEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Image from "next/image";
import Link from "next/link";
import { useSession } from "next-auth/react";
import type { HeaderResult } from "@/lib/securityHeaders";
import { AnimatedGradeCircle } from "@/app/components/AnimatedGradeCircle";
import { KeyboardShortcutsHelp } from "@/app/components/KeyboardShortcutsHelp";
import { ScannerOnboardingTour } from "@/app/components/ScannerOnboardingTour";
import { SecurityCard } from "@/app/components/SecurityCard";
import { SiteFooter } from "@/app/components/SiteFooter";
import { SiteNav } from "@/app/components/SiteNav";
import { useToast } from "@/app/components/ToastProvider";
import { trackEvent } from "@/lib/analytics";
import type { FrameworkInfo } from "@/lib/frameworkDetection";
import { getHeaderDeepDiveDetails } from "@/lib/headerDeepDive";
import { getSuggestedPlatformFromFramework } from "@/lib/platformFixes";
import {
  DOMAIN_HISTORY_STORAGE_KEY,
  HISTORY_STORAGE_KEY,
  MAX_HISTORY_ITEMS,
  mergeDomainGradeHistories,
  isScanHistoryEntry,
  mergeScanHistories,
  normalizeDomainGradeHistory,
  normalizeScanHistoryEntries,
  recordDomainGradeHistoryPoint,
  type DomainGradeHistoryRecord,
  type ScanHistoryEntry
} from "@/lib/userData";

const ConfettiLauncher = dynamic(
  () => import("@/app/components/ConfettiLauncher").then((module) => module.ConfettiLauncher),
  { ssr: false }
);
const WatchlistPanel = dynamic(
  () => import("@/app/components/WatchlistPanel").then((module) => module.WatchlistPanel),
  { suspense: true }
);
const FixSuggestionsPanel = dynamic(
  () => import("@/app/components/FixSuggestionsPanel").then((module) => module.FixSuggestionsPanel),
  { suspense: true }
);
const PdfDownloadButton = dynamic(
  () => import("@/app/components/PdfDownloadButton").then((module) => module.PdfDownloadButton),
  {
    ssr: false,
    loading: () => (
      <button
        type="button"
        disabled
        className="rounded-lg border border-slate-700 bg-slate-950/80 px-3 py-1.5 text-xs uppercase tracking-[0.12em] text-slate-400"
      >
        Loading PDF tools...
      </button>
    )
  }
);

function SuspensePanelFallback({ label }: { label: string }) {
  return (
    <section
      aria-label={`${label} loading`}
      className="lazy-section mt-5 rounded-xl border border-slate-800/90 bg-slate-950/60 p-4"
    >
      <div className="skeleton-shimmer h-4 w-40 rounded" />
      <div className="skeleton-shimmer mt-3 h-10 rounded-lg" />
      <div className="skeleton-shimmer mt-2 h-10 rounded-lg" />
    </section>
  );
}

type ReportResponse = {
  checkedUrl: string;
  finalUrl: string;
  statusCode: number;
  score: number;
  grade: string;
  results: HeaderResult[];
  checkedAt: string;
  framework?: FrameworkInfo;
  scanDurationMs?: number;
};

type ComparisonReport = {
  siteA: ReportResponse;
  siteB: ReportResponse;
};

type HistoryEntry = ScanHistoryEntry;

type PopularSiteCacheEntry = {
  url: string;
  report: ReportResponse;
  cachedAt: string;
};

type HeaderDifference = {
  key: string;
  label: string;
  messages: string[];
};

type BulkScanResult = {
  inputUrl: string;
  report: ReportResponse | null;
  error: string | null;
};

type ScanRequestOptions = {
  userAgent?: string;
  followRedirects: boolean;
  timeoutMs: 5000 | 10000 | 15000;
};

type ScanMode = "single" | "compare" | "bulk";
type MobileCompareView = "siteA" | "siteB";
type ShareState = "idle" | "copied" | "shared" | "error";
type BadgeStyle = "flat" | "plastic";
type BadgeTheme = "default" | "slate" | "light";
type BadgeCopyState = "idle" | "markdown" | "html" | "error";
type UserAgentPresetChoice = "default" | "custom" | "chrome" | "firefox" | "googlebot";
type ReportSource = "live" | "cache" | "shared";
type LaunchFeature = {
  title: string;
  description: string;
  cta: string;
};
type TrustedByMetric = {
  label: string;
  value: string;
};
type Testimonial = {
  quote: string;
  name: string;
  role: string;
  company: string;
};
type FaqItem = {
  question: string;
  answer: string;
};

type SharePayload =
  | {
      version: 1;
      mode: "single";
      report: ReportResponse;
    }
  | {
      version: 1;
      mode: "compare";
      comparison: ComparisonReport;
    };
type SharePathCache = {
  payloadKey: string;
  path: string;
};

const SAMPLE_SITES = ["google.com", "github.com", "facebook.com"];
const EMPTY_STATE_SUGGESTIONS = ["owasp.org", "mozilla.org", "cloudflare.com", "wikipedia.org"];
const POPULAR_SITES = ["google.com", "github.com", "youtube.com", "amazon.com", "wikipedia.org"];
const POPULAR_CACHE_STORAGE_KEY = "security-header-checker:popular-sites-cache";
const HISTORY_REPORT_STORAGE_KEY = "security-header-checker:scan-history-reports";
const POPULAR_CACHE_TTL_MS = 1000 * 60 * 60 * 6;
const MAX_BULK_URLS = 10;
const SHARE_QUERY_PARAM = "share";
const RESCAN_QUERY_PARAM = "rescan";
const LAUNCH_FEATURES: LaunchFeature[] = [
  {
    title: "Bulk checks at release speed",
    description:
      "Scan up to 10 domains in one run, then export CSV results for triage and sprint planning.",
    cta: "Open Bulk Scan mode"
  },
  {
    title: "Side-by-side comparison",
    description:
      "Compare two environments or competitors to spot missing headers and policy differences instantly.",
    cta: "Compare two sites"
  },
  {
    title: "Watchlist and grade alerts",
    description:
      "Track critical domains, detect regressions early, and trigger notifications on security posture changes.",
    cta: "Monitor with watchlist"
  },
  {
    title: "API access for automation",
    description:
      "Call /api/check from CI jobs, scripts, or internal tooling with your personal API key.",
    cta: "Read API docs"
  }
];
const INTEGRATE_CLI_SNIPPET = `px @security-header-checker/cli https://example.com --fail-under B
px @security-header-checker/cli https://example.com --json --api-key "$SECURITY_HEADERS_API_KEY"`;
const INTEGRATE_ACTION_SNIPPET = `- name: Security header scan
  uses: ./.github/actions/security-headers
  with:
    url: https://example.com
    fail-under: B
    api-key: \${{ secrets.SECURITY_HEADERS_API_KEY }}`;
const TRUSTED_BY_LOGOS = ["DevOps teams", "Security engineers", "QA squads", "Platform teams", "Startup founders"];
const TRUSTED_BY_METRICS: TrustedByMetric[] = [
  {
    label: "Checks run",
    value: "120k+"
  },
  {
    label: "Teams monitoring domains",
    value: "2,400+"
  },
  {
    label: "Average scan time",
    value: "< 3 sec"
  }
];
const TESTIMONIALS: Testimonial[] = [
  {
    quote:
      "We added this to our release checklist and caught two missing CSP policies before production. It paid for itself in one sprint.",
    name: "Maya Patel",
    role: "Platform Lead",
    company: "Northstar Commerce"
  },
  {
    quote:
      "The compare mode made staging-to-prod validation much faster. Security reviews now take minutes instead of an hour.",
    name: "Liam Chen",
    role: "Senior DevOps Engineer",
    company: "Helio Cloud"
  },
  {
    quote:
      "Bulk scans are perfect for weekly audits across client domains. The grade summary gives our team instant prioritization.",
    name: "Sofia Ramirez",
    role: "Security Consultant",
    company: "Ironwall Advisory"
  }
];
const TRUSTED_DEVELOPER_COUNT = "18,000+";
const SHORTCUT_ROWS = [
  { keys: "?", action: "Open/close keyboard shortcuts help" },
  { keys: "/", action: "Focus the URL input" },
  { keys: "Cmd/Ctrl + Enter", action: "Run scan in active tab" },
  { keys: "Cmd/Ctrl + K", action: "Focus the URL input" },
  { keys: "1-6", action: "Jump to visible header result cards" },
  { keys: "Ctrl + P", action: "Download current scan report PDF" },
  { keys: "Enter", action: "Run scan (no modifiers)" },
  { keys: "Esc", action: "Close open dialogs or clear active scan state" }
];
const USER_AGENT_PRESETS = [
  {
    id: "chrome",
    label: "Chrome",
    value:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
  },
  {
    id: "firefox",
    label: "Firefox",
    value: "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:125.0) Gecko/20100101 Firefox/125.0"
  },
  {
    id: "googlebot",
    label: "Googlebot",
    value: "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)"
  }
] as const;
const SCAN_TIMEOUT_OPTIONS = [
  { label: "5 seconds", value: 5000 },
  { label: "10 seconds", value: 10000 },
  { label: "15 seconds", value: 15000 }
] as const;
const SITE_ORIGIN = process.env.NEXT_PUBLIC_SITE_URL ?? "https://security-header-checker.vercel.app";
const FAQ_ITEMS: FaqItem[] = [
  {
    question: "What does this security header checker scan?",
    answer:
      "It checks 11 core HTTP security headers, including CSP, HSTS, X-Frame-Options, X-XSS-Protection, Feature-Policy, Referrer-Policy, and modern cross-origin isolation headers."
  },
  {
    question: "How quickly can I run a scan?",
    answer:
      "Most scans complete in a few seconds. You can run single scans, compare two sites side by side, or perform bulk checks for multiple domains."
  },
  {
    question: "Do I need to install anything?",
    answer:
      "No installation is required. The scanner runs in your browser and calls the API endpoint to analyze response headers for the URL you provide."
  },
  {
    question: "Can I share or export results with my team?",
    answer:
      "Yes. You can copy report summaries, share encoded links, export PDFs, and generate badge snippets for docs or dashboards."
  }
];

const gradeStyles: Record<string, string> = {
  A: "text-emerald-300",
  B: "text-lime-300",
  C: "text-amber-300",
  D: "text-orange-300",
  F: "text-rose-300"
};

function isReportResponse(value: unknown): value is ReportResponse {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<ReportResponse>;

  return (
    typeof candidate.checkedUrl === "string" &&
    typeof candidate.finalUrl === "string" &&
    typeof candidate.statusCode === "number" &&
    typeof candidate.score === "number" &&
    typeof candidate.grade === "string" &&
    typeof candidate.checkedAt === "string" &&
    Array.isArray(candidate.results)
  );
}

function isPopularSiteCacheEntry(value: unknown): value is PopularSiteCacheEntry {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<PopularSiteCacheEntry>;
  return (
    typeof candidate.url === "string" &&
    typeof candidate.cachedAt === "string" &&
    isReportResponse(candidate.report)
  );
}

function isComparisonReport(value: unknown): value is ComparisonReport {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<ComparisonReport>;
  return isReportResponse(candidate.siteA) && isReportResponse(candidate.siteB);
}

function isSharePayload(value: unknown): value is SharePayload {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<SharePayload>;
  if (candidate.version !== 1) return false;

  if (candidate.mode === "single") {
    return isReportResponse((candidate as { report?: unknown }).report);
  }

  if (candidate.mode === "compare") {
    return isComparisonReport((candidate as { comparison?: unknown }).comparison);
  }

  return false;
}

function normalizeHistoryReportSnapshots(value: unknown): Record<string, ReportResponse> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};

  const normalized: Record<string, ReportResponse> = {};
  for (const [entryId, snapshot] of Object.entries(value)) {
    if (!entryId || !isReportResponse(snapshot)) continue;
    normalized[entryId] = snapshot;
  }
  return normalized;
}

function fromBase64Url(value: string) {
  if (typeof window === "undefined") return "";
  const padded = value.replace(/-/g, "+").replace(/_/g, "/");
  const normalized = padded + "=".repeat((4 - (padded.length % 4)) % 4);
  const binary = atob(normalized);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function decodeSharePayload(value: string): SharePayload | null {
  try {
    const parsed = JSON.parse(fromBase64Url(value));
    return isSharePayload(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

async function createSharedReportPath(payload: SharePayload): Promise<string> {
  const response = await fetch("/api/reports/share", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  const body = (await response.json().catch(() => null)) as { path?: unknown; error?: unknown } | null;
  if (!response.ok) {
    const message =
      body && typeof body.error === "string" ? body.error : "Could not create a shareable report link.";
    throw new Error(message);
  }
  if (!body || typeof body.path !== "string") {
    throw new Error("Could not create a shareable report link.");
  }
  return body.path;
}

function buildSharePayload(report: ReportResponse | null, comparison: ComparisonReport | null): SharePayload | null {
  if (report) {
    return { version: 1, mode: "single", report };
  }
  if (comparison) {
    return { version: 1, mode: "compare", comparison };
  }
  return null;
}

function serializeSharePayload(payload: SharePayload): string {
  return JSON.stringify(payload);
}

function gradeColor(grade: string) {
  return gradeStyles[grade] ?? "text-slate-200";
}

function extractDomainFromUrl(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  try {
    const parsed = new URL(trimmed);
    return parsed.hostname || null;
  } catch {
    return null;
  }
}

function frameworkSummaryLabel(info: FrameworkInfo | undefined): string | null {
  const detected = info?.detected;
  if (!detected) return null;
  return `${detected.label} (${detected.reason})`;
}

function initialsFromName(value: string): string {
  const parts = value
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return "U";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
}

function escapeCsvCell(value: string): string {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, "\"\"")}"`;
  }
  return value;
}

function buildHeaderStatusSnapshot(results: HeaderResult[]): Record<string, HeaderResult["status"]> {
  return results.reduce<Record<string, HeaderResult["status"]>>((snapshot, result) => {
    snapshot[result.key] = result.status;
    return snapshot;
  }, {});
}

function toScorePercentage(score: number, maxScore: number): number {
  if (!Number.isFinite(score) || !Number.isFinite(maxScore) || maxScore <= 0) return 0;
  return Math.round((score / maxScore) * 100);
}

function isTextInputLikeTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) {
    return true;
  }
  if (target.isContentEditable) return true;
  return target.closest('[contenteditable="true"]') !== null;
}

function formatScanDuration(durationMs: number | null | undefined): string | null {
  if (typeof durationMs !== "number" || !Number.isFinite(durationMs) || durationMs <= 0) {
    return null;
  }
  return `Scan completed in ${(durationMs / 1000).toFixed(2)}s`;
}

function formatRelativeTime(value: string): string | null {
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) {
    return null;
  }

  const elapsedMs = Date.now() - timestamp;
  const elapsedSeconds = Math.max(1, Math.round(elapsedMs / 1000));
  if (elapsedSeconds < 60) {
    return `${elapsedSeconds}s ago`;
  }
  const elapsedMinutes = Math.round(elapsedSeconds / 60);
  if (elapsedMinutes < 60) {
    return `${elapsedMinutes}m ago`;
  }
  const elapsedHours = Math.round(elapsedMinutes / 60);
  if (elapsedHours < 24) {
    return `${elapsedHours}h ago`;
  }
  const elapsedDays = Math.round(elapsedHours / 24);
  return `${elapsedDays}d ago`;
}

function reportSourceLabel(source: ReportSource | null): string {
  if (source === "cache") return "Cached snapshot";
  if (source === "shared") return "Shared report link";
  return "Live scan";
}

function escapeMarkdownCell(value: string): string {
  return value.replace(/\|/g, "\\|").replace(/\r?\n/g, " ");
}

function formatReportAsMarkdown(report: ReportResponse, shareUrl: string | null): string {
  const checkedAt = new Date(report.checkedAt).toLocaleString();
  const lines = [
    "## Security Header Checker Report",
    "",
    `- **Checked URL:** ${report.checkedUrl}`,
    `- **Final URL:** ${report.finalUrl}`,
    `- **Status Code:** ${report.statusCode}`,
    `- **Grade:** ${report.grade}`,
    `- **Score:** ${report.score}/${report.results.length * 2}`,
    `- **Checked At:** ${checkedAt}`,
    `- **Scan Duration:** ${formatScanDuration(report.scanDurationMs) ?? "Not available"}`,
    `- **Detected Stack:** ${report.framework?.detected?.label ?? "Unknown"}`,
    shareUrl ? `- **Share Link:** ${shareUrl}` : null,
    "",
    "### Header Details",
    "",
    "| Header | Status | Value | Recommendation |",
    "| --- | --- | --- | --- |"
  ].filter((line): line is string => typeof line === "string");

  for (const result of report.results) {
    lines.push(
      `| ${escapeMarkdownCell(result.label)} | ${escapeMarkdownCell(result.status.toUpperCase())} | ${escapeMarkdownCell(
        result.value ?? "Missing"
      )} | ${escapeMarkdownCell(result.guidance)} |`
    );
  }

  return lines.join("\n").trim();
}

function socialShareText(report: ReportResponse): string {
  const target = extractDomainFromUrl(report.finalUrl) ?? extractDomainFromUrl(report.checkedUrl) ?? "my site";
  const socialGrade = report.grade.toUpperCase() === "A" ? "A+" : report.grade.toUpperCase();
  return `My site ${target} scored ${socialGrade} on security headers! Check yours at`;
}

function HeroShieldIcon() {
  return (
    <div className="relative mx-auto flex h-28 w-28 items-center justify-center rounded-3xl border border-sky-400/30 bg-slate-950/80 shadow-2xl shadow-sky-950/40 sm:h-36 sm:w-36">
      <div className="absolute inset-3 rounded-2xl border border-sky-400/20 bg-gradient-to-b from-sky-400/15 to-cyan-300/5 blur-[1px]" />
      <svg
        viewBox="0 0 64 64"
        aria-hidden="true"
        className="shield-float relative h-16 w-16 text-sky-300 sm:h-20 sm:w-20"
      >
        <path
          d="M32 6 50 13v18c0 14-9.6 23.6-18 27-8.4-3.4-18-13-18-27V13L32 6Z"
          fill="currentColor"
          fillOpacity="0.18"
          stroke="currentColor"
          strokeWidth="2.5"
        />
        <rect x="24" y="29" width="16" height="12" rx="2.5" fill="currentColor" />
        <path
          d="M27 29v-3.5a5 5 0 1 1 10 0V29"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeWidth="2.5"
        />
      </svg>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <section className="mt-6 grid gap-6 lg:grid-cols-[280px_1fr]" aria-hidden="true">
      <article className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
        <div className="skeleton-shimmer h-3 w-24 rounded" />
        <div className="skeleton-shimmer mt-4 h-16 w-20 rounded" />
        <div className="skeleton-shimmer mt-3 h-3 w-36 rounded" />
        <div className="mt-6 space-y-2">
          <div className="skeleton-shimmer h-3 rounded" />
          <div className="skeleton-shimmer h-3 rounded" />
          <div className="skeleton-shimmer h-3 rounded" />
        </div>
      </article>
      <div className="grid gap-4 sm:grid-cols-2">
        {Array.from({ length: 6 }).map((_, index) => (
          <article
            key={index}
            className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 shadow-lg shadow-slate-950/50"
          >
            <div className="skeleton-shimmer h-5 w-2/3 rounded" />
            <div className="skeleton-shimmer mt-3 h-3 rounded" />
            <div className="skeleton-shimmer mt-2 h-3 w-11/12 rounded" />
            <div className="skeleton-shimmer mt-5 h-3 rounded" />
            <div className="skeleton-shimmer mt-2 h-3 w-5/6 rounded" />
          </article>
        ))}
      </div>
    </section>
  );
}

function GradeDisplayPulseSkeleton() {
  return (
    <article className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
      <div className="scan-pulse-skeleton h-3 w-28 rounded" />
      <div className="scan-pulse-skeleton mt-4 h-16 w-24 rounded" />
      <div className="scan-pulse-skeleton mt-3 h-3 w-40 rounded" />
      <div className="mt-5 grid gap-2 sm:grid-cols-2">
        <div className="scan-pulse-skeleton h-9 rounded-lg" />
        <div className="scan-pulse-skeleton h-9 rounded-lg" />
      </div>
      <div className="mt-4 space-y-2">
        <div className="scan-pulse-skeleton h-3 rounded" />
        <div className="scan-pulse-skeleton h-3 rounded" />
        <div className="scan-pulse-skeleton h-3 w-5/6 rounded" />
      </div>
    </article>
  );
}

function HeaderCardPulseSkeleton() {
  return (
    <article className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 shadow-lg shadow-slate-950/50">
      <div className="flex items-center justify-between gap-2">
        <div className="scan-pulse-skeleton h-5 w-2/3 rounded" />
        <div className="scan-pulse-skeleton h-6 w-16 rounded-full" />
      </div>
      <div className="scan-pulse-skeleton mt-4 h-3 rounded" />
      <div className="scan-pulse-skeleton mt-2 h-3 w-11/12 rounded" />
      <div className="scan-pulse-skeleton mt-4 h-3 rounded" />
      <div className="scan-pulse-skeleton mt-2 h-3 w-5/6 rounded" />
    </article>
  );
}

function ScanResultsLoadingSkeleton({ mode }: { mode: ScanMode }) {
  if (mode === "compare") {
    return (
      <section className="mt-6 space-y-6" aria-hidden="true">
        <div className="grid gap-4 sm:grid-cols-2">
          <article className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
            <div className="scan-pulse-skeleton h-3 w-16 rounded" />
            <div className="scan-pulse-skeleton mt-3 h-4 w-2/3 rounded" />
            <div className="scan-pulse-skeleton mt-4 h-10 w-16 rounded" />
            <div className="scan-pulse-skeleton mt-3 h-3 w-3/4 rounded" />
          </article>
          <article className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
            <div className="scan-pulse-skeleton h-3 w-16 rounded" />
            <div className="scan-pulse-skeleton mt-3 h-4 w-2/3 rounded" />
            <div className="scan-pulse-skeleton mt-4 h-10 w-16 rounded" />
            <div className="scan-pulse-skeleton mt-3 h-3 w-3/4 rounded" />
          </article>
        </div>
        <article className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 shadow-lg shadow-slate-950/50">
          <div className="scan-pulse-skeleton h-5 w-40 rounded" />
          <div className="scan-pulse-skeleton mt-3 h-3 w-2/3 rounded" />
          <div className="mt-4 space-y-2">
            <div className="scan-pulse-skeleton h-12 rounded-lg" />
            <div className="scan-pulse-skeleton h-12 rounded-lg" />
          </div>
        </article>
        <div className="grid gap-6 lg:grid-cols-2">
          <section>
            <div className="scan-pulse-skeleton mb-3 h-3 w-28 rounded" />
            <div className="grid gap-4 sm:grid-cols-2">
              {Array.from({ length: 4 }).map((_, index) => (
                <HeaderCardPulseSkeleton key={`compare-a-${index}`} />
              ))}
            </div>
          </section>
          <section>
            <div className="scan-pulse-skeleton mb-3 h-3 w-28 rounded" />
            <div className="grid gap-4 sm:grid-cols-2">
              {Array.from({ length: 4 }).map((_, index) => (
                <HeaderCardPulseSkeleton key={`compare-b-${index}`} />
              ))}
            </div>
          </section>
        </div>
      </section>
    );
  }

  return (
    <section className="mt-6 grid gap-6 lg:grid-cols-[280px_1fr]" aria-hidden="true">
      <GradeDisplayPulseSkeleton />
      <div className="grid gap-4 sm:grid-cols-2">
        {Array.from({ length: 6 }).map((_, index) => (
          <HeaderCardPulseSkeleton key={`single-${index}`} />
        ))}
      </div>
    </section>
  );
}

function SiteSummary({ title, report, delayMs = 0 }: { title: string; report: ReportResponse; delayMs?: number }) {
  return (
    <article className="motion-card rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-slate-400">{title}</p>
          <p className="mt-2 break-all text-sm text-slate-300">{report.checkedUrl}</p>
        </div>
        <p
          className={`grade-badge-in text-5xl font-bold ${gradeColor(report.grade)}`}
          style={{ animationDelay: `${delayMs}ms` }}
        >
          {report.grade}
        </p>
      </div>
      <p className="mt-2 text-sm text-slate-300">
        Score: {report.score}/{report.results.length * 2}
      </p>
      <div className="mt-4 space-y-1 text-sm text-slate-300">
        <p>
          <span className="text-slate-500">Final URL:</span> {report.finalUrl}
        </p>
        <p>
          <span className="text-slate-500">Status:</span> {report.statusCode}
        </p>
        <p>
          <span className="text-slate-500">Time:</span> {new Date(report.checkedAt).toLocaleString()}
        </p>
        {formatScanDuration(report.scanDurationMs) && (
          <p className="text-xs uppercase tracking-[0.12em] text-sky-300/90">
            {formatScanDuration(report.scanDurationMs)}
          </p>
        )}
      </div>
    </article>
  );
}

export default function Home() {
  const { notify } = useToast();
  const [mode, setMode] = useState<ScanMode>("single");
  const [url, setUrl] = useState("");
  const [compareUrlA, setCompareUrlA] = useState("");
  const [compareUrlB, setCompareUrlB] = useState("");
  const [bulkUrlsInput, setBulkUrlsInput] = useState("");
  const [bulkResults, setBulkResults] = useState<BulkScanResult[]>([]);
  const [bulkExportState, setBulkExportState] = useState<"idle" | "exported" | "error">("idle");
  const [mobileCompareView, setMobileCompareView] = useState<MobileCompareView>("siteA");
  const [loading, setLoading] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [bulkTargetCount, setBulkTargetCount] = useState(0);
  const [bulkCompletedCount, setBulkCompletedCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<ReportResponse | null>(null);
  const [reportSource, setReportSource] = useState<ReportSource | null>(null);
  const [reportCachedAt, setReportCachedAt] = useState<string | null>(null);
  const [comparison, setComparison] = useState<ComparisonReport | null>(null);
  const [copyState, setCopyState] = useState<"idle" | "copied" | "error">("idle");
  const [copyLinkState, setCopyLinkState] = useState<"idle" | "copied" | "error">("idle");
  const [pdfState, setPdfState] = useState<"idle" | "generating" | "error">("idle");
  const [pdfExportRequestKey, setPdfExportRequestKey] = useState(0);
  const [shareState, setShareState] = useState<ShareState>("idle");
  const [sharePathCache, setSharePathCache] = useState<SharePathCache | null>(null);
  const [badgePanelOpen, setBadgePanelOpen] = useState(false);
  const [badgeStyle, setBadgeStyle] = useState<BadgeStyle>("flat");
  const [badgeTheme, setBadgeTheme] = useState<BadgeTheme>("default");
  const [badgeLabel, setBadgeLabel] = useState("security headers");
  const [badgeCopyState, setBadgeCopyState] = useState<BadgeCopyState>("idle");
  const [scanHistory, setScanHistory] = useState<HistoryEntry[]>([]);
  const [historyReportSnapshots, setHistoryReportSnapshots] = useState<Record<string, ReportResponse>>({});
  const [historyBootstrapped, setHistoryBootstrapped] = useState(false);
  const [historyServerReady, setHistoryServerReady] = useState(false);
  const [syncedHistoryUserKey, setSyncedHistoryUserKey] = useState<string | null>(null);
  const [domainHistory, setDomainHistory] = useState<DomainGradeHistoryRecord>({});
  const [domainHistoryBootstrapped, setDomainHistoryBootstrapped] = useState(false);
  const [domainHistoryServerReady, setDomainHistoryServerReady] = useState(false);
  const [syncedDomainHistoryUserKey, setSyncedDomainHistoryUserKey] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(true);
  const [activeHistoryIndex, setActiveHistoryIndex] = useState(0);
  const [popularSitesCache, setPopularSitesCache] = useState<PopularSiteCacheEntry[]>([]);
  const [popularRefreshing, setPopularRefreshing] = useState(false);
  const [activePopularRefresh, setActivePopularRefresh] = useState<string | null>(null);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [activeHeaderDetail, setActiveHeaderDetail] = useState<HeaderResult | null>(null);
  const [advancedOptionsOpen, setAdvancedOptionsOpen] = useState(false);
  const [userAgentPreset, setUserAgentPreset] = useState<UserAgentPresetChoice>("default");
  const [customUserAgent, setCustomUserAgent] = useState("");
  const [followRedirects, setFollowRedirects] = useState(true);
  const [timeoutMs, setTimeoutMs] = useState<5000 | 10000 | 15000>(10000);
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0);
  const [revealedSections, setRevealedSections] = useState<Record<string, boolean>>({});
  const [gradeConfettiTrigger, setGradeConfettiTrigger] = useState(0);
  const { data: session, status: sessionStatus } = useSession();
  const compareTouchStartXRef = useRef<number | null>(null);
  const historyTouchStartXRef = useRef<number | null>(null);
  const singleUrlInputRef = useRef<HTMLInputElement | null>(null);
  const compareUrlAInputRef = useRef<HTMLInputElement | null>(null);
  const shortcutsDialogRef = useRef<HTMLDivElement | null>(null);
  const shortcutCloseButtonRef = useRef<HTMLButtonElement | null>(null);
  const headerDetailDialogRef = useRef<HTMLDivElement | null>(null);
  const headerDetailCloseButtonRef = useRef<HTMLButtonElement | null>(null);
  const lastFocusedElementRef = useRef<HTMLElement | null>(null);
  const celebratedScanRef = useRef<string | null>(null);
  const lastHapticFeedbackRef = useRef<string | null>(null);
  const wasLoadingForHapticsRef = useRef(false);
  const currentUserKey = session?.user?.email ?? session?.user?.name ?? null;
  const isAuthenticated = sessionStatus === "authenticated";
  const currentSharePayload = useMemo(() => buildSharePayload(report, comparison), [report, comparison]);
  const currentSharePayloadKey = useMemo(
    () => (currentSharePayload ? serializeSharePayload(currentSharePayload) : null),
    [currentSharePayload]
  );
  const organizationSchema = useMemo(
    () => ({
      "@context": "https://schema.org",
      "@type": "Organization",
      name: "Security Header Checker",
      url: `${SITE_ORIGIN.replace(/\/$/, "")}/`,
      logo: `${SITE_ORIGIN.replace(/\/$/, "")}/icons/icon-512.png`,
      description: "Security tooling that helps teams scan, compare, and monitor HTTP security headers.",
      sameAs: ["https://github.com/7evan11fff/cyber-website"]
    }),
    []
  );
  const webApplicationSchema = useMemo(
    () => ({
      "@context": "https://schema.org",
      "@type": "WebApplication",
      name: "Security Header Checker",
      operatingSystem: "Web",
      applicationCategory: "SecurityApplication",
      url: `${SITE_ORIGIN.replace(/\/$/, "")}/`,
      description:
        "Scan, score, and compare website security headers with guidance for misconfigurations and missing protections.",
      featureList: [
        "Single URL security header scan",
        "Side-by-side compare mode",
        "Bulk scanning for multiple domains",
        "Shareable report links and PDF export",
        "Watchlist tracking with grade change alerts"
      ],
      offers: {
        "@type": "Offer",
        price: "0",
        priceCurrency: "USD"
      },
      publisher: {
        "@type": "Organization",
        name: "Security Header Checker",
        url: `${SITE_ORIGIN.replace(/\/$/, "")}/`
      }
    }),
    []
  );
  const faqSchema = useMemo(
    () => ({
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: FAQ_ITEMS.map((item) => ({
        "@type": "Question",
        name: item.question,
        acceptedAnswer: {
          "@type": "Answer",
          text: item.answer
        }
      }))
    }),
    []
  );

  const revealClass = useCallback(
    (id: string) =>
      `reveal-section ${revealedSections[id] ? "reveal-visible" : ""}`.trim(),
    [revealedSections]
  );
  const scrollToScanInput = useCallback(() => {
    setMode("single");
    window.requestAnimationFrame(() => {
      if (!singleUrlInputRef.current) return;
      singleUrlInputRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
      singleUrlInputRef.current.focus();
    });
  }, []);
  const triggerHapticFeedback = useCallback((pattern: number | number[] = [16, 34, 18]) => {
    if (typeof navigator === "undefined" || typeof navigator.vibrate !== "function") {
      return;
    }
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }
    navigator.vibrate(pattern);
  }, []);

  const singleGradeColor = useMemo(() => {
    if (!report) return "text-slate-200";
    return gradeColor(report.grade);
  }, [report]);

  const bulkUrlCount = useMemo(() => {
    return bulkUrlsInput
      .split(/\r?\n/)
      .map((entry) => entry.trim())
      .filter(Boolean).length;
  }, [bulkUrlsInput]);

  const badgeDomain = useMemo(() => {
    if (!report) return null;
    return extractDomainFromUrl(report.finalUrl) ?? extractDomainFromUrl(report.checkedUrl);
  }, [report]);

  const badgeUrl = useMemo(() => {
    if (!badgeDomain) return "";
    const query = new URLSearchParams({
      style: badgeStyle,
      theme: badgeTheme,
      label: badgeLabel.trim() || "security headers"
    });
    const badgePath = `/badge/${encodeURIComponent(badgeDomain)}?${query.toString()}`;
    if (typeof window === "undefined") {
      return badgePath;
    }
    return `${window.location.origin}${badgePath}`;
  }, [badgeDomain, badgeLabel, badgeStyle, badgeTheme]);

  const badgeMarkdownCode = useMemo(() => {
    if (!badgeDomain || !badgeUrl) return "";
    return `![Security headers grade for ${badgeDomain}](${badgeUrl})`;
  }, [badgeDomain, badgeUrl]);

  const badgeHtmlCode = useMemo(() => {
    if (!badgeDomain || !badgeUrl) return "";
    return `<img src="${badgeUrl}" alt="Security headers grade badge for ${badgeDomain}" />`;
  }, [badgeDomain, badgeUrl]);

  const suggestedFixPlatform = useMemo(
    () => getSuggestedPlatformFromFramework(report?.framework?.detected),
    [report?.framework?.detected]
  );

  const quickFixesHref = useMemo(() => {
    if (!suggestedFixPlatform) return "/fixes";
    return `/fixes?platform=${encodeURIComponent(suggestedFixPlatform)}`;
  }, [suggestedFixPlatform]);
  const scorePercent = useMemo(() => {
    if (!report) return null;
    return toScorePercentage(report.score, report.results.length * 2);
  }, [report]);
  const scanRequestOptions = useMemo<ScanRequestOptions>(
    () => ({
      userAgent: customUserAgent.trim() || undefined,
      followRedirects,
      timeoutMs
    }),
    [customUserAgent, followRedirects, timeoutMs]
  );

  const comparisonDifferences = useMemo<HeaderDifference[]>(() => {
    if (!comparison) return [];

    const mapSiteB = new Map(comparison.siteB.results.map((header) => [header.key, header]));
    const differences: HeaderDifference[] = [];

    for (const siteAHeader of comparison.siteA.results) {
      const siteBHeader = mapSiteB.get(siteAHeader.key);
      if (!siteBHeader) continue;

      const messages: string[] = [];

      if (siteAHeader.present !== siteBHeader.present) {
        if (siteAHeader.present) {
          messages.push(`Site A includes ${siteAHeader.label}, but Site B is missing it.`);
        } else {
          messages.push(`Site B includes ${siteAHeader.label}, but Site A is missing it.`);
        }
      } else if (siteAHeader.status !== siteBHeader.status) {
        messages.push(
          `Coverage differs: Site A is ${siteAHeader.status}, Site B is ${siteBHeader.status}.`
        );
      }

      const siteAValue = siteAHeader.value?.trim();
      const siteBValue = siteBHeader.value?.trim();
      if (siteAValue && siteBValue && siteAValue !== siteBValue) {
        messages.push("Header values are different between both sites.");
      }

      if (messages.length > 0) {
        differences.push({
          key: siteAHeader.key,
          label: siteAHeader.label,
          messages
        });
      }
    }

    return differences;
  }, [comparison]);

  const differingHeaderKeys = useMemo(() => {
    return new Set(comparisonDifferences.map((difference) => difference.key));
  }, [comparisonDifferences]);
  const activeHeaderDeepDive = useMemo(() => {
    if (!activeHeaderDetail) return null;
    return getHeaderDeepDiveDetails(activeHeaderDetail);
  }, [activeHeaderDetail]);

  const popularCacheByUrl = useMemo(() => {
    return new Map(popularSitesCache.map((entry) => [entry.url, entry]));
  }, [popularSitesCache]);

  const liveRegionMessage = useMemo(() => {
    if (error) {
      return `Scan error: ${error}`;
    }
    if (copyState === "copied") {
      return "Markdown report copied to clipboard.";
    }
    if (copyLinkState === "copied") {
      return "Shareable link copied to clipboard.";
    }
    if (shareState === "copied") {
      return "Shareable link copied to clipboard.";
    }
    if (shareState === "shared") {
      return "Report shared.";
    }
    if (badgeCopyState === "markdown") {
      return "Badge markdown copied.";
    }
    if (badgeCopyState === "html") {
      return "Badge HTML copied.";
    }
    if (pdfState === "error") {
      return "PDF export failed. Please try again.";
    }
    if (bulkExportState === "exported") {
      return "Bulk results exported as CSV.";
    }
    if (!loading && report) {
      return `Scan complete. ${report.checkedUrl} received grade ${report.grade}.`;
    }
    if (!loading && comparison) {
      return `Comparison complete. Site A grade ${comparison.siteA.grade}. Site B grade ${comparison.siteB.grade}.`;
    }
    if (!loading && mode === "bulk" && bulkResults.length > 0) {
      const successCount = bulkResults.filter((entry) => entry.report).length;
      return `Bulk scan complete. ${successCount} of ${bulkResults.length} URLs scanned successfully.`;
    }
    return "";
  }, [
    badgeCopyState,
    bulkExportState,
    bulkResults,
    comparison,
    copyLinkState,
    copyState,
    error,
    loading,
    mode,
    pdfState,
    report,
    shareState
  ]);

  useEffect(() => {
    const targets = Array.from(document.querySelectorAll<HTMLElement>("[data-reveal-id]"));
    if (targets.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const id = entry.target.getAttribute("data-reveal-id");
          if (!id || !entry.isIntersecting) return;
          setRevealedSections((previous) => {
            if (previous[id]) return previous;
            return { ...previous, [id]: true };
          });
          observer.unobserve(entry.target);
        });
      },
      { threshold: 0.16, rootMargin: "0px 0px -10% 0px" }
    );

    targets.forEach((target) => observer.observe(target));
    return () => {
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    try {
      const rawHistory = localStorage.getItem(HISTORY_STORAGE_KEY);
      if (!rawHistory) {
        setScanHistory([]);
      } else {
        const parsed = JSON.parse(rawHistory);
        if (!Array.isArray(parsed)) {
          setScanHistory([]);
        } else {
          const loadedEntries = parsed.filter(isScanHistoryEntry).slice(0, MAX_HISTORY_ITEMS);
          setScanHistory(loadedEntries);
        }
      }
    } catch {
      setScanHistory([]);
    }

    try {
      const rawSnapshots = localStorage.getItem(HISTORY_REPORT_STORAGE_KEY);
      if (!rawSnapshots) {
        setHistoryReportSnapshots({});
      } else {
        const parsed = JSON.parse(rawSnapshots);
        setHistoryReportSnapshots(normalizeHistoryReportSnapshots(parsed));
      }
    } catch {
      setHistoryReportSnapshots({});
    }

    setHistoryBootstrapped(true);
  }, []);

  useEffect(() => {
    try {
      const rawDomainHistory = localStorage.getItem(DOMAIN_HISTORY_STORAGE_KEY);
      if (!rawDomainHistory) {
        setDomainHistory({});
        return;
      }
      const parsed = JSON.parse(rawDomainHistory);
      setDomainHistory(normalizeDomainGradeHistory(parsed));
    } catch {
      setDomainHistory({});
    } finally {
      setDomainHistoryBootstrapped(true);
    }
  }, []);

  useEffect(() => {
    if (!historyBootstrapped) return;
    try {
      if (scanHistory.length === 0) {
        localStorage.removeItem(HISTORY_STORAGE_KEY);
      } else {
        localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(scanHistory));
      }
    } catch {
      // Ignore storage failures.
    }
  }, [historyBootstrapped, scanHistory]);

  useEffect(() => {
    if (!historyBootstrapped) return;
    try {
      if (Object.keys(historyReportSnapshots).length === 0) {
        localStorage.removeItem(HISTORY_REPORT_STORAGE_KEY);
      } else {
        localStorage.setItem(HISTORY_REPORT_STORAGE_KEY, JSON.stringify(historyReportSnapshots));
      }
    } catch {
      // Ignore storage failures.
    }
  }, [historyBootstrapped, historyReportSnapshots]);

  useEffect(() => {
    if (!historyBootstrapped) return;
    const validIds = new Set(scanHistory.map((entry) => entry.id));
    setHistoryReportSnapshots((previous) => {
      let changed = false;
      const trimmedSnapshots: Record<string, ReportResponse> = {};
      for (const [entryId, snapshot] of Object.entries(previous)) {
        if (!validIds.has(entryId)) {
          changed = true;
          continue;
        }
        trimmedSnapshots[entryId] = snapshot;
      }
      return changed ? trimmedSnapshots : previous;
    });
  }, [historyBootstrapped, scanHistory]);

  useEffect(() => {
    if (!domainHistoryBootstrapped) return;
    try {
      if (Object.keys(domainHistory).length === 0) {
        localStorage.removeItem(DOMAIN_HISTORY_STORAGE_KEY);
      } else {
        localStorage.setItem(DOMAIN_HISTORY_STORAGE_KEY, JSON.stringify(domainHistory));
      }
    } catch {
      // Ignore storage failures.
    }
  }, [domainHistory, domainHistoryBootstrapped]);

  useEffect(() => {
    if (isAuthenticated) return;
    setHistoryServerReady(false);
    setSyncedHistoryUserKey(null);
  }, [isAuthenticated]);

  useEffect(() => {
    if (isAuthenticated) return;
    setDomainHistoryServerReady(false);
    setSyncedDomainHistoryUserKey(null);
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated || !currentUserKey || !historyBootstrapped) return;
    if (syncedHistoryUserKey === currentUserKey) return;

    let cancelled = false;
    const localHistory = scanHistory;

    async function syncLocalAndRemoteHistory() {
      try {
        const response = await fetch("/api/user-data", { method: "GET", cache: "no-store" });
        const payload = response.ok ? ((await response.json()) as { scanHistory?: unknown }) : null;
        const serverHistory =
          payload && Array.isArray(payload.scanHistory)
            ? payload.scanHistory.filter(isScanHistoryEntry)
            : [];
        const mergedHistory = mergeScanHistories(localHistory, serverHistory);

        if (cancelled) return;
        setScanHistory(mergedHistory);

        await fetch("/api/user-data", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ scanHistory: mergedHistory })
        });
      } finally {
        if (!cancelled) {
          setHistoryServerReady(true);
          setSyncedHistoryUserKey(currentUserKey);
        }
      }
    }

    void syncLocalAndRemoteHistory();
    return () => {
      cancelled = true;
    };
  }, [currentUserKey, historyBootstrapped, isAuthenticated, scanHistory, syncedHistoryUserKey]);

  useEffect(() => {
    if (!isAuthenticated || !currentUserKey || !domainHistoryBootstrapped) return;
    if (syncedDomainHistoryUserKey === currentUserKey) return;

    let cancelled = false;
    const localDomainHistory = domainHistory;

    async function syncLocalAndRemoteDomainHistory() {
      try {
        const response = await fetch("/api/user-data", { method: "GET", cache: "no-store" });
        const payload = response.ok ? ((await response.json()) as { history?: unknown }) : null;
        const serverHistory = normalizeDomainGradeHistory(payload?.history);
        const mergedHistory = mergeDomainGradeHistories(localDomainHistory, serverHistory);

        if (cancelled) return;
        setDomainHistory(mergedHistory);

        await fetch("/api/user-data", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ history: mergedHistory })
        });
      } finally {
        if (!cancelled) {
          setDomainHistoryServerReady(true);
          setSyncedDomainHistoryUserKey(currentUserKey);
        }
      }
    }

    void syncLocalAndRemoteDomainHistory();
    return () => {
      cancelled = true;
    };
  }, [
    currentUserKey,
    domainHistory,
    domainHistoryBootstrapped,
    isAuthenticated,
    syncedDomainHistoryUserKey
  ]);

  useEffect(() => {
    if (!isAuthenticated || !currentUserKey || !historyServerReady) return;
    if (syncedHistoryUserKey !== currentUserKey) return;

    void fetch("/api/user-data", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scanHistory })
    }).catch(() => {
      // Ignore sync failures; local state remains source-of-truth until retry.
    });
  }, [currentUserKey, historyServerReady, isAuthenticated, scanHistory, syncedHistoryUserKey]);

  useEffect(() => {
    if (!isAuthenticated || !currentUserKey || !domainHistoryServerReady) return;
    if (syncedDomainHistoryUserKey !== currentUserKey) return;

    void fetch("/api/user-data", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ history: domainHistory })
    }).catch(() => {
      // Ignore sync failures; local state remains source-of-truth until retry.
    });
  }, [
    currentUserKey,
    domainHistory,
    domainHistoryServerReady,
    isAuthenticated,
    syncedDomainHistoryUserKey
  ]);

  useEffect(() => {
    const currentUrl = new URL(window.location.href);
    const shared = currentUrl.searchParams.get(SHARE_QUERY_PARAM);
    if (!shared) return;

    const decoded = decodeSharePayload(shared);
    if (!decoded) {
      setError("Unable to load the shared report from this link.");
      return;
    }

    setError(null);
    setCopyState("idle");
    setCopyLinkState("idle");
    setPdfState("idle");
    setShareState("idle");
    setSharePathCache(null);
    setLoading(false);
    setScanProgress(0);
    setBulkTargetCount(0);
    setBulkCompletedCount(0);

    if (decoded.mode === "single") {
      setMode("single");
      setUrl(decoded.report.checkedUrl);
      setReport(decoded.report);
      setReportSource("shared");
      setReportCachedAt(null);
      setComparison(null);
      setActiveHeaderDetail(null);
      return;
    }

    setMode("compare");
    setMobileCompareView("siteA");
    setCompareUrlA(decoded.comparison.siteA.checkedUrl);
    setCompareUrlB(decoded.comparison.siteB.checkedUrl);
    setReport(null);
    setReportSource(null);
    setReportCachedAt(null);
    setComparison(decoded.comparison);
    setActiveHeaderDetail(null);
  }, []);

  useEffect(() => {
    setCopyLinkState("idle");
    setBadgePanelOpen(false);
    setBadgeStyle("flat");
    setBadgeTheme("default");
    setBadgeLabel("security headers");
    setBadgeCopyState("idle");
  }, [mode, report?.checkedAt]);

  useEffect(() => {
    if (!currentSharePayload || !currentSharePayloadKey || reportSource === "shared") return;
    if (sharePathCache?.payloadKey === currentSharePayloadKey) return;

    let cancelled = false;
    void createSharedReportPath(currentSharePayload)
      .then((path) => {
        if (cancelled) return;
        setSharePathCache({ payloadKey: currentSharePayloadKey, path });
      })
      .catch(() => {
        // Keep scan flow resilient if share-link generation fails.
      });

    return () => {
      cancelled = true;
    };
  }, [currentSharePayload, currentSharePayloadKey, reportSource, sharePathCache?.payloadKey]);

  const addToHistory = useCallback((nextReport: ReportResponse) => {
    const nextEntry: HistoryEntry = {
      id: `${nextReport.checkedAt}-${nextReport.checkedUrl}`,
      url: nextReport.checkedUrl,
      grade: nextReport.grade,
      checkedAt: nextReport.checkedAt,
      score: nextReport.score,
      maxScore: nextReport.results.length * 2,
      headerStatuses: buildHeaderStatusSnapshot(nextReport.results)
    };

    setScanHistory((previous) => normalizeScanHistoryEntries([nextEntry, ...previous]));
    setHistoryReportSnapshots((previous) => ({
      ...previous,
      [nextEntry.id]: nextReport
    }));
    setDomainHistory((previous) =>
      recordDomainGradeHistoryPoint(previous, {
        url: nextReport.checkedUrl,
        grade: nextReport.grade,
        checkedAt: nextReport.checkedAt
      })
    );
  }, []);

  function clearHistory() {
    setScanHistory([]);
    setHistoryReportSnapshots({});
  }

  const requestReport = useCallback(
    async (targetUrl: string, options: ScanRequestOptions): Promise<ReportResponse> => {
      const sanitized = targetUrl.trim();
      if (!sanitized) {
        throw new Error("Please enter a URL.");
      }

      const startedAt = performance.now();
      const response = await fetch("/api/check", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ url: sanitized, options })
      });

      const payload = (await response.json().catch(() => null)) as { error?: unknown } | ReportResponse | null;
      if (!response.ok) {
        if (response.status === 429) {
          throw new Error("Rate limit reached. Please wait a moment before scanning again.");
        }
        const apiError =
          payload && typeof payload === "object" && "error" in payload && typeof payload.error === "string"
            ? payload.error
            : "Unable to check headers right now. Please try again.";
        throw new Error(apiError);
      }

      const finishedAt = performance.now();
      return {
        ...(payload as ReportResponse),
        scanDurationMs: Math.max(0, finishedAt - startedAt)
      };
    },
    []
  );

  const updatePopularSitesCache = useCallback((entries: PopularSiteCacheEntry[]) => {
    setPopularSitesCache((previous) => {
      const cacheMap = new Map(previous.map((entry) => [entry.url, entry]));
      for (const entry of entries) {
        cacheMap.set(entry.url, entry);
      }
      const ordered = POPULAR_SITES.map((site) => cacheMap.get(site)).filter(
        (entry): entry is PopularSiteCacheEntry => Boolean(entry)
      );
      localStorage.setItem(POPULAR_CACHE_STORAGE_KEY, JSON.stringify(ordered));
      return ordered;
    });
  }, []);

  const clearCurrentState = useCallback(() => {
    setError(null);
    setReport(null);
    setReportSource(null);
    setReportCachedAt(null);
    setComparison(null);
    setActiveHeaderDetail(null);
    setBulkResults([]);
    setBulkExportState("idle");
    setCopyState("idle");
    setCopyLinkState("idle");
    setPdfState("idle");
    setShareState("idle");
    setSharePathCache(null);
    setScanProgress(0);
    setBulkTargetCount(0);
    setBulkCompletedCount(0);

    if (mode === "single") {
      setUrl("");
    } else if (mode === "compare") {
      setCompareUrlA("");
      setCompareUrlB("");
    } else {
      setBulkUrlsInput("");
    }

    window.requestAnimationFrame(() => {
      if (mode === "single") {
        singleUrlInputRef.current?.focus();
      } else {
        compareUrlAInputRef.current?.focus();
      }
    });
  }, [mode]);

  const openShortcutsModal = useCallback(() => {
    if (document.activeElement instanceof HTMLElement) {
      lastFocusedElementRef.current = document.activeElement;
    }
    setShortcutsOpen(true);
  }, []);

  const closeShortcutsModal = useCallback(() => {
    setShortcutsOpen(false);
  }, []);

  const toggleShortcutsModal = useCallback(() => {
    if (!shortcutsOpen && document.activeElement instanceof HTMLElement) {
      lastFocusedElementRef.current = document.activeElement;
    }
    setShortcutsOpen((current) => !current);
  }, [shortcutsOpen]);

  const openHeaderDetailModal = useCallback((header: HeaderResult) => {
    if (document.activeElement instanceof HTMLElement) {
      lastFocusedElementRef.current = document.activeElement;
    }
    setActiveHeaderDetail(header);
  }, []);

  const closeHeaderDetailModal = useCallback(() => {
    setActiveHeaderDetail(null);
  }, []);

  const focusHeaderCardByShortcut = useCallback((shortcutIndex: number) => {
    const visibleCards = Array.from(document.querySelectorAll<HTMLElement>('[data-header-result-card="true"]')).filter(
      (card) => card.getClientRects().length > 0
    );
    const target = visibleCards[shortcutIndex];
    if (!target) return false;
    target.scrollIntoView({ behavior: "smooth", block: "center" });
    target.focus();
    return true;
  }, []);

  async function refreshPopularSite(site: string, openReport = false) {
    setActivePopularRefresh(site);
    try {
      const nextReport = await requestReport(site, scanRequestOptions);
      const nextEntry: PopularSiteCacheEntry = {
        url: site,
        report: nextReport,
        cachedAt: new Date().toISOString()
      };
      updatePopularSitesCache([nextEntry]);

      if (openReport) {
        setMode("single");
        setUrl(site);
        setReport(nextReport);
        setReportSource("live");
        setReportCachedAt(null);
        setComparison(null);
        setActiveHeaderDetail(null);
        setError(null);
        setCopyState("idle");
        setCopyLinkState("idle");
        setShareState("idle");
        setSharePathCache(null);
        addToHistory(nextReport);
        trackEvent("scan_complete", {
          mode: "single",
          grade: nextReport.grade,
          score: nextReport.score,
          domain: extractDomainFromUrl(nextReport.finalUrl) ?? extractDomainFromUrl(nextReport.checkedUrl) ?? site,
          source: "popular-refresh"
        });
      }
    } catch {
      if (openReport) {
        void runSingleCheck(site);
      }
    } finally {
      setActivePopularRefresh((current) => (current === site ? null : current));
    }
  }

  const runSingleCheck = useCallback(async (targetUrl: string) => {
    setLoading(true);
    setError(null);
    setReport(null);
    setReportSource(null);
    setReportCachedAt(null);
    setComparison(null);
    setActiveHeaderDetail(null);
    setBulkTargetCount(0);
    setBulkCompletedCount(0);
    setCopyState("idle");
    setCopyLinkState("idle");
    setShareState("idle");
    setSharePathCache(null);

    try {
      const payload = await requestReport(targetUrl, scanRequestOptions);
      setReport(payload);
      setReportSource("live");
      setReportCachedAt(null);
      addToHistory(payload);
      trackEvent("scan_complete", {
        mode: "single",
        grade: payload.grade,
        score: payload.score,
        domain: extractDomainFromUrl(payload.finalUrl) ?? extractDomainFromUrl(payload.checkedUrl) ?? "unknown",
        source: "live"
      });
    } catch (fetchError) {
      const message = fetchError instanceof Error ? fetchError.message : "Unexpected error.";
      setReport(null);
      setReportSource(null);
      setReportCachedAt(null);
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [addToHistory, requestReport, scanRequestOptions]);

  const runComparisonCheck = useCallback(async (siteAUrl: string, siteBUrl: string) => {
    if (!siteAUrl.trim() || !siteBUrl.trim()) {
      setError("Please enter both URLs to compare.");
      return;
    }

    setMobileCompareView("siteA");
    setLoading(true);
    setError(null);
    setReport(null);
    setReportSource(null);
    setReportCachedAt(null);
    setComparison(null);
    setActiveHeaderDetail(null);
    setBulkTargetCount(0);
    setBulkCompletedCount(0);
    setCopyState("idle");
    setCopyLinkState("idle");
    setShareState("idle");
    setSharePathCache(null);

    try {
      const [siteA, siteB] = await Promise.all([
        requestReport(siteAUrl, scanRequestOptions),
        requestReport(siteBUrl, scanRequestOptions)
      ]);
      setComparison({ siteA, siteB });
      addToHistory(siteA);
      addToHistory(siteB);
      trackEvent("scan_complete", {
        mode: "compare",
        gradeA: siteA.grade,
        gradeB: siteB.grade,
        domainA: extractDomainFromUrl(siteA.finalUrl) ?? extractDomainFromUrl(siteA.checkedUrl) ?? "unknown",
        domainB: extractDomainFromUrl(siteB.finalUrl) ?? extractDomainFromUrl(siteB.checkedUrl) ?? "unknown"
      });
    } catch (fetchError) {
      const message = fetchError instanceof Error ? fetchError.message : "Unexpected error.";
      setComparison(null);
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [addToHistory, requestReport, scanRequestOptions]);

  const runBulkCheck = useCallback(async (rawInput: string) => {
    const targets = rawInput
      .split(/\r?\n/)
      .map((entry) => entry.trim())
      .filter(Boolean);

    if (targets.length === 0) {
      setError("Please enter at least one URL for bulk scan.");
      setBulkResults([]);
      setBulkTargetCount(0);
      setBulkCompletedCount(0);
      return;
    }

    if (targets.length > MAX_BULK_URLS) {
      setError(`Bulk scan supports up to ${MAX_BULK_URLS} URLs per run.`);
      setBulkResults([]);
      setBulkTargetCount(0);
      setBulkCompletedCount(0);
      return;
    }

    setLoading(true);
    setError(null);
    setReport(null);
    setReportSource(null);
    setReportCachedAt(null);
    setComparison(null);
    setActiveHeaderDetail(null);
    setBulkResults([]);
    setBulkExportState("idle");
    setCopyState("idle");
    setCopyLinkState("idle");
    setShareState("idle");
    setSharePathCache(null);
    setBulkTargetCount(targets.length);
    setBulkCompletedCount(0);
    setScanProgress(0);

    try {
      let completed = 0;
      const settled = await Promise.allSettled(
        targets.map(async (target) => {
          try {
            return await requestReport(target, scanRequestOptions);
          } finally {
            completed += 1;
            setBulkCompletedCount(completed);
            setScanProgress(Math.round((completed / targets.length) * 100));
          }
        })
      );
      const nextResults = settled.map((result, index): BulkScanResult => {
        if (result.status === "fulfilled") {
          addToHistory(result.value);
          return {
            inputUrl: targets[index],
            report: result.value,
            error: null
          };
        }

        const message =
          result.reason instanceof Error ? result.reason.message : "Unable to check headers.";
        return {
          inputUrl: targets[index],
          report: null,
          error: message
        };
      });

      setBulkResults(nextResults);
      const failedCount = nextResults.filter((entry) => entry.error).length;
      const successCount = nextResults.length - failedCount;
      trackEvent("bulk_scan", {
        total: nextResults.length,
        successful: successCount,
        failed: failedCount
      });
      if (failedCount > 0) {
        setError(`${failedCount} of ${nextResults.length} URLs failed. Review the table for details.`);
      }
    } finally {
      setLoading(false);
    }
  }, [addToHistory, requestReport, scanRequestOptions]);

  function onSingleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void runSingleCheck(url);
  }

  function onHeroSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMode("single");
    void runSingleCheck(url);
  }

  function onCompareSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void runComparisonCheck(compareUrlA, compareUrlB);
  }

  function onBulkSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void runBulkCheck(bulkUrlsInput);
  }

  function onSampleClick(sampleUrl: string) {
    setMode("single");
    setUrl(sampleUrl);
    void runSingleCheck(sampleUrl);
  }

  function onViewHistoryEntryReport(entry: HistoryEntry) {
    const cachedReport = historyReportSnapshots[entry.id];
    if (cachedReport) {
      setMode("single");
      setUrl(cachedReport.checkedUrl);
      setError(null);
      setReport(cachedReport);
      setReportSource("cache");
      setReportCachedAt(cachedReport.checkedAt);
      setComparison(null);
      setActiveHeaderDetail(null);
      setCopyState("idle");
      setCopyLinkState("idle");
      setPdfState("idle");
      setShareState("idle");
      setSharePathCache(null);
      trackEvent("history_report_opened", {
        source: "recent-history",
        method: "snapshot",
        domain: extractDomainFromUrl(cachedReport.finalUrl) ?? extractDomainFromUrl(cachedReport.checkedUrl) ?? entry.url,
        grade: cachedReport.grade
      });
      return;
    }

    trackEvent("history_report_opened", {
      source: "recent-history",
      method: "rescan",
      domain: extractDomainFromUrl(entry.url) ?? entry.url
    });
    onHistoryEntryClick(entry.url);
  }

  function onHistoryEntryClick(entryUrl: string) {
    trackEvent("scan_again_clicked", {
      source: "recent-history",
      domain: extractDomainFromUrl(entryUrl) ?? entryUrl
    });
    setMode("single");
    setUrl(entryUrl);
    void runSingleCheck(entryUrl);
  }

  function onScanAgainClick() {
    if (!report || loading) return;
    trackEvent("scan_again_clicked", {
      source: "report-panel",
      domain: extractDomainFromUrl(report.finalUrl) ?? extractDomainFromUrl(report.checkedUrl) ?? "unknown"
    });
    setUrl(report.checkedUrl);
    void runSingleCheck(report.checkedUrl);
  }

  function onPopularSiteClick(site: string) {
    const cached = popularCacheByUrl.get(site);

    if (cached) {
      setMode("single");
      setUrl(site);
      setReport(cached.report);
      setReportSource("cache");
      setReportCachedAt(cached.cachedAt);
      setComparison(null);
      setActiveHeaderDetail(null);
      setError(null);
      setCopyState("idle");
      setCopyLinkState("idle");
      setShareState("idle");
      setSharePathCache(null);
      addToHistory(cached.report);
      trackEvent("popular_domain_opened", {
        domain: site,
        source: "cache",
        grade: cached.report.grade
      });
      return;
    }

    trackEvent("popular_domain_opened", {
      domain: site,
      source: "live-refresh"
    });
    void refreshPopularSite(site, true);
  }

  useEffect(() => {
    const currentUrl = new URL(window.location.href);
    if (currentUrl.searchParams.has(SHARE_QUERY_PARAM)) {
      return;
    }

    const rescanTarget = currentUrl.searchParams.get(RESCAN_QUERY_PARAM)?.trim();
    if (!rescanTarget) {
      return;
    }

    currentUrl.searchParams.delete(RESCAN_QUERY_PARAM);
    window.history.replaceState({}, "", currentUrl.toString());

    setMode("single");
    setUrl(rescanTarget);
    trackEvent("scan_again_clicked", {
      source: "shared-report-page",
      domain: extractDomainFromUrl(rescanTarget) ?? rescanTarget
    });
    void runSingleCheck(rescanTarget);
  }, [runSingleCheck]);

  async function onCopyReport() {
    if (!report) return;

    try {
      const shareUrl = await createCurrentShareUrl().catch(() => null);
      await navigator.clipboard.writeText(formatReportAsMarkdown(report, shareUrl));
      setCopyState("copied");
      notify({ tone: "success", message: "Markdown report copied to clipboard." });
    } catch {
      setCopyState("error");
      notify({ tone: "error", message: "Clipboard unavailable. Copy markdown manually instead." });
    } finally {
      window.setTimeout(() => setCopyState("idle"), 2500);
    }
  }

  async function onCopyShareLink() {
    if (!report && !comparison) return;

    try {
      const shareUrl = await createCurrentShareUrl();
      await navigator.clipboard.writeText(shareUrl);
      setCopyLinkState("copied");
      trackEvent("report_shared", {
        mode: report ? "single" : "compare",
        method: "copy-link"
      });
      notify({ tone: "success", message: "Shareable link copied to clipboard." });
    } catch {
      setCopyLinkState("error");
      notify({ tone: "error", message: "Could not copy a shareable link right now." });
    } finally {
      window.setTimeout(() => setCopyLinkState("idle"), 3000);
    }
  }

  async function onCopyBadgeCode(format: "markdown" | "html") {
    if (!badgeDomain || !badgeUrl) return;

    try {
      const content = format === "markdown" ? badgeMarkdownCode : badgeHtmlCode;
      await navigator.clipboard.writeText(content);
      setBadgeCopyState(format);
      notify({
        tone: "success",
        message: format === "markdown" ? "Badge markdown copied." : "Badge HTML copied."
      });
    } catch {
      setBadgeCopyState("error");
      notify({ tone: "error", message: "Clipboard unavailable. Copy badge code manually." });
    } finally {
      window.setTimeout(() => setBadgeCopyState("idle"), 2500);
    }
  }

  function onExportBulkCsv() {
    if (bulkResults.length === 0) return;

    try {
      const headerRow = [
        "Input URL",
        "Checked URL",
        "Final URL",
        "HTTP Status",
        "Grade",
        "Score",
        "Checked At",
        "Error"
      ];

      const dataRows = bulkResults.map((entry) => {
        const reportData = entry.report;
        return [
          entry.inputUrl,
          reportData?.checkedUrl ?? "",
          reportData?.finalUrl ?? "",
          reportData ? String(reportData.statusCode) : "",
          reportData?.grade ?? "",
          reportData ? `${reportData.score}/${reportData.results.length * 2}` : "",
          reportData?.checkedAt ?? "",
          entry.error ?? ""
        ];
      });

      const csvContent = [headerRow, ...dataRows]
        .map((row) => row.map((cell) => escapeCsvCell(cell)).join(","))
        .join("\n");

      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = `security-bulk-scan-${Date.now()}.csv`;
      document.body.append(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(objectUrl);

      setBulkExportState("exported");
      notify({ tone: "success", message: "Bulk scan results exported as CSV." });
    } catch {
      setBulkExportState("error");
      notify({ tone: "error", message: "Could not export CSV. Please try again." });
    } finally {
      window.setTimeout(() => setBulkExportState("idle"), 2500);
    }
  }

  async function createCurrentShareUrl(): Promise<string> {
    const payload = currentSharePayload;
    const payloadKey = currentSharePayloadKey;
    if (!payload || !payloadKey) {
      throw new Error("No report available to share.");
    }

    if (sharePathCache?.payloadKey === payloadKey) {
      return new URL(sharePathCache.path, window.location.origin).toString();
    }

    const sharePath = await createSharedReportPath(payload);
    setSharePathCache({ payloadKey, path: sharePath });
    return new URL(sharePath, window.location.origin).toString();
  }

  async function onShareResults() {
    if (!report && !comparison) return;

    try {
      const shareUrl = await createCurrentShareUrl();
      const text = "Security Header Checker report";
      if (navigator.share) {
        await navigator.share({
          title: "Security Header Checker Report",
          text,
          url: shareUrl
        });
        setShareState("shared");
        trackEvent("report_shared", {
          mode: report ? "single" : "compare",
          method: "native"
        });
        notify({ tone: "success", message: "Report shared." });
      } else {
        await navigator.clipboard.writeText(shareUrl);
        setShareState("copied");
        trackEvent("report_shared", {
          mode: report ? "single" : "compare",
          method: "clipboard"
        });
        notify({ tone: "success", message: "Shareable link copied to clipboard." });
      }
    } catch (shareError) {
      if (shareError instanceof DOMException && shareError.name === "AbortError") {
        setShareState("idle");
        return;
      }
      setShareState("error");
      notify({ tone: "error", message: "Could not share this report right now." });
    } finally {
      window.setTimeout(() => setShareState("idle"), 3000);
    }
  }

  async function onShareToTwitter() {
    if (!report) return;

    try {
      const shareUrl = await createCurrentShareUrl();
      const targetUrl = new URL("https://twitter.com/intent/tweet");
      targetUrl.searchParams.set("text", socialShareText(report));
      targetUrl.searchParams.set("url", shareUrl);
      window.open(targetUrl.toString(), "_blank", "noopener,noreferrer");
      trackEvent("report_shared", { mode: "single", method: "twitter" });
      notify({ tone: "success", message: "Opened X sharing in a new tab." });
    } catch {
      notify({ tone: "error", message: "Could not open X sharing right now." });
    }
  }

  async function onShareToLinkedIn() {
    if (!report) return;

    try {
      const shareUrl = await createCurrentShareUrl();
      const targetUrl = new URL("https://www.linkedin.com/sharing/share-offsite/");
      targetUrl.searchParams.set("url", shareUrl);
      window.open(targetUrl.toString(), "_blank", "noopener,noreferrer");
      trackEvent("report_shared", { mode: "single", method: "linkedin" });
      notify({ tone: "success", message: "Opened LinkedIn sharing in a new tab." });
    } catch {
      notify({ tone: "error", message: "Could not open LinkedIn sharing right now." });
    }
  }

  function onCompareTouchStart(event: TouchEvent<HTMLDivElement>) {
    if (window.innerWidth >= 1024) return;
    compareTouchStartXRef.current = event.changedTouches[0]?.clientX ?? null;
  }

  function onCompareTouchEnd(event: TouchEvent<HTMLDivElement>) {
    if (window.innerWidth >= 1024) return;
    const start = compareTouchStartXRef.current;
    compareTouchStartXRef.current = null;
    if (start === null) return;
    const end = event.changedTouches[0]?.clientX;
    if (typeof end !== "number") return;
    const deltaX = end - start;
    if (Math.abs(deltaX) < 45) return;
    setMobileCompareView(deltaX < 0 ? "siteB" : "siteA");
  }

  function onHistoryTouchStart(event: TouchEvent<HTMLUListElement>) {
    if (window.innerWidth >= 640) return;
    historyTouchStartXRef.current = event.changedTouches[0]?.clientX ?? null;
  }

  function onHistoryTouchEnd(event: TouchEvent<HTMLUListElement>) {
    if (window.innerWidth >= 640) return;

    const start = historyTouchStartXRef.current;
    historyTouchStartXRef.current = null;
    if (start === null) return;

    const end = event.changedTouches[0]?.clientX;
    if (typeof end !== "number") return;
    const deltaX = end - start;
    if (Math.abs(deltaX) < 45) return;

    setActiveHistoryIndex((current) => {
      if (scanHistory.length === 0) return 0;
      if (deltaX < 0) return Math.min(current + 1, scanHistory.length - 1);
      return Math.max(current - 1, 0);
    });
  }

  useEffect(() => {
    try {
      const rawPopularSites = localStorage.getItem(POPULAR_CACHE_STORAGE_KEY);
      if (!rawPopularSites) return;

      const parsed = JSON.parse(rawPopularSites);
      if (!Array.isArray(parsed)) return;

      const loadedEntries = parsed
        .filter(isPopularSiteCacheEntry)
        .filter((entry) => POPULAR_SITES.includes(entry.url));
      const ordered = POPULAR_SITES.map((site) =>
        loadedEntries.find((entry) => entry.url === site)
      ).filter((entry): entry is PopularSiteCacheEntry => Boolean(entry));
      setPopularSitesCache(ordered);
    } catch {
      setPopularSitesCache([]);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    const staleSites = POPULAR_SITES.filter((site) => {
      const cached = popularCacheByUrl.get(site);
      if (!cached) return true;
      return Date.now() - new Date(cached.cachedAt).getTime() > POPULAR_CACHE_TTL_MS;
    });

    if (staleSites.length === 0) return;

    setPopularRefreshing(true);
    void Promise.all(
      staleSites.map(async (site) => {
        try {
          const nextReport = await requestReport(site, scanRequestOptions);
          return {
            url: site,
            report: nextReport,
            cachedAt: new Date().toISOString()
          } satisfies PopularSiteCacheEntry;
        } catch {
          return null;
        }
      })
    )
      .then((results) => {
        if (cancelled) return;
        const nextEntries = results.filter(
          (entry): entry is PopularSiteCacheEntry => Boolean(entry)
        );
        if (nextEntries.length > 0) {
          updatePopularSitesCache(nextEntries);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setPopularRefreshing(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [popularCacheByUrl, requestReport, scanRequestOptions, updatePopularSitesCache]);

  useEffect(() => {
    if (loading) {
      if (mode === "bulk") {
        return;
      }
      setScanProgress(9);
      const timer = window.setInterval(() => {
        setScanProgress((current) => {
          if (current >= 92) return current;
          const nextStep = Math.min(current + Math.random() * 14 + 3, 92);
          return Math.round(nextStep);
        });
      }, 220);

      return () => {
        window.clearInterval(timer);
      };
    }

    if (scanProgress === 0) return;

    setScanProgress(100);
    const resetTimer = window.setTimeout(() => setScanProgress(0), 380);
    return () => {
      window.clearTimeout(resetTimer);
    };
  }, [loading, mode, scanProgress]);

  useEffect(() => {
    if (!report || loading || report.grade !== "A") return;

    const celebrationId = `${report.checkedAt}-${report.checkedUrl}`;
    if (celebratedScanRef.current === celebrationId) return;
    celebratedScanRef.current = celebrationId;

    setGradeConfettiTrigger((current) => current + 1);
  }, [loading, report]);

  useEffect(() => {
    setActiveHistoryIndex((current) => {
      if (scanHistory.length === 0) return 0;
      return Math.min(current, scanHistory.length - 1);
    });
  }, [scanHistory.length]);

  useEffect(() => {
    if (typeof window === "undefined" || window.innerWidth >= 640 || scanHistory.length === 0) return;
    const activeHistoryEntry = document.querySelector<HTMLElement>(`[data-history-entry-index="${activeHistoryIndex}"]`);
    activeHistoryEntry?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" });
  }, [activeHistoryIndex, scanHistory.length]);

  useEffect(() => {
    if (loading) {
      wasLoadingForHapticsRef.current = true;
      return;
    }
    if (!wasLoadingForHapticsRef.current) return;
    wasLoadingForHapticsRef.current = false;

    let completionKey: string | null = null;
    if (report) {
      completionKey = `single:${report.checkedAt}:${report.checkedUrl}`;
    } else if (comparison) {
      completionKey = `compare:${comparison.siteA.checkedAt}:${comparison.siteB.checkedAt}`;
    } else if (mode === "bulk" && bulkResults.length > 0) {
      completionKey = `bulk:${bulkResults.length}:${bulkResults.map((entry) => entry.report?.checkedAt ?? entry.inputUrl).join("|")}`;
    }

    if (!completionKey || lastHapticFeedbackRef.current === completionKey) return;
    lastHapticFeedbackRef.current = completionKey;
    triggerHapticFeedback();
  }, [bulkResults, comparison, loading, mode, report, triggerHapticFeedback]);

  useEffect(() => {
    if (!shortcutsOpen) return;
    const previousBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    window.setTimeout(() => {
      shortcutCloseButtonRef.current?.focus();
    }, 0);

    const onModalKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Tab") return;
      const dialog = shortcutsDialogRef.current;
      if (!dialog) return;

      const focusableElements = dialog.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (focusableElements.length === 0) return;

      const first = focusableElements[0];
      const last = focusableElements[focusableElements.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    window.addEventListener("keydown", onModalKeyDown);
    return () => {
      window.removeEventListener("keydown", onModalKeyDown);
      document.body.style.overflow = previousBodyOverflow;
      lastFocusedElementRef.current?.focus();
    };
  }, [shortcutsOpen]);

  useEffect(() => {
    if (!activeHeaderDetail) return;

    const previousBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    window.setTimeout(() => {
      headerDetailCloseButtonRef.current?.focus();
    }, 0);

    const onModalKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Tab") return;
      const dialog = headerDetailDialogRef.current;
      if (!dialog) return;

      const focusableElements = dialog.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (focusableElements.length === 0) return;

      const first = focusableElements[0];
      const last = focusableElements[focusableElements.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    window.addEventListener("keydown", onModalKeyDown);
    return () => {
      window.removeEventListener("keydown", onModalKeyDown);
      document.body.style.overflow = previousBodyOverflow;
      lastFocusedElementRef.current?.focus();
    };
  }, [activeHeaderDetail]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.repeat) return;
      const isTypingTarget = isTextInputLikeTarget(event.target);

      if (event.key === "Escape") {
        if (activeHeaderDetail) {
          event.preventDefault();
          closeHeaderDetailModal();
          return;
        }
        if (shortcutsOpen) {
          event.preventDefault();
          closeShortcutsModal();
          return;
        }
        if (badgePanelOpen) {
          event.preventDefault();
          setBadgePanelOpen(false);
          return;
        }
        if (advancedOptionsOpen) {
          event.preventDefault();
          setAdvancedOptionsOpen(false);
          return;
        }
        if (!loading) {
          event.preventDefault();
          clearCurrentState();
        }
        return;
      }

      if (shortcutsOpen || activeHeaderDetail) {
        return;
      }

      if (event.key === "?" && !isTypingTarget) {
        event.preventDefault();
        toggleShortcutsModal();
        return;
      }

      if (event.key === "/" && !isTypingTarget && !event.metaKey && !event.ctrlKey && !event.altKey) {
        event.preventDefault();
        scrollToScanInput();
        return;
      }

      const hasPrimaryModifier = event.ctrlKey || event.metaKey;
      if (hasPrimaryModifier && !event.altKey) {
        const normalizedKey = event.key.toLowerCase();
        if (normalizedKey === "enter") {
          event.preventDefault();
          if (mode === "single") {
            void runSingleCheck(url);
          } else if (mode === "compare") {
            void runComparisonCheck(compareUrlA, compareUrlB);
          } else {
            void runBulkCheck(bulkUrlsInput);
          }
          return;
        }

        if (normalizedKey === "k") {
          event.preventDefault();
          scrollToScanInput();
          return;
        }

        if (normalizedKey === "p" && !loading && pdfState !== "generating" && report) {
          event.preventDefault();
          setPdfExportRequestKey((current) => current + 1);
          return;
        }
      }

      if (!loading && !event.metaKey && !event.ctrlKey && !event.altKey && !isTypingTarget) {
        if (/^[1-6]$/.test(event.key)) {
          const jumped = focusHeaderCardByShortcut(Number(event.key) - 1);
          if (jumped) {
            event.preventDefault();
          }
          return;
        }
      }

      if (loading || event.metaKey || event.ctrlKey || event.altKey) return;

      if (event.key === "Enter") {
        if (event.target instanceof HTMLTextAreaElement) {
          return;
        }
        event.preventDefault();
        if (mode === "single") {
          void runSingleCheck(url);
        } else if (mode === "compare") {
          void runComparisonCheck(compareUrlA, compareUrlB);
        } else {
          void runBulkCheck(bulkUrlsInput);
        }
        return;
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [
    activeHeaderDetail,
    advancedOptionsOpen,
    badgePanelOpen,
    bulkUrlsInput,
    closeHeaderDetailModal,
    closeShortcutsModal,
    clearCurrentState,
    compareUrlA,
    compareUrlB,
    comparison,
    focusHeaderCardByShortcut,
    loading,
    mode,
    pdfState,
    report,
    runBulkCheck,
    runComparisonCheck,
    runSingleCheck,
    scrollToScanInput,
    shortcutsOpen,
    toggleShortcutsModal,
    url
  ]);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-4 py-10 sm:px-6 lg:px-8">
      <Suspense fallback={null}>
        <ConfettiLauncher triggerKey={gradeConfettiTrigger} preset="grade" />
      </Suspense>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(webApplicationSchema) }}
      />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />
      <p className="sr-only" aria-live="polite" aria-atomic="true">
        {liveRegionMessage}
      </p>
      <SiteNav />
      <a
        href="#scan-workbench"
        className="sr-only fixed left-3 top-16 z-[100] rounded-md border border-sky-400 bg-slate-950 px-4 py-2 text-sm font-semibold text-sky-100 shadow-lg shadow-slate-950 focus:not-sr-only focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/70"
      >
        Skip to scan workbench
      </a>
      <ScannerOnboardingTour onJumpToWorkbench={scrollToScanInput} />

      <section className="mb-6 overflow-hidden rounded-2xl border border-sky-500/20 bg-gradient-to-br from-slate-900/90 via-slate-900/80 to-sky-950/40 p-6 shadow-2xl shadow-slate-950/70 backdrop-blur">
        <div className="grid gap-6 md:grid-cols-[1fr_auto] md:items-center">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-300">Product launch edition</p>
            <h1 className="mt-2 text-3xl font-semibold text-slate-100 sm:text-5xl">
              Ship safer websites with instant security header checks
            </h1>
            <p className="mt-4 max-w-2xl text-slate-300">
              Run scans, compare environments, and monitor regressions from one dashboard. Security Header Checker
              helps teams tighten HTTP protections before every release without slowing down delivery.
            </p>
            <form onSubmit={onHeroSubmit} className="mt-5">
              <label htmlFor="hero-scan-url" className="sr-only">
                Website URL to scan from hero
              </label>
              <div className="flex flex-col gap-2 sm:flex-row">
                <input
                  id="hero-scan-url"
                  type="text"
                  value={url}
                  onChange={(event) => setUrl(event.target.value)}
                  placeholder="Try it now: example.com"
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-100 placeholder:text-slate-500 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/30"
                  required
                />
                <button
                  type="submit"
                  disabled={loading}
                  className="rounded-xl bg-sky-500 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
                >
                  {loading ? "Scanning..." : "Try the scanner"}
                </button>
              </div>
            </form>
            <div className="mt-4 flex flex-wrap gap-2">
              <span className="rounded-full border border-sky-500/30 bg-sky-500/10 px-3 py-1 text-xs font-medium text-sky-100">
                Launch-ready checks
              </span>
              <span className="rounded-full border border-sky-500/30 bg-sky-500/10 px-3 py-1 text-xs font-medium text-sky-100">
                CI-friendly API
              </span>
              <span className="rounded-full border border-sky-500/30 bg-sky-500/10 px-3 py-1 text-xs font-medium text-sky-100">
                Watchlist alerts
              </span>
            </div>
            <div className="mt-5 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={scrollToScanInput}
                className="rounded-lg bg-sky-500 px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-950 transition hover:bg-sky-400"
              >
                Start scanning now
              </button>
              <a
                href="#feature-cards"
                className="rounded-lg border border-slate-700 bg-slate-950/80 px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-200 transition hover:border-sky-500/60 hover:text-sky-200"
              >
                Explore features
              </a>
            </div>
          </div>
          <HeroShieldIcon />
        </div>
      </section>

      <section
        id="trusted-by"
        data-reveal-id="trusted-by"
        className={`${revealClass("trusted-by")} lazy-section mb-6 rounded-2xl border border-slate-800/90 bg-slate-900/60 p-6 shadow-xl shadow-slate-950/60`}
      >
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-sky-300">Trusted by</p>
            <h2 className="mt-2 text-2xl font-semibold text-slate-100 sm:text-3xl">Teams shipping every week</h2>
            <p className="mt-2 text-sm text-sky-200">Trusted by {TRUSTED_DEVELOPER_COUNT} developers</p>
          </div>
          <p className="max-w-xl text-sm text-slate-300">
            Example launch metrics and logos to show product confidence before customer references are finalized.
          </p>
        </div>
        <div className="mt-5 flex flex-wrap gap-2">
          {TRUSTED_BY_LOGOS.map((logo) => (
            <span
              key={logo}
              className="motion-card rounded-lg border border-slate-700/90 bg-slate-950/70 px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-300"
            >
              {logo}
            </span>
          ))}
        </div>
        <div className="mt-5 grid gap-3 md:grid-cols-3">
          {TRUSTED_BY_METRICS.map((metric) => (
            <article key={metric.label} className="motion-card rounded-xl border border-slate-800/90 bg-slate-950/60 p-4">
              <p className="text-xs uppercase tracking-[0.12em] text-slate-400">{metric.label}</p>
              <p className="mt-2 text-2xl font-semibold text-sky-200">{metric.value}</p>
            </article>
          ))}
        </div>
      </section>

      <section
        id="testimonials"
        data-reveal-id="testimonials"
        className={`${revealClass("testimonials")} lazy-section mb-6 rounded-2xl border border-slate-800/90 bg-slate-900/60 p-6 shadow-xl shadow-slate-950/60`}
      >
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-sky-300">Customer feedback</p>
            <h2 className="mt-2 text-2xl font-semibold text-slate-100 sm:text-3xl">What teams are saying</h2>
          </div>
          <p className="max-w-xl text-sm text-slate-300">
            Placeholder customer quotes with realistic roles and companies for launch storytelling.
          </p>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-3">
          {TESTIMONIALS.map((testimonial) => (
            <article key={`${testimonial.name}-${testimonial.company}`} className="motion-card rounded-xl border border-slate-800/90 bg-slate-950/60 p-4">
              <p className="text-sm leading-relaxed text-slate-200">“{testimonial.quote}”</p>
              <div className="mt-4 flex items-center gap-3">
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-700 bg-slate-900 text-xs font-semibold text-sky-200">
                  {initialsFromName(testimonial.name)}
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-100">{testimonial.name}</p>
                  <p className="truncate text-xs text-slate-400">
                    {testimonial.role}, {testimonial.company}
                  </p>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section
        id="feature-cards"
        data-reveal-id="feature-cards"
        className={`${revealClass("feature-cards")} lazy-section mb-6 rounded-2xl border border-slate-800/90 bg-slate-900/60 p-6 shadow-xl shadow-slate-950/60`}
      >
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-sky-300">Feature highlights</p>
            <h2 className="mt-2 text-2xl font-semibold text-slate-100 sm:text-3xl">Built for modern release workflows</h2>
          </div>
          <p className="max-w-xl text-sm text-slate-300">
            Everything you need to scan manually, compare instantly, monitor continuously, and automate checks.
          </p>
        </div>
        <div className="mt-5 grid gap-3 md:grid-cols-2">
          {LAUNCH_FEATURES.map((feature) => (
            <article
              key={feature.title}
              className="motion-card rounded-xl border border-slate-800/90 bg-slate-950/60 p-4 transition hover:border-sky-500/40"
            >
              <h3 className="text-base font-semibold text-slate-100">{feature.title}</h3>
              <p className="mt-2 text-sm text-slate-300">{feature.description}</p>
              <p className="mt-4 text-xs uppercase tracking-[0.14em] text-sky-300">{feature.cta}</p>
            </article>
          ))}
        </div>
      </section>

      <section
        id="integrate"
        data-reveal-id="integrate"
        className={`${revealClass("integrate")} lazy-section mb-6 rounded-2xl border border-slate-800/90 bg-slate-900/60 p-6 shadow-xl shadow-slate-950/60`}
      >
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-sky-300">Integrate</p>
            <h2 className="mt-2 text-2xl font-semibold text-slate-100 sm:text-3xl">
              Plug checks into your delivery pipeline
            </h2>
          </div>
          <p className="max-w-xl text-sm text-slate-300">
            Use the official CLI for quick automation, or run the GitHub Action to gate pull requests and publish scan
            outputs.
          </p>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-2">
          <article className="motion-card rounded-xl border border-slate-800/90 bg-slate-950/60 p-4">
            <h3 className="text-base font-semibold text-slate-100">CLI in CI</h3>
            <p className="mt-2 text-sm text-slate-300">
              Run an install-free scan and fail the job automatically when grade policy is not met.
            </p>
            <pre className="mt-3 overflow-x-auto rounded-xl border border-slate-800 bg-slate-950/80 p-4 text-xs text-slate-200">
              <code>{INTEGRATE_CLI_SNIPPET}</code>
            </pre>
          </article>

          <article className="motion-card rounded-xl border border-slate-800/90 bg-slate-950/60 p-4">
            <h3 className="text-base font-semibold text-slate-100">GitHub Action</h3>
            <p className="mt-2 text-sm text-slate-300">
              Composite action for pull requests and workflow dispatch runs with outputs for grade, score, and shared
              report URL.
            </p>
            <pre className="mt-3 overflow-x-auto rounded-xl border border-slate-800 bg-slate-950/80 p-4 text-xs text-slate-200">
              <code>{INTEGRATE_ACTION_SNIPPET}</code>
            </pre>
          </article>
        </div>

        <p className="mt-4 text-sm text-slate-300">
          Need full examples?{" "}
          <Link href="/docs/ci-cd" className="text-sky-300 transition hover:text-sky-200">
            Open CI/CD docs
          </Link>{" "}
          and{" "}
          <Link href="/docs/api" className="text-sky-300 transition hover:text-sky-200">
            API reference
          </Link>
          .
        </p>
      </section>

      <section
        id="scan-workbench"
        className="rounded-2xl border border-slate-800/80 bg-slate-900/70 p-6 shadow-2xl shadow-slate-950/70 backdrop-blur"
        aria-busy={loading}
      >
        <h2 className="text-2xl font-semibold text-slate-100 sm:text-3xl">Run a Security Header Scan</h2>
        <p className="mt-2 max-w-2xl text-slate-300">
          Scan one site for a detailed report, or compare two sites side by side to spot header gaps.
        </p>

        <div className="mt-6 inline-flex w-full rounded-xl border border-slate-700 bg-slate-950/80 p-1 sm:w-auto">
          <button
            type="button"
            onClick={() => setMode("single")}
            aria-pressed={mode === "single"}
            aria-label="Switch to single scan mode"
            className={`flex-1 rounded-lg px-4 py-2 text-sm font-medium transition sm:flex-none ${
              mode === "single"
                ? "bg-sky-500 text-slate-950 shadow-md shadow-sky-950/70"
                : "text-slate-300 hover:text-sky-200"
            }`}
          >
            Single Scan
          </button>
          <button
            type="button"
            onClick={() => {
              setMode("compare");
              setMobileCompareView("siteA");
            }}
            aria-pressed={mode === "compare"}
            aria-label="Switch to compare mode"
            className={`flex-1 rounded-lg px-4 py-2 text-sm font-medium transition sm:flex-none ${
              mode === "compare"
                ? "bg-sky-500 text-slate-950 shadow-md shadow-sky-950/70"
                : "text-slate-300 hover:text-sky-200"
            }`}
          >
            Compare
          </button>
          <button
            type="button"
            onClick={() => setMode("bulk")}
            aria-pressed={mode === "bulk"}
            aria-label="Switch to bulk scan mode"
            className={`flex-1 rounded-lg px-4 py-2 text-sm font-medium transition sm:flex-none ${
              mode === "bulk"
                ? "bg-sky-500 text-slate-950 shadow-md shadow-sky-950/70"
                : "text-slate-300 hover:text-sky-200"
            }`}
          >
            Bulk Scan
          </button>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-500">
          <p>
            Shortcuts: <span className="text-slate-300">Cmd/Ctrl+Enter</span> scan,{" "}
            <span className="text-slate-300">Cmd/Ctrl+K</span> focus URL,{" "}
            <span className="text-slate-300">1-6</span> jump headers,{" "}
            <span className="text-slate-300">Ctrl+P</span> PDF.
          </p>
          <button
            type="button"
            onClick={openShortcutsModal}
            aria-haspopup="dialog"
            aria-expanded={shortcutsOpen}
            aria-controls="keyboard-shortcuts-modal"
            className="rounded-md border border-slate-700 px-2 py-1 text-[11px] uppercase tracking-[0.12em] text-slate-300 transition hover:border-sky-500/60 hover:text-sky-200"
          >
            Keyboard help (?)
          </button>
        </div>

        {mode === "single" ? (
          <>
            <form onSubmit={onSingleSubmit} className="mt-6 flex flex-col gap-3 sm:flex-row">
              <label htmlFor="single-site-url" className="sr-only">
                Website URL to scan
              </label>
              <input
                id="single-site-url"
                ref={singleUrlInputRef}
                type="text"
                value={url}
                onChange={(event) => setUrl(event.target.value)}
                placeholder="example.com or https://example.com"
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-5 py-4 text-base text-slate-100 placeholder:text-slate-500 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/30"
                aria-describedby="single-scan-hint"
                required
              />
              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-xl bg-sky-500 px-5 py-4 font-medium text-slate-950 transition hover:bg-sky-400 sm:w-auto disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
              >
                {loading ? "Scanning..." : "Check"}
              </button>
            </form>
            <p id="single-scan-hint" className="mt-2 text-xs text-slate-500">
              Enter a domain or full URL and press Cmd/Ctrl+Enter to scan.
            </p>

            <div className="mt-4">
              <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Try sample sites</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {SAMPLE_SITES.map((sample) => (
                  <button
                    key={sample}
                    type="button"
                    onClick={() => onSampleClick(sample)}
                    disabled={loading}
                    className="rounded-lg border border-slate-700 bg-slate-950/80 px-3 py-1.5 text-sm text-slate-200 transition hover:border-sky-500/60 hover:text-sky-200 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {sample}
                  </button>
                ))}
              </div>
            </div>
          </>
        ) : mode === "compare" ? (
          <form onSubmit={onCompareSubmit} className="mt-6">
            <div className="grid gap-3 md:grid-cols-2">
              <label htmlFor="compare-site-a-url" className="sr-only">
                Site A URL
              </label>
              <input
                id="compare-site-a-url"
                ref={compareUrlAInputRef}
                type="text"
                value={compareUrlA}
                onChange={(event) => setCompareUrlA(event.target.value)}
                placeholder="Site A (example.com)"
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-5 py-4 text-base text-slate-100 placeholder:text-slate-500 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/30"
                required
              />
              <label htmlFor="compare-site-b-url" className="sr-only">
                Site B URL
              </label>
              <input
                id="compare-site-b-url"
                type="text"
                value={compareUrlB}
                onChange={(event) => setCompareUrlB(event.target.value)}
                placeholder="Site B (example.org)"
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-5 py-4 text-base text-slate-100 placeholder:text-slate-500 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/30"
                required
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="mt-3 w-full rounded-xl bg-sky-500 px-5 py-4 font-medium text-slate-950 transition hover:bg-sky-400 sm:w-auto disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
            >
              {loading ? "Comparing..." : "Compare Headers"}
            </button>
            <p className="mt-2 text-xs text-slate-500">
              Tip: enter two domains, then use Cmd/Ctrl+Enter to run comparison.
            </p>
          </form>
        ) : (
          <form onSubmit={onBulkSubmit} className="mt-6 space-y-3">
            <label htmlFor="bulk-scan-urls" className="sr-only">
              Website URLs for bulk scan
            </label>
            <textarea
              id="bulk-scan-urls"
              value={bulkUrlsInput}
              onChange={(event) => setBulkUrlsInput(event.target.value)}
              placeholder={"example.com\nhttps://mozilla.org\ncloudflare.com"}
              rows={8}
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-5 py-4 text-sm text-slate-100 placeholder:text-slate-500 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/30"
              aria-describedby="bulk-scan-hint"
              required
            />
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p id="bulk-scan-hint" className="text-xs text-slate-500">
                Enter one URL per line (up to {MAX_BULK_URLS}). {bulkUrlCount}/{MAX_BULK_URLS} URLs added.
              </p>
              <button
                type="submit"
                disabled={loading}
                className="rounded-xl bg-sky-500 px-5 py-3 text-sm font-medium text-slate-950 transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
              >
                {loading ? "Scanning..." : "Run Bulk Scan"}
              </button>
            </div>
          </form>
        )}

        <section className="mt-4 rounded-xl border border-slate-800/90 bg-slate-950/60">
          <button
            type="button"
            onClick={() => setAdvancedOptionsOpen((current) => !current)}
            aria-expanded={advancedOptionsOpen}
            aria-controls="scan-advanced-options"
            className="flex w-full items-center justify-between px-4 py-3 text-left transition hover:bg-slate-900/60"
          >
            <span className="text-sm font-medium text-slate-200">Advanced options</span>
            <span className="text-xs uppercase tracking-[0.14em] text-slate-400">
              {advancedOptionsOpen ? "Hide" : "Show"}
            </span>
          </button>
          {advancedOptionsOpen && (
            <div id="scan-advanced-options" className="border-t border-slate-800/90 px-4 py-4">
              <div className="grid gap-4 lg:grid-cols-2">
                <div>
                  <label htmlFor="scan-user-agent-preset" className="text-xs uppercase tracking-[0.14em] text-slate-500">
                    Custom User-Agent
                  </label>
                  <select
                    id="scan-user-agent-preset"
                    value={userAgentPreset}
                    onChange={(event) => {
                      const nextPreset = event.target.value as UserAgentPresetChoice;
                      setUserAgentPreset(nextPreset);
                      if (nextPreset === "default") {
                        setCustomUserAgent("");
                        return;
                      }
                      if (nextPreset === "custom") {
                        return;
                      }
                      const preset = USER_AGENT_PRESETS.find((item) => item.id === nextPreset);
                      setCustomUserAgent(preset?.value ?? "");
                    }}
                    className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/30"
                  >
                    <option value="default">Default scanner User-Agent</option>
                    {USER_AGENT_PRESETS.map((preset) => (
                      <option key={preset.id} value={preset.id}>
                        {preset.label}
                      </option>
                    ))}
                    <option value="custom">Custom User-Agent</option>
                  </select>
                  {userAgentPreset !== "default" && (
                    <input
                      type="text"
                      value={customUserAgent}
                      onChange={(event) => {
                        setUserAgentPreset("custom");
                        setCustomUserAgent(event.target.value);
                      }}
                      placeholder="Enter a custom User-Agent string"
                      className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/30"
                    />
                  )}
                </div>
                <div>
                  <label htmlFor="scan-timeout" className="text-xs uppercase tracking-[0.14em] text-slate-500">
                    Timeout
                  </label>
                  <select
                    id="scan-timeout"
                    value={timeoutMs}
                    onChange={(event) => setTimeoutMs(Number(event.target.value) as 5000 | 10000 | 15000)}
                    className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/30"
                  >
                    {SCAN_TIMEOUT_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <label className="mt-4 inline-flex items-center gap-2 text-sm text-slate-300">
                <input
                  type="checkbox"
                  checked={followRedirects}
                  onChange={(event) => setFollowRedirects(event.target.checked)}
                  className="h-4 w-4 rounded border-slate-600 bg-slate-900 text-sky-500 focus:ring-sky-500/50"
                />
                Follow redirects
              </label>
              <p className="mt-2 text-xs text-slate-500">
                Advanced options apply to single, compare, and bulk scans in this session.
              </p>
            </div>
          )}
        </section>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={clearCurrentState}
            disabled={loading}
            aria-label="Clear current inputs and results"
            className="rounded-lg border border-slate-700 bg-slate-950/80 px-3 py-1.5 text-xs uppercase tracking-[0.12em] text-slate-300 transition hover:border-sky-500/60 hover:text-sky-200 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Clear current
          </button>
          <button
            type="button"
            onClick={onScanAgainClick}
            disabled={loading || !report}
            aria-label="Run scan again for current report URL"
            className="rounded-lg border border-slate-700 bg-slate-950/80 px-3 py-1.5 text-xs uppercase tracking-[0.12em] text-slate-300 transition hover:border-sky-500/60 hover:text-sky-200 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Scan again
          </button>
          <Suspense
            fallback={
              <button
                type="button"
                disabled
                className="rounded-lg border border-slate-700 bg-slate-950/80 px-3 py-1.5 text-xs uppercase tracking-[0.12em] text-slate-400"
              >
                Loading PDF tools...
              </button>
            }
          >
            <PdfDownloadButton
              report={report}
              busy={loading}
              requestKey={pdfExportRequestKey}
              onStateChange={setPdfState}
              onSuccess={() => notify({ tone: "success", message: "Report downloaded." })}
              onError={() => notify({ tone: "error", message: "Could not generate report PDF." })}
            />
          </Suspense>
          <button
            type="button"
            onClick={onShareResults}
            disabled={loading || (!report && !comparison)}
            aria-label="Share current scan results"
            className="rounded-lg border border-slate-700 bg-slate-950/80 px-3 py-1.5 text-xs uppercase tracking-[0.12em] text-slate-300 transition hover:border-sky-500/60 hover:text-sky-200 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {shareState === "copied"
              ? "Shareable link copied"
              : shareState === "shared"
                ? "Shared"
                : "Share results"}
          </button>
          {report && (
            <>
              <button
                type="button"
                onClick={() => void onShareToTwitter()}
                disabled={loading}
                aria-label="Share this scan on X"
                className="rounded-lg border border-slate-700 bg-slate-950/80 px-3 py-1.5 text-xs uppercase tracking-[0.12em] text-slate-300 transition hover:border-sky-500/60 hover:text-sky-200 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Share on X
              </button>
              <button
                type="button"
                onClick={() => void onShareToLinkedIn()}
                disabled={loading}
                aria-label="Share this scan on LinkedIn"
                className="rounded-lg border border-slate-700 bg-slate-950/80 px-3 py-1.5 text-xs uppercase tracking-[0.12em] text-slate-300 transition hover:border-sky-500/60 hover:text-sky-200 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Share on LinkedIn
              </button>
            </>
          )}
          {pdfState === "error" && (
            <span className="text-xs text-rose-300">Could not export PDF. Try again.</span>
          )}
          {shareState === "error" && (
            <span className="text-xs text-rose-300">Could not share right now. Try again.</span>
          )}
        </div>

        {mode === "bulk" && !loading && bulkResults.length > 0 && (
          <section className="lazy-section mt-5 rounded-xl border border-slate-800/90 bg-slate-950/60">
            <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
              <div>
                <h3 className="text-sm font-medium text-slate-100">Bulk Scan Results</h3>
                <p className="text-xs text-slate-400">
                  {bulkResults.filter((entry) => entry.report).length} successful ·{" "}
                  {bulkResults.filter((entry) => entry.error).length} failed
                </p>
              </div>
              <button
                type="button"
                onClick={onExportBulkCsv}
                aria-label="Export bulk scan results as CSV"
                className="rounded-lg border border-slate-700 bg-slate-950/80 px-3 py-1.5 text-xs uppercase tracking-[0.12em] text-slate-300 transition hover:border-sky-500/60 hover:text-sky-200"
              >
                {bulkExportState === "exported" ? "CSV exported" : "Export CSV"}
              </button>
            </div>
            <div className="space-y-2 border-t border-slate-800/90 px-4 py-3 sm:hidden">
              {bulkResults.map((entry, index) => (
                <article key={`mobile-${entry.inputUrl}-${index}`} className="rounded-lg border border-slate-800 bg-slate-900/70 p-3">
                  <p className="break-all text-sm text-slate-200">{entry.inputUrl}</p>
                  {entry.report && <p className="mt-1 break-all text-xs text-slate-500">{entry.report.finalUrl}</p>}
                  <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                    <span className="rounded-md border border-slate-700 px-2 py-1 text-slate-300">
                      Grade {entry.report?.grade ?? "--"}
                    </span>
                    <span className="rounded-md border border-slate-700 px-2 py-1 text-slate-300">
                      Score {entry.report ? `${entry.report.score}/${entry.report.results.length * 2}` : "--"}
                    </span>
                    <span className="rounded-md border border-slate-700 px-2 py-1 text-slate-300">
                      HTTP {entry.report?.statusCode ?? "--"}
                    </span>
                  </div>
                  <p className="mt-2 text-xs text-slate-400">
                    {entry.report ? new Date(entry.report.checkedAt).toLocaleString() : "Not scanned"}
                  </p>
                  <p className="mt-2 break-all text-xs text-slate-400">{entry.error ?? "Complete"}</p>
                </article>
              ))}
            </div>
            <div
              className="hidden overflow-x-auto border-t border-slate-800/90 sm:block"
              role="region"
              aria-label="Bulk scan results table. Scroll horizontally on mobile."
            >
              <table className="min-w-[760px] sm:min-w-[920px] text-left text-sm">
                <thead className="bg-slate-900/70 text-xs uppercase tracking-[0.12em] text-slate-400">
                  <tr>
                    <th className="px-4 py-3">URL</th>
                    <th className="px-4 py-3">Grade</th>
                    <th className="px-4 py-3">Score</th>
                    <th className="px-4 py-3">HTTP</th>
                    <th className="px-4 py-3">Checked</th>
                    <th className="px-4 py-3">Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {bulkResults.map((entry, index) => (
                    <tr key={`${entry.inputUrl}-${index}`} className="border-t border-slate-800/70">
                      <td className="px-4 py-3 text-slate-200">
                        <div className="max-w-[220px] sm:max-w-[320px]">
                          <p className="break-all">{entry.inputUrl}</p>
                          {entry.report && (
                            <p className="mt-1 break-all text-xs text-slate-500">{entry.report.finalUrl}</p>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {entry.report ? (
                          <span
                            className={`grade-badge-in font-semibold ${gradeColor(entry.report.grade)}`}
                            style={{ animationDelay: `${index * 45}ms` }}
                          >
                            {entry.report.grade}
                          </span>
                        ) : (
                          <span className="font-semibold text-rose-300">--</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-300">
                        {entry.report ? `${entry.report.score}/${entry.report.results.length * 2}` : "--"}
                      </td>
                      <td className="px-4 py-3 text-slate-300">
                        {entry.report ? entry.report.statusCode : "--"}
                      </td>
                      <td className="px-4 py-3 text-slate-400">
                        {entry.report ? new Date(entry.report.checkedAt).toLocaleString() : "--"}
                      </td>
                      <td className="px-4 py-3 text-slate-400">
                        {entry.error ? (
                          entry.error
                        ) : (
                          <div>
                            <span className="success-checkmark inline-flex items-center gap-1.5 text-emerald-300">
                              <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" aria-hidden="true">
                                <path
                                  d="M3.2 8.4 6.5 11.4 12.8 4.8"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="2"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                />
                              </svg>
                              Complete
                            </span>
                            {formatScanDuration(entry.report?.scanDurationMs) && (
                              <p className="mt-1 text-[11px] uppercase tracking-[0.12em] text-sky-300/90">
                                {formatScanDuration(entry.report?.scanDurationMs)}
                              </p>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {bulkExportState === "error" && (
              <p className="border-t border-slate-800/90 px-4 py-3 text-xs text-rose-300">
                Could not export CSV. Please try again.
              </p>
            )}
          </section>
        )}

        {!loading && !report && !comparison && !error && mode !== "bulk" && (
          <section className="mt-5 rounded-xl border border-sky-500/20 bg-sky-500/5 p-4">
            <div className="empty-state-float inline-flex rounded-xl border border-sky-500/30 bg-sky-500/10 p-2 text-sky-200">
              <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5">
                <path
                  d="M12 2 4 5.5V11c0 5 3.4 9.4 8 10.9 4.6-1.5 8-5.9 8-10.9V5.5L12 2Zm0 2.2 6 2.6V11c0 3.9-2.5 7.4-6 8.7-3.5-1.3-6-4.8-6-8.7V6.8l6-2.6Zm-1.1 4.3v3.1H8v2h2.9v3.1h2.2v-3.1H16v-2h-2.9V8.5h-2.2Z"
                  fill="currentColor"
                />
              </svg>
            </div>
            <h3 className="text-sm font-semibold text-sky-100">Nothing scanned yet</h3>
            <p className="mt-1 text-sm text-slate-300">
              Start with one of these suggested sites, or paste your own domain above.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {EMPTY_STATE_SUGGESTIONS.map((site) => (
                <button
                  key={site}
                  type="button"
                  onClick={() => onSampleClick(site)}
                  className="cta-attention rounded-lg border border-slate-700 bg-slate-950/80 px-3 py-1.5 text-sm text-slate-200 transition hover:border-sky-500/60 hover:text-sky-200"
                >
                  Scan {site}
                </button>
              ))}
            </div>
          </section>
        )}

        <section className="lazy-section mt-5 rounded-xl border border-slate-800/90 bg-slate-950/60">
          <div className="border-b border-slate-800/90 px-4 py-3">
            <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-slate-300">
              Frequently asked questions
            </h3>
          </div>
          <ul>
            {FAQ_ITEMS.map((item, index) => {
              const isOpen = openFaqIndex === index;
              return (
                <li key={item.question} className="border-t border-slate-800/90 first:border-t-0">
                  <button
                    type="button"
                    onClick={() => setOpenFaqIndex((current) => (current === index ? null : index))}
                    aria-expanded={isOpen}
                    aria-controls={`security-header-faq-content-${index}`}
                    className="flex w-full items-center justify-between px-4 py-3 text-left transition hover:bg-slate-900/60"
                  >
                    <span className="text-sm font-medium text-slate-100">{item.question}</span>
                    <span className="text-xs uppercase tracking-[0.14em] text-slate-400">
                      {isOpen ? "Hide" : "Show"}
                    </span>
                  </button>
                  {isOpen && (
                    <div id={`security-header-faq-content-${index}`} className="border-t border-slate-800/90 px-4 py-3">
                      <p className="text-sm text-slate-300">{item.answer}</p>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </section>

        {scanProgress > 0 && (
          <section
            className="mt-4 rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-3"
            aria-live="polite"
            aria-atomic="true"
          >
            <div className="mb-2 flex items-center justify-between text-xs text-slate-400">
              <span className="flex items-center gap-2">
                {mode === "compare"
                  ? "Comparing security headers..."
                  : mode === "bulk"
                    ? "Running bulk scan..."
                    : "Scanning site..."}
                {!loading && scanProgress === 100 && (
                  <span className="success-checkmark inline-flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-300">
                    <svg viewBox="0 0 16 16" className="h-3 w-3" aria-hidden="true">
                      <path
                        d="M3.2 8.4 6.5 11.4 12.8 4.8"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </span>
                )}
              </span>
              <span>
                {mode === "bulk" && bulkTargetCount > 0
                  ? `${bulkCompletedCount}/${bulkTargetCount} • ${scanProgress}%`
                  : `${scanProgress}%`}
              </span>
            </div>
            <div
              className="h-2 overflow-hidden rounded-full bg-slate-800"
              role="progressbar"
              aria-label="Scan progress"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={scanProgress}
            >
              <div
                className="progress-pulse h-full rounded-full bg-gradient-to-r from-sky-500 via-cyan-400 to-emerald-400 transition-[width] duration-200 will-change-[width]"
                style={{ width: `${scanProgress}%` }}
              />
            </div>
          </section>
        )}

        <section className="lazy-section mt-5 overflow-hidden rounded-xl border border-slate-800/90 bg-slate-950/60">
          <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
            <button
              type="button"
              onClick={() => setHistoryOpen((open) => !open)}
              aria-expanded={historyOpen}
              aria-controls="recent-scans-list"
              aria-label={historyOpen ? "Collapse recent scans" : "Expand recent scans"}
              className="text-sm font-medium text-slate-200 transition hover:text-sky-200"
            >
              Last {MAX_HISTORY_ITEMS} Scans ({scanHistory.length}) {historyOpen ? "−" : "+"}
            </button>
            {scanHistory.length > 1 && (
              <p className="text-[11px] text-slate-500 sm:hidden">
                Swipe left/right to move through recent scans ({activeHistoryIndex + 1}/{scanHistory.length})
              </p>
            )}
            <button
              type="button"
              onClick={clearHistory}
              disabled={scanHistory.length === 0}
              aria-label="Clear recent scan history"
              className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs uppercase tracking-[0.12em] text-slate-300 transition hover:border-sky-500/60 hover:text-sky-200 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Clear history
            </button>
          </div>
          {historyOpen && (
            <div id="recent-scans-list" className="border-t border-slate-800/90 px-4 py-3">
              {scanHistory.length === 0 ? (
                <p className="text-sm text-slate-400">No scans yet. Run a check to build your history.</p>
              ) : (
                <ul className="space-y-2" onTouchStart={onHistoryTouchStart} onTouchEnd={onHistoryTouchEnd}>
                  {scanHistory.map((entry, index) => {
                    const hasCachedReport = Boolean(historyReportSnapshots[entry.id]);
                    return (
                      <li
                        key={entry.id}
                        data-history-entry-index={index}
                        className={`motion-card rounded-lg border px-3 py-3 transition ${
                          activeHistoryIndex === index
                            ? "border-sky-500/50 bg-sky-500/10"
                            : "border-slate-800/80 bg-slate-900/70 hover:border-sky-500/40"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-sm text-slate-100">{entry.url}</p>
                            <p className="mt-1 text-xs text-slate-400">{new Date(entry.checkedAt).toLocaleString()}</p>
                          </div>
                          <div className="text-right">
                            <p className={`text-lg font-semibold ${gradeColor(entry.grade)}`}>{entry.grade}</p>
                            {typeof entry.score === "number" && typeof entry.maxScore === "number" && (
                              <p className="text-[11px] text-slate-400">
                                {entry.score}/{entry.maxScore}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                          <p className="text-[11px] text-slate-500">
                            {hasCachedReport ? "Saved report snapshot available." : "Will run a fresh scan for this URL."}
                          </p>
                          <button
                            type="button"
                            onClick={() => onViewHistoryEntryReport(entry)}
                            disabled={loading}
                            data-history-button-index={index}
                            aria-label={`View full report for ${entry.url}`}
                            className="rounded-md border border-slate-700 bg-slate-950/80 px-3 py-1.5 text-xs font-medium uppercase tracking-[0.1em] text-slate-200 transition hover:border-sky-500/60 hover:text-sky-200 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            View full report
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          )}
        </section>

        <Suspense fallback={<SuspensePanelFallback label="Watchlist panel" />}>
          <WatchlistPanel
            latestReport={
              report
                ? {
                    checkedUrl: report.checkedUrl,
                    grade: report.grade,
                    checkedAt: report.checkedAt
                  }
                : null
            }
            onOpenReport={onHistoryEntryClick}
            disabled={loading}
          />
        </Suspense>

        <section className="lazy-section mt-5 rounded-xl border border-slate-800/90 bg-slate-950/60">
          <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
            <p className="text-sm font-medium text-slate-200">Recent Popular Sites</p>
            <p className="text-xs text-slate-500">
              {popularRefreshing ? "Refreshing cache..." : "Cached security snapshots"}
            </p>
          </div>
          <div className="border-t border-slate-800/90 px-4 py-3">
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {POPULAR_SITES.map((site) => {
                const cached = popularCacheByUrl.get(site);
                const isRefreshingThisSite = activePopularRefresh === site;
                return (
                  <li key={site} className="motion-card rounded-lg border border-slate-800/80 bg-slate-900/70 p-3">
                    <p className="truncate text-sm font-medium text-slate-100">{site}</p>
                    {cached ? (
                      <>
                        <p className={`mt-1 text-xl font-semibold ${gradeColor(cached.report.grade)}`}>
                          Grade {cached.report.grade}
                        </p>
                        <p className="mt-1 text-xs text-slate-400">
                          Cached {new Date(cached.cachedAt).toLocaleString()}
                        </p>
                      </>
                    ) : (
                      <p className="mt-1 text-xs text-slate-500">No cached report yet.</p>
                    )}
                    <div className="mt-3 flex gap-2">
                      <button
                        type="button"
                        onClick={() => onPopularSiteClick(site)}
                        disabled={loading || isRefreshingThisSite}
                        aria-label={`Open cached report for ${site}`}
                        className="flex-1 rounded-md border border-slate-700 px-2 py-1.5 text-xs text-slate-200 transition hover:border-sky-500/60 hover:text-sky-200 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {cached ? "Open report" : "Pre-scan"}
                      </button>
                      <button
                        type="button"
                        onClick={() => void refreshPopularSite(site)}
                        disabled={loading || isRefreshingThisSite}
                        aria-label={`Refresh cached scan for ${site}`}
                        className="rounded-md border border-slate-700 px-2 py-1.5 text-xs text-slate-300 transition hover:border-sky-500/60 hover:text-sky-200 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {isRefreshingThisSite ? "..." : "Refresh"}
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        </section>

        {error && (
          <p
            role="alert"
            aria-live="assertive"
            className="mt-4 rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200"
          >
            {error}
          </p>
        )}
      </section>

      {loading && mode === "bulk" && <LoadingSkeleton />}
      {loading && mode !== "bulk" && <ScanResultsLoadingSkeleton mode={mode} />}

      <div className="lazy-section">
        {!loading && report && (
          <>
            {scorePercent !== null && scorePercent < 80 && (
              <section className="mt-6 rounded-2xl border border-amber-400/40 bg-amber-500/10 p-5 shadow-lg shadow-amber-900/20">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-300">Action recommended</p>
                <h3 className="mt-2 text-xl font-semibold text-amber-100">Improve your score</h3>
                <p className="mt-2 text-sm text-amber-100/90">
                  This scan scored {scorePercent}%. Open quick fixes
                  {suggestedFixPlatform ? ` for ${report.framework?.detected?.label ?? suggestedFixPlatform}` : ""} to
                  apply targeted header improvements.
                </p>
                <Link
                  href={quickFixesHref}
                  className="mt-4 inline-flex rounded-lg border border-amber-300/60 bg-amber-300/20 px-4 py-2 text-sm font-semibold uppercase tracking-[0.12em] text-amber-100 transition hover:border-amber-200 hover:bg-amber-200/20"
                >
                  Improve your score
                </Link>
              </section>
            )}
            <section className="mt-6 grid gap-6 lg:grid-cols-[280px_1fr]">
              <article className="motion-card rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
              <p className="text-sm uppercase tracking-[0.2em] text-slate-400">Overall Grade</p>
              <AnimatedGradeCircle
                score={report.score}
                total={report.results.length * 2}
                grade={report.grade}
                gradeClassName={singleGradeColor}
              />
              <p className="mt-1 text-sm text-slate-300">
                Score: {report.score}/{report.results.length * 2}
              </p>
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => void onCopyShareLink()}
                  className="w-full rounded-lg border border-slate-700 bg-slate-950/80 px-3 py-2 text-sm font-medium text-slate-200 transition hover:border-sky-500/60 hover:text-sky-200"
                >
                  {copyLinkState === "copied" ? "Shareable link copied" : "Copy Shareable Link"}
                </button>
                <button
                  type="button"
                  onClick={onCopyReport}
                  className="w-full rounded-lg border border-slate-700 bg-slate-950/80 px-3 py-2 text-sm font-medium text-slate-200 transition hover:border-sky-500/60 hover:text-sky-200"
                >
                  {copyState === "copied" ? "Markdown copied" : "Copy as Markdown"}
                </button>
                <button
                  type="button"
                  onClick={() => setBadgePanelOpen((current) => !current)}
                  disabled={!badgeDomain}
                  className="w-full rounded-lg border border-slate-700 bg-slate-950/80 px-3 py-2 text-sm font-medium text-slate-200 transition hover:border-sky-500/60 hover:text-sky-200 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {badgePanelOpen ? "Hide Badge" : "Get Badge"}
                </button>
                <Link
                  href={quickFixesHref}
                  className="inline-flex w-full items-center justify-center rounded-lg border border-slate-700 bg-slate-950/80 px-3 py-2 text-sm font-medium text-slate-200 transition hover:border-sky-500/60 hover:text-sky-200"
                >
                  Quick fixes
                </Link>
              </div>
              {copyLinkState === "error" && (
                <p className="mt-2 text-xs text-rose-300">Could not copy a shareable link right now.</p>
              )}
              {copyState === "error" && (
                <p className="mt-2 text-xs text-rose-300">
                  Clipboard unavailable. Please copy markdown manually.
                </p>
              )}
              {badgePanelOpen && (
                <section className="mt-3 rounded-lg border border-slate-800 bg-slate-950/70 p-3">
                  <p className="text-xs uppercase tracking-[0.14em] text-slate-500">Embeddable badge</p>
                  {badgeDomain ? (
                    <>
                      <div className="mt-2 space-y-2">
                        <div className="inline-flex rounded-md border border-slate-700 bg-slate-900 p-1">
                          <button
                            type="button"
                            onClick={() => setBadgeStyle("flat")}
                            className={`rounded px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] transition ${
                              badgeStyle === "flat"
                                ? "bg-sky-500 text-slate-950"
                                : "text-slate-300 hover:text-sky-200"
                            }`}
                          >
                            Flat
                          </button>
                          <button
                            type="button"
                            onClick={() => setBadgeStyle("plastic")}
                            className={`rounded px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] transition ${
                              badgeStyle === "plastic"
                                ? "bg-sky-500 text-slate-950"
                                : "text-slate-300 hover:text-sky-200"
                            }`}
                          >
                            Plastic
                          </button>
                        </div>
                        <div className="grid gap-2 sm:grid-cols-2">
                          <label className="text-xs text-slate-400">
                            Badge label
                            <input
                              type="text"
                              value={badgeLabel}
                              onChange={(event) => setBadgeLabel(event.target.value)}
                              className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs text-slate-100"
                              maxLength={42}
                            />
                          </label>
                          <label className="text-xs text-slate-400">
                            Theme
                            <select
                              value={badgeTheme}
                              onChange={(event) => setBadgeTheme(event.target.value as BadgeTheme)}
                              className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs text-slate-100"
                            >
                              <option value="default">Default</option>
                              <option value="slate">Slate</option>
                              <option value="light">Light</option>
                            </select>
                          </label>
                        </div>
                      </div>

                      <div className="mt-3 flex items-center justify-center rounded-md border border-slate-800 bg-slate-900/60 p-3">
                        <Image
                          src={badgeUrl}
                          alt={`Security headers grade badge for ${badgeDomain}`}
                          width={260}
                          height={20}
                          sizes="(max-width: 640px) 100vw, 260px"
                          loading="lazy"
                          decoding="async"
                          unoptimized
                        />
                      </div>

                      <div className="mt-3 space-y-2">
                        <div>
                          <p className="text-xs text-slate-400">Badge URL</p>
                          <input
                            type="text"
                            value={badgeUrl}
                            readOnly
                            className="mt-1 min-w-0 w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs text-slate-200"
                          />
                        </div>
                        <div>
                          <p className="text-xs text-slate-400">Markdown</p>
                          <div className="mt-1 flex gap-2">
                            <input
                              type="text"
                              value={badgeMarkdownCode}
                              readOnly
                              className="min-w-0 flex-1 rounded-md border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs text-slate-200"
                            />
                            <button
                              type="button"
                              onClick={() => void onCopyBadgeCode("markdown")}
                              className="rounded-md border border-slate-700 px-2 py-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-200 transition hover:border-sky-500/60 hover:text-sky-200"
                            >
                              Copy
                            </button>
                          </div>
                        </div>

                        <div>
                          <p className="text-xs text-slate-400">HTML</p>
                          <div className="mt-1 flex gap-2">
                            <input
                              type="text"
                              value={badgeHtmlCode}
                              readOnly
                              className="min-w-0 flex-1 rounded-md border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs text-slate-200"
                            />
                            <button
                              type="button"
                              onClick={() => void onCopyBadgeCode("html")}
                              className="rounded-md border border-slate-700 px-2 py-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-200 transition hover:border-sky-500/60 hover:text-sky-200"
                            >
                              Copy
                            </button>
                          </div>
                        </div>
                      </div>
                      {badgeCopyState === "markdown" && (
                        <p className="mt-2 text-xs text-emerald-300">Markdown copied.</p>
                      )}
                      {badgeCopyState === "html" && (
                        <p className="mt-2 text-xs text-emerald-300">HTML copied.</p>
                      )}
                      {badgeCopyState === "error" && (
                        <p className="mt-2 text-xs text-rose-300">Clipboard unavailable. Copy manually.</p>
                      )}
                    </>
                  ) : (
                    <p className="mt-2 text-xs text-rose-300">Unable to detect a valid domain for badge links.</p>
                  )}
                </section>
              )}
              <div className="mt-4 space-y-1 text-sm text-slate-300">
                <p className="break-all">
                  <span className="text-slate-500">Checked URL:</span> {report.checkedUrl}
                </p>
                <p className="break-all">
                  <span className="text-slate-500">Final URL:</span> {report.finalUrl}
                </p>
                <p>
                  <span className="text-slate-500">Status:</span> {report.statusCode}
                </p>
                <p>
                  <span className="text-slate-500">Scan timestamp:</span>{" "}
                  <time dateTime={report.checkedAt}>{new Date(report.checkedAt).toLocaleString()}</time>
                </p>
                <p>
                  <span className="text-slate-500">Result source:</span> {reportSourceLabel(reportSource)}
                </p>
                {reportSource === "cache" && reportCachedAt && (
                  <p>
                    <span className="text-slate-500">Cache status:</span>{" "}
                    <time dateTime={reportCachedAt}>
                      Captured {new Date(reportCachedAt).toLocaleString()}
                      {formatRelativeTime(reportCachedAt) ? ` (${formatRelativeTime(reportCachedAt)})` : ""}
                    </time>
                  </p>
                )}
                {formatScanDuration(report.scanDurationMs) && (
                  <p className="text-xs uppercase tracking-[0.12em] text-sky-300/90">
                    {formatScanDuration(report.scanDurationMs)}
                  </p>
                )}
                {frameworkSummaryLabel(report.framework) && (
                  <p>
                    <span className="text-slate-500">Detected stack:</span> {frameworkSummaryLabel(report.framework)}
                  </p>
                )}
                {suggestedFixPlatform && (
                  <p>
                    <span className="text-slate-500">Suggested quick fix:</span>{" "}
                    <Link href={quickFixesHref} className="text-sky-300 transition hover:text-sky-200">
                      {report.framework?.detected?.label ?? suggestedFixPlatform}
                    </Link>
                  </p>
                )}
              </div>
              </article>

              <div className="grid gap-4 sm:grid-cols-2">
                {report.results.map((header, index) => (
                  <SecurityCard
                    key={header.key}
                    cardId={`header-card-single-${header.key}`}
                    header={header}
                    detectedFramework={report.framework?.detected}
                    animationDelayMs={index * 55}
                    shortcutNumber={index < 6 ? index + 1 : undefined}
                    onSelect={openHeaderDetailModal}
                  />
                ))}
              </div>
            </section>
            <Suspense fallback={<SuspensePanelFallback label="Fix suggestions panel" />}>
              <FixSuggestionsPanel results={report.results} framework={report.framework} />
            </Suspense>
          </>
        )}

        {!loading && comparison && (
          <section className="mt-6 space-y-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <SiteSummary title="Site A" report={comparison.siteA} delayMs={80} />
              <SiteSummary title="Site B" report={comparison.siteB} delayMs={150} />
            </div>

            <article className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 shadow-lg shadow-slate-950/50">
              <h2 className="text-lg font-semibold text-slate-100">Header Differences</h2>
              <p className="mt-1 text-sm text-slate-400">
                Highlighted rows call out mismatches in presence, strength, or values.
              </p>
              {comparisonDifferences.length === 0 ? (
                <p className="mt-4 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
                  Nice work — both sites have matching header coverage across all checked categories.
                </p>
              ) : (
                <ul className="mt-4 space-y-3">
                  {comparisonDifferences.map((difference) => (
                    <li
                      key={difference.key}
                      className="rounded-lg border border-sky-500/30 bg-sky-500/10 px-4 py-3"
                    >
                      <p className="text-sm font-semibold text-sky-100">{difference.label}</p>
                      <ul className="mt-1 space-y-1 text-sm text-sky-200/90">
                        {difference.messages.map((message) => (
                          <li key={message}>• {message}</li>
                        ))}
                      </ul>
                    </li>
                  ))}
                </ul>
              )}
            </article>

            <div className="lg:hidden">
              <div className="inline-flex rounded-lg border border-slate-700 bg-slate-950/80 p-1">
                <button
                  type="button"
                  onClick={() => setMobileCompareView("siteA")}
                  aria-pressed={mobileCompareView === "siteA"}
                  aria-label="Show Site A headers"
                  className={`rounded-md px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] transition ${
                    mobileCompareView === "siteA"
                      ? "bg-sky-500 text-slate-950"
                      : "text-slate-300 hover:text-sky-200"
                  }`}
                >
                  Site A Headers
                </button>
                <button
                  type="button"
                  onClick={() => setMobileCompareView("siteB")}
                  aria-pressed={mobileCompareView === "siteB"}
                  aria-label="Show Site B headers"
                  className={`rounded-md px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] transition ${
                    mobileCompareView === "siteB"
                      ? "bg-sky-500 text-slate-950"
                      : "text-slate-300 hover:text-sky-200"
                  }`}
                >
                  Site B Headers
                </button>
              </div>
              <p className="mt-2 text-xs text-slate-500">Tip: swipe left or right to switch between sites.</p>
            </div>

            <div
              className="grid gap-6 lg:grid-cols-2"
              onTouchStart={onCompareTouchStart}
              onTouchEnd={onCompareTouchEnd}
            >
              <section className={mobileCompareView === "siteA" ? "block" : "hidden lg:block"}>
                <h3 className="mb-3 text-sm uppercase tracking-[0.2em] text-slate-400">Site A Headers</h3>
                <div className="grid gap-4 sm:grid-cols-2">
                  {comparison.siteA.results.map((header, index) => (
                    <SecurityCard
                      key={`a-${header.key}`}
                      cardId={`header-card-site-a-${header.key}`}
                      header={header}
                      detectedFramework={comparison.siteA.framework?.detected}
                      highlighted={differingHeaderKeys.has(header.key)}
                      animationDelayMs={index * 45}
                      shortcutNumber={index < 6 ? index + 1 : undefined}
                      onSelect={openHeaderDetailModal}
                    />
                  ))}
                </div>
              </section>
              <section className={mobileCompareView === "siteB" ? "block" : "hidden lg:block"}>
                <h3 className="mb-3 text-sm uppercase tracking-[0.2em] text-slate-400">Site B Headers</h3>
                <div className="grid gap-4 sm:grid-cols-2">
                  {comparison.siteB.results.map((header, index) => (
                    <SecurityCard
                      key={`b-${header.key}`}
                      cardId={`header-card-site-b-${header.key}`}
                      header={header}
                      detectedFramework={comparison.siteB.framework?.detected}
                      highlighted={differingHeaderKeys.has(header.key)}
                      animationDelayMs={index * 45}
                      shortcutNumber={index < 6 ? index + 1 : undefined}
                      onSelect={openHeaderDetailModal}
                    />
                  ))}
                </div>
              </section>
            </div>
          </section>
        )}
      </div>

      {activeHeaderDetail && activeHeaderDeepDive && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center p-3 sm:items-center sm:p-4">
          <button
            type="button"
            aria-label="Close header details"
            onClick={closeHeaderDetailModal}
            className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm"
          />
          <div
            ref={headerDetailDialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="header-deep-dive-title"
            className="relative z-10 max-h-[85dvh] w-full max-w-2xl overflow-y-auto overscroll-contain rounded-2xl border border-slate-700 bg-slate-900/95 p-5 shadow-2xl shadow-slate-950/80 sm:p-6"
          >
            <div className="sticky top-0 z-10 -mx-5 -mt-5 mb-4 flex items-start justify-between gap-3 border-b border-slate-800/80 bg-slate-900/95 px-5 py-4 sm:-mx-6 sm:-mt-6 sm:px-6 sm:py-5">
              <div className="min-w-0">
                <p className="text-xs uppercase tracking-[0.18em] text-sky-300">Header deep dive</p>
                <h2 id="header-deep-dive-title" className="mt-1 text-xl font-semibold text-slate-100">
                  {activeHeaderDetail.label}
                </h2>
              </div>
              <button
                ref={headerDetailCloseButtonRef}
                type="button"
                onClick={closeHeaderDetailModal}
                className="rounded-md border border-slate-700 px-2 py-1 text-xs uppercase tracking-[0.12em] text-slate-200 transition hover:border-sky-500/60 hover:text-sky-200"
              >
                Close
              </button>
            </div>

            <div className="mt-4 space-y-4">
              <section>
                <p className="text-xs uppercase tracking-[0.14em] text-slate-400">Raw header value</p>
                {activeHeaderDetail.value ? (
                  <code className="mt-2 block max-h-28 overflow-auto rounded-lg border border-slate-800 bg-slate-950/80 px-3 py-2 text-xs text-slate-200">
                    {activeHeaderDetail.value}
                  </code>
                ) : (
                  <p className="mt-2 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
                    Missing in the latest response.
                  </p>
                )}
              </section>

              <section>
                <p className="text-xs uppercase tracking-[0.14em] text-slate-400">Directive breakdown</p>
                <ul className="mt-2 space-y-2">
                  {activeHeaderDeepDive.directives.map((directive, index) => (
                    <li
                      key={`${directive.directive}-${index}`}
                      className="rounded-lg border border-slate-800 bg-slate-950/70 px-3 py-2"
                    >
                      <p className="text-sm font-semibold text-sky-200">{directive.directive}</p>
                      {directive.raw && <p className="mt-1 break-all text-xs text-slate-400">{directive.raw}</p>}
                      <p className="mt-1 text-sm text-slate-300">{directive.explanation}</p>
                    </li>
                  ))}
                </ul>
              </section>

              <div className="flex flex-wrap items-center gap-2 border-t border-slate-800/90 pt-4">
                <a
                  href={activeHeaderDeepDive.mdnUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-lg border border-slate-700 bg-slate-950/80 px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-200 transition hover:border-sky-500/60 hover:text-sky-200"
                >
                  Read on MDN
                </a>
                <p className="text-xs text-slate-500">Tip: press Esc to close.</p>
              </div>
            </div>
          </div>
        </div>
      )}

      <SiteFooter className="mt-10" />

      <KeyboardShortcutsHelp
        open={shortcutsOpen}
        onClose={closeShortcutsModal}
        shortcuts={SHORTCUT_ROWS}
        dialogRef={shortcutsDialogRef}
        closeButtonRef={shortcutCloseButtonRef}
      />
    </main>
  );
}

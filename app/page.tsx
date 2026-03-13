"use client";

import { FormEvent, TouchEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import type { HeaderResult } from "@/lib/securityHeaders";
import { FixSuggestionsPanel } from "@/app/components/FixSuggestionsPanel";
import { SiteFooter } from "@/app/components/SiteFooter";
import { SiteNav } from "@/app/components/SiteNav";
import { WatchlistPanel } from "@/app/components/WatchlistPanel";

type ReportResponse = {
  checkedUrl: string;
  finalUrl: string;
  statusCode: number;
  score: number;
  grade: string;
  results: HeaderResult[];
  checkedAt: string;
};

type ComparisonReport = {
  siteA: ReportResponse;
  siteB: ReportResponse;
};

type HistoryEntry = {
  id: string;
  url: string;
  grade: string;
  checkedAt: string;
};

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

type ScanMode = "single" | "compare" | "bulk";
type MobileCompareView = "siteA" | "siteB";
type ShareState = "idle" | "copied" | "shared" | "error";
type ThemeMode = "dark" | "light";
type BadgeStyle = "flat" | "flat-square";
type BadgeCopyState = "idle" | "markdown" | "html" | "error";

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

const SAMPLE_SITES = ["google.com", "github.com", "facebook.com"];
const EMPTY_STATE_SUGGESTIONS = ["owasp.org", "mozilla.org", "cloudflare.com", "wikipedia.org"];
const POPULAR_SITES = ["google.com", "github.com", "youtube.com", "amazon.com", "wikipedia.org"];
const HISTORY_STORAGE_KEY = "security-header-checker:scan-history";
const POPULAR_CACHE_STORAGE_KEY = "security-header-checker:popular-sites-cache";
const POPULAR_CACHE_TTL_MS = 1000 * 60 * 60 * 6;
const MAX_HISTORY_ITEMS = 10;
const MAX_BULK_URLS = 10;
const SHARE_QUERY_PARAM = "share";
const THEME_STORAGE_KEY = "security-header-checker:theme";
const SHORTCUT_ROWS = [
  { keys: "?", action: "Open/close keyboard shortcuts help" },
  { keys: "Ctrl + Enter", action: "Run scan in active tab" },
  { keys: "Ctrl + K", action: "Clear current inputs and results" },
  { keys: "Ctrl + P", action: "Export visible report as PDF" },
  { keys: "Enter", action: "Run scan (no modifiers)" },
  { keys: "Esc", action: "Clear current inputs and results" }
];

const statusStyles: Record<HeaderResult["status"], string> = {
  good: "bg-emerald-500/20 text-emerald-300 ring-emerald-500/30",
  weak: "bg-amber-500/20 text-amber-300 ring-amber-500/30",
  missing: "bg-rose-500/20 text-rose-300 ring-rose-500/30"
};

const gradeStyles: Record<string, string> = {
  A: "text-emerald-300",
  B: "text-lime-300",
  C: "text-amber-300",
  D: "text-orange-300",
  F: "text-rose-300"
};

function isHistoryEntry(value: unknown): value is HistoryEntry {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<HistoryEntry>;
  return (
    typeof candidate.id === "string" &&
    typeof candidate.url === "string" &&
    typeof candidate.grade === "string" &&
    typeof candidate.checkedAt === "string"
  );
}

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

function toBase64Url(value: string) {
  if (typeof window === "undefined") return "";
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fromBase64Url(value: string) {
  if (typeof window === "undefined") return "";
  const padded = value.replace(/-/g, "+").replace(/_/g, "/");
  const normalized = padded + "=".repeat((4 - (padded.length % 4)) % 4);
  const binary = atob(normalized);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function encodeSharePayload(payload: SharePayload) {
  return toBase64Url(JSON.stringify(payload));
}

function decodeSharePayload(value: string): SharePayload | null {
  try {
    const parsed = JSON.parse(fromBase64Url(value));
    return isSharePayload(parsed) ? parsed : null;
  } catch {
    return null;
  }
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

function escapeCsvCell(value: string): string {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, "\"\"")}"`;
  }
  return value;
}

function formatReportForClipboard(report: ReportResponse): string {
  const checkedAt = new Date(report.checkedAt).toLocaleString();
  const lines = [
    "Security Header Checker Report",
    "==============================",
    `Checked URL: ${report.checkedUrl}`,
    `Final URL: ${report.finalUrl}`,
    `Status Code: ${report.statusCode}`,
    `Grade: ${report.grade}`,
    `Score: ${report.score}/${report.results.length * 2}`,
    `Checked At: ${checkedAt}`,
    "",
    "Header Details",
    "--------------"
  ];

  for (const result of report.results) {
    lines.push(`${result.label}: ${result.status.toUpperCase()}`);
    lines.push(`  Value: ${result.value ?? "Missing"}`);
    lines.push(`  Why it matters: ${result.whyItMatters}`);
    lines.push(`  Recommendation: ${result.guidance}`);
    lines.push("");
  }

  return lines.join("\n").trim();
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

function HeaderCard({
  header,
  highlighted = false
}: {
  header: HeaderResult;
  highlighted?: boolean;
}) {
  return (
    <article
      className={`rounded-2xl border p-5 shadow-lg ${
        highlighted
          ? "border-sky-500/60 bg-sky-500/10 shadow-sky-950/40"
          : "border-slate-800 bg-slate-900/60 shadow-slate-950/50"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-lg font-semibold text-slate-100">{header.label}</h2>
        <div className="flex items-center gap-2">
          {highlighted && (
            <span className="rounded-full bg-sky-500/20 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-sky-200 ring-1 ring-sky-500/40">
              Diff
            </span>
          )}
          <span
            className={`rounded-full px-3 py-1 text-xs font-semibold uppercase ring-1 ${statusStyles[header.status]}`}
          >
            {header.status}
          </span>
        </div>
      </div>

      <p className="mt-3 text-sm text-slate-300">{header.whyItMatters}</p>
      <p className="mt-3 text-sm text-slate-400">
        <span className="text-slate-500">Current value:</span>{" "}
        {header.value ? (
          <code className="break-all rounded bg-slate-950 px-1.5 py-0.5 text-xs text-slate-200">
            {header.value}
          </code>
        ) : (
          <span className="text-rose-200">Missing</span>
        )}
      </p>
      <p className="mt-3 text-sm text-slate-300">
        <span className="font-medium text-slate-200">Recommendation:</span> {header.guidance}
      </p>
    </article>
  );
}

function SiteSummary({ title, report }: { title: string; report: ReportResponse }) {
  return (
    <article className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-slate-400">{title}</p>
          <p className="mt-2 break-all text-sm text-slate-300">{report.checkedUrl}</p>
        </div>
        <p className={`text-5xl font-bold ${gradeColor(report.grade)}`}>{report.grade}</p>
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
      </div>
    </article>
  );
}

export default function Home() {
  const [theme, setTheme] = useState<ThemeMode>("dark");
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
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<ReportResponse | null>(null);
  const [comparison, setComparison] = useState<ComparisonReport | null>(null);
  const [copyState, setCopyState] = useState<"idle" | "copied" | "error">("idle");
  const [pdfState, setPdfState] = useState<"idle" | "generating" | "error">("idle");
  const [shareState, setShareState] = useState<ShareState>("idle");
  const [badgePanelOpen, setBadgePanelOpen] = useState(false);
  const [badgeStyle, setBadgeStyle] = useState<BadgeStyle>("flat");
  const [badgeCopyState, setBadgeCopyState] = useState<BadgeCopyState>("idle");
  const [scanHistory, setScanHistory] = useState<HistoryEntry[]>([]);
  const [historyOpen, setHistoryOpen] = useState(true);
  const [popularSitesCache, setPopularSitesCache] = useState<PopularSiteCacheEntry[]>([]);
  const [popularRefreshing, setPopularRefreshing] = useState(false);
  const [activePopularRefresh, setActivePopularRefresh] = useState<string | null>(null);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [faqOpen, setFaqOpen] = useState(false);
  const exportTargetRef = useRef<HTMLDivElement | null>(null);
  const compareTouchStartXRef = useRef<number | null>(null);
  const singleUrlInputRef = useRef<HTMLInputElement | null>(null);
  const compareUrlAInputRef = useRef<HTMLInputElement | null>(null);
  const shortcutsDialogRef = useRef<HTMLDivElement | null>(null);
  const shortcutCloseButtonRef = useRef<HTMLButtonElement | null>(null);
  const lastFocusedElementRef = useRef<HTMLElement | null>(null);
  const celebratedScanRef = useRef<string | null>(null);

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
    const badgePath = `/api/badge/${encodeURIComponent(badgeDomain)}?style=${badgeStyle}`;
    if (typeof window === "undefined") {
      return badgePath;
    }
    return `${window.location.origin}${badgePath}`;
  }, [badgeDomain, badgeStyle]);

  const badgeMarkdownCode = useMemo(() => {
    if (!badgeDomain || !badgeUrl) return "";
    return `![Security headers grade for ${badgeDomain}](${badgeUrl})`;
  }, [badgeDomain, badgeUrl]);

  const badgeHtmlCode = useMemo(() => {
    if (!badgeDomain || !badgeUrl) return "";
    return `<img src="${badgeUrl}" alt="Security headers grade badge for ${badgeDomain}" />`;
  }, [badgeDomain, badgeUrl]);

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

  const popularCacheByUrl = useMemo(() => {
    return new Map(popularSitesCache.map((entry) => [entry.url, entry]));
  }, [popularSitesCache]);

  const liveRegionMessage = useMemo(() => {
    if (error) {
      return `Scan error: ${error}`;
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
    if (copyState === "copied") {
      return "Report copied to clipboard.";
    }
    if (shareState === "copied") {
      return "Share link copied to clipboard.";
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
    return "";
  }, [badgeCopyState, bulkExportState, bulkResults, comparison, copyState, error, loading, mode, pdfState, report, shareState]);

  useEffect(() => {
    try {
      const storedTheme = localStorage.getItem(THEME_STORAGE_KEY);
      if (storedTheme === "light" || storedTheme === "dark") {
        setTheme(storedTheme);
      }
    } catch {
      setTheme("dark");
    }
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {
      // Ignore storage failures (private mode or blocked access).
    }
  }, [theme]);

  useEffect(() => {
    try {
      const rawHistory = localStorage.getItem(HISTORY_STORAGE_KEY);
      if (!rawHistory) return;
      const parsed = JSON.parse(rawHistory);
      if (!Array.isArray(parsed)) return;
      const loadedEntries = parsed.filter(isHistoryEntry).slice(0, MAX_HISTORY_ITEMS);
      setScanHistory(loadedEntries);
    } catch {
      setScanHistory([]);
    }
  }, []);

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
    setPdfState("idle");
    setShareState("idle");
    setLoading(false);
    setScanProgress(0);

    if (decoded.mode === "single") {
      setMode("single");
      setUrl(decoded.report.checkedUrl);
      setReport(decoded.report);
      setComparison(null);
      return;
    }

    setMode("compare");
    setMobileCompareView("siteA");
    setCompareUrlA(decoded.comparison.siteA.checkedUrl);
    setCompareUrlB(decoded.comparison.siteB.checkedUrl);
    setReport(null);
    setComparison(decoded.comparison);
  }, []);

  useEffect(() => {
    setBadgePanelOpen(false);
    setBadgeStyle("flat");
    setBadgeCopyState("idle");
  }, [mode, report?.checkedAt]);

  const addToHistory = useCallback((nextReport: ReportResponse) => {
    const nextEntry: HistoryEntry = {
      id: `${nextReport.checkedAt}-${nextReport.checkedUrl}`,
      url: nextReport.checkedUrl,
      grade: nextReport.grade,
      checkedAt: nextReport.checkedAt
    };

    setScanHistory((previous) => {
      const updated = [nextEntry, ...previous].slice(0, MAX_HISTORY_ITEMS);
      localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(updated));
      return updated;
    });
  }, []);

  function clearHistory() {
    localStorage.removeItem(HISTORY_STORAGE_KEY);
    setScanHistory([]);
  }

  const requestReport = useCallback(async (targetUrl: string): Promise<ReportResponse> => {
    const sanitized = targetUrl.trim();
    if (!sanitized) {
      throw new Error("Please enter a URL.");
    }

    const response = await fetch("/api/check", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ url: sanitized })
    });

    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload?.error ?? "Unable to check headers.");
    }

    return payload as ReportResponse;
  }, []);

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
    setComparison(null);
    setBulkResults([]);
    setBulkExportState("idle");
    setCopyState("idle");
    setPdfState("idle");
    setShareState("idle");
    setScanProgress(0);

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

  async function refreshPopularSite(site: string, openReport = false) {
    setActivePopularRefresh(site);
    try {
      const nextReport = await requestReport(site);
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
        setComparison(null);
        setError(null);
        setCopyState("idle");
        setShareState("idle");
        addToHistory(nextReport);
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
    setComparison(null);
    setCopyState("idle");
    setShareState("idle");

    try {
      const payload = await requestReport(targetUrl);
      setReport(payload);
      addToHistory(payload);
    } catch (fetchError) {
      const message = fetchError instanceof Error ? fetchError.message : "Unexpected error.";
      setReport(null);
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [addToHistory, requestReport]);

  const runComparisonCheck = useCallback(async (siteAUrl: string, siteBUrl: string) => {
    if (!siteAUrl.trim() || !siteBUrl.trim()) {
      setError("Please enter both URLs to compare.");
      return;
    }

    setMobileCompareView("siteA");
    setLoading(true);
    setError(null);
    setReport(null);
    setComparison(null);
    setCopyState("idle");
    setShareState("idle");

    try {
      const [siteA, siteB] = await Promise.all([requestReport(siteAUrl), requestReport(siteBUrl)]);
      setComparison({ siteA, siteB });
      addToHistory(siteA);
      addToHistory(siteB);
    } catch (fetchError) {
      const message = fetchError instanceof Error ? fetchError.message : "Unexpected error.";
      setComparison(null);
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [addToHistory, requestReport]);

  const runBulkCheck = useCallback(async (rawInput: string) => {
    const targets = rawInput
      .split(/\r?\n/)
      .map((entry) => entry.trim())
      .filter(Boolean);

    if (targets.length === 0) {
      setError("Please enter at least one URL for bulk scan.");
      setBulkResults([]);
      return;
    }

    if (targets.length > MAX_BULK_URLS) {
      setError(`Bulk scan supports up to ${MAX_BULK_URLS} URLs per run.`);
      setBulkResults([]);
      return;
    }

    setLoading(true);
    setError(null);
    setReport(null);
    setComparison(null);
    setBulkResults([]);
    setBulkExportState("idle");
    setCopyState("idle");
    setShareState("idle");

    try {
      const settled = await Promise.allSettled(targets.map((target) => requestReport(target)));
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
      if (failedCount > 0) {
        setError(`${failedCount} of ${nextResults.length} URLs failed. Review the table for details.`);
      }
    } finally {
      setLoading(false);
    }
  }, [addToHistory, requestReport]);

  function onSingleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
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

  function onHistoryEntryClick(entryUrl: string) {
    setMode("single");
    setUrl(entryUrl);
    void runSingleCheck(entryUrl);
  }

  function onPopularSiteClick(site: string) {
    const cached = popularCacheByUrl.get(site);

    if (cached) {
      setMode("single");
      setUrl(site);
      setReport(cached.report);
      setComparison(null);
      setError(null);
      setCopyState("idle");
      setShareState("idle");
      addToHistory(cached.report);
      return;
    }

    void refreshPopularSite(site, true);
  }

  async function onCopyReport() {
    if (!report) return;

    try {
      await navigator.clipboard.writeText(formatReportForClipboard(report));
      setCopyState("copied");
    } catch {
      setCopyState("error");
    } finally {
      window.setTimeout(() => setCopyState("idle"), 2500);
    }
  }

  async function onCopyBadgeCode(format: "markdown" | "html") {
    if (!badgeDomain || !badgeUrl) return;

    try {
      const content = format === "markdown" ? badgeMarkdownCode : badgeHtmlCode;
      await navigator.clipboard.writeText(content);
      setBadgeCopyState(format);
    } catch {
      setBadgeCopyState("error");
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
    } catch {
      setBulkExportState("error");
    } finally {
      window.setTimeout(() => setBulkExportState("idle"), 2500);
    }
  }

  const onExportPdf = useCallback(async () => {
    if (!exportTargetRef.current || (!report && !comparison)) return;

    setPdfState("generating");
    try {
      const html2pdfModule = await import("html2pdf.js");
      const html2pdfFactory = (html2pdfModule.default ??
        html2pdfModule) as unknown as () => {
        from: (source: HTMLElement) => {
          set: (options: Record<string, unknown>) => { save: () => Promise<void> };
        };
      };

      const filename =
        mode === "compare"
          ? `security-compare-report-${Date.now()}.pdf`
          : `security-report-${Date.now()}.pdf`;

      await html2pdfFactory()
        .from(exportTargetRef.current)
        .set({
          filename,
          margin: 8,
          image: { type: "jpeg", quality: 0.98 },
          html2canvas: { scale: 2, useCORS: true, backgroundColor: "#020617" },
          jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
          pagebreak: { mode: ["avoid-all", "css", "legacy"] }
        })
        .save();
      setPdfState("idle");
    } catch {
      setPdfState("error");
      window.setTimeout(() => setPdfState("idle"), 3000);
    }
  }, [comparison, mode, report]);

  async function onShareResults() {
    if (!report && !comparison) return;

    let payload: SharePayload;
    if (report) {
      payload = { version: 1, mode: "single", report };
    } else {
      if (!comparison) return;
      payload = { version: 1, mode: "compare", comparison };
    }

    try {
      const shareToken = encodeSharePayload(payload);
      const shareUrl = new URL(window.location.href);
      shareUrl.searchParams.set(SHARE_QUERY_PARAM, shareToken);

      if (shareUrl.toString().length > 7800) {
        throw new Error("Shared report is too large for a URL.");
      }

      const text = "Security Header Checker report";
      if (navigator.share) {
        await navigator.share({
          title: "Security Header Checker Report",
          text,
          url: shareUrl.toString()
        });
        setShareState("shared");
      } else {
        await navigator.clipboard.writeText(shareUrl.toString());
        setShareState("copied");
      }
    } catch (shareError) {
      if (shareError instanceof DOMException && shareError.name === "AbortError") {
        setShareState("idle");
        return;
      }
      setShareState("error");
    } finally {
      window.setTimeout(() => setShareState("idle"), 3000);
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
          const nextReport = await requestReport(site);
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
  }, [popularCacheByUrl, requestReport, updatePopularSitesCache]);

  useEffect(() => {
    if (loading) {
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
  }, [loading, scanProgress]);

  useEffect(() => {
    if (!report || loading || report.grade !== "A") return;

    const celebrationId = `${report.checkedAt}-${report.checkedUrl}`;
    if (celebratedScanRef.current === celebrationId) return;
    celebratedScanRef.current = celebrationId;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let followUpBurstTimer: number | null = null;
    void import("canvas-confetti")
      .then((module) => {
        const confetti = module.default;
        confetti({
          particleCount: 36,
          spread: 56,
          startVelocity: 26,
          origin: { y: 0.72 },
          scalar: 0.72,
          gravity: 1,
          colors: ["#7dd3fc", "#34d399", "#22d3ee", "#a7f3d0"]
        });
        followUpBurstTimer = window.setTimeout(() => {
          confetti({
            particleCount: 24,
            spread: 44,
            startVelocity: 22,
            origin: { y: 0.74 },
            scalar: 0.66,
            gravity: 1.05,
            colors: ["#38bdf8", "#4ade80", "#5eead4"]
          });
        }, 180);
      })
      .catch(() => {
        // Ignore cosmetic animation failures.
      });

    return () => {
      if (followUpBurstTimer !== null) {
        window.clearTimeout(followUpBurstTimer);
      }
    };
  }, [loading, report]);

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
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.repeat) return;

      if (event.key === "?") {
        event.preventDefault();
        toggleShortcutsModal();
        return;
      }

      if (shortcutsOpen) {
        if (event.key === "Escape") {
          event.preventDefault();
          closeShortcutsModal();
        }
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
          clearCurrentState();
          return;
        }

        if (normalizedKey === "p" && !loading && pdfState !== "generating" && (report || comparison)) {
          event.preventDefault();
          void onExportPdf();
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

      if (event.key === "Escape") {
        event.preventDefault();
        clearCurrentState();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [
    clearCurrentState,
    bulkUrlsInput,
    closeShortcutsModal,
    compareUrlA,
    compareUrlB,
    comparison,
    loading,
    mode,
    onExportPdf,
    pdfState,
    report,
    runBulkCheck,
    runComparisonCheck,
    runSingleCheck,
    shortcutsOpen,
    toggleShortcutsModal,
    url
  ]);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-4 py-10 sm:px-6 lg:px-8">
      <p className="sr-only" aria-live="polite" aria-atomic="true">
        {liveRegionMessage}
      </p>
      <SiteNav
        trailing={
          <button
            type="button"
            onClick={() => setTheme((current) => (current === "dark" ? "light" : "dark"))}
            aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            className="rounded-lg border border-slate-700 bg-slate-950/80 px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-200 transition hover:border-sky-500/60 hover:text-sky-200"
          >
            {theme === "dark" ? "Light mode" : "Dark mode"}
          </button>
        }
      />

      <section className="mb-6 overflow-hidden rounded-2xl border border-sky-500/20 bg-gradient-to-br from-slate-900/90 via-slate-900/80 to-sky-950/40 p-6 shadow-2xl shadow-slate-950/70 backdrop-blur">
        <div className="grid gap-6 md:grid-cols-[1fr_auto] md:items-center">
          <div>
            <h1 className="text-3xl font-semibold text-slate-100 sm:text-5xl">
              Know Your Security Headers in Seconds
            </h1>
            <p className="mt-4 max-w-2xl text-slate-300">
              Security headers tell browsers how to protect your users from attacks like XSS, clickjacking,
              and data leaks. Scan one URL or compare two sites to instantly see where defenses are strong or
              missing.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <span className="rounded-full border border-sky-500/30 bg-sky-500/10 px-3 py-1 text-xs font-medium text-sky-100">
                Fast scans
              </span>
              <span className="rounded-full border border-sky-500/30 bg-sky-500/10 px-3 py-1 text-xs font-medium text-sky-100">
                Side-by-side compare
              </span>
              <span className="rounded-full border border-sky-500/30 bg-sky-500/10 px-3 py-1 text-xs font-medium text-sky-100">
                Shareable reports
              </span>
            </div>
          </div>
          <HeroShieldIcon />
        </div>
      </section>

      <section
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
            Shortcuts: <span className="text-slate-300">Ctrl+Enter</span> scan,{" "}
            <span className="text-slate-300">Ctrl+K</span> clear,{" "}
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
              Enter a domain or full URL and press Ctrl+Enter to scan.
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
              Tip: enter two domains, then use Ctrl+Enter to run comparison.
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

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={clearCurrentState}
            disabled={loading}
            className="rounded-lg border border-slate-700 bg-slate-950/80 px-3 py-1.5 text-xs uppercase tracking-[0.12em] text-slate-300 transition hover:border-sky-500/60 hover:text-sky-200 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Clear current
          </button>
          <button
            type="button"
            onClick={onExportPdf}
            disabled={loading || pdfState === "generating" || (!report && !comparison)}
            className="rounded-lg border border-slate-700 bg-slate-950/80 px-3 py-1.5 text-xs uppercase tracking-[0.12em] text-slate-300 transition hover:border-sky-500/60 hover:text-sky-200 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {pdfState === "generating" ? "Generating PDF..." : "Export PDF"}
          </button>
          <button
            type="button"
            onClick={onShareResults}
            disabled={loading || (!report && !comparison)}
            className="rounded-lg border border-slate-700 bg-slate-950/80 px-3 py-1.5 text-xs uppercase tracking-[0.12em] text-slate-300 transition hover:border-sky-500/60 hover:text-sky-200 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {shareState === "copied"
              ? "Link copied"
              : shareState === "shared"
                ? "Shared"
                : "Share results"}
          </button>
          {pdfState === "error" && (
            <span className="text-xs text-rose-300">Could not export PDF. Try again.</span>
          )}
          {shareState === "error" && (
            <span className="text-xs text-rose-300">Could not share right now. Try again.</span>
          )}
        </div>

        {mode === "bulk" && !loading && bulkResults.length > 0 && (
          <section className="mt-5 rounded-xl border border-slate-800/90 bg-slate-950/60">
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
                className="rounded-lg border border-slate-700 bg-slate-950/80 px-3 py-1.5 text-xs uppercase tracking-[0.12em] text-slate-300 transition hover:border-sky-500/60 hover:text-sky-200"
              >
                {bulkExportState === "exported" ? "CSV exported" : "Export CSV"}
              </button>
            </div>
            <div className="overflow-x-auto border-t border-slate-800/90">
              <table className="min-w-full text-left text-sm">
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
                        <div className="max-w-[320px]">
                          <p className="truncate">{entry.inputUrl}</p>
                          {entry.report && (
                            <p className="truncate text-xs text-slate-500">{entry.report.finalUrl}</p>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {entry.report ? (
                          <span className={`font-semibold ${gradeColor(entry.report.grade)}`}>
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
                      <td className="px-4 py-3 text-slate-400">{entry.error ?? "OK"}</td>
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
                  className="rounded-lg border border-slate-700 bg-slate-950/80 px-3 py-1.5 text-sm text-slate-200 transition hover:border-sky-500/60 hover:text-sky-200"
                >
                  Scan {site}
                </button>
              ))}
            </div>
          </section>
        )}

        <section className="mt-5 rounded-xl border border-slate-800/90 bg-slate-950/60">
          <button
            type="button"
            onClick={() => setFaqOpen((open) => !open)}
            aria-expanded={faqOpen}
            aria-controls="security-header-faq-content"
            className="flex w-full items-center justify-between px-4 py-3 text-left transition hover:bg-slate-900/60"
          >
            <span className="text-sm font-medium text-slate-100">What are security headers?</span>
            <span className="text-xs uppercase tracking-[0.14em] text-slate-400">
              {faqOpen ? "Hide" : "Show"}
            </span>
          </button>
          {faqOpen && (
            <div id="security-header-faq-content" className="border-t border-slate-800/90 px-4 py-3">
              <p className="text-sm text-slate-300">
                Security headers are HTTP response headers that instruct browsers how to safely handle your site.
                They reduce the risk of attacks like XSS, clickjacking, and unsafe data exposure.
              </p>
              <ul className="mt-3 space-y-2 text-sm text-slate-300">
                <li>
                  <span className="font-medium text-slate-100">Content-Security-Policy:</span> limits trusted
                  scripts, styles, and frames.
                </li>
                <li>
                  <span className="font-medium text-slate-100">Strict-Transport-Security:</span> forces HTTPS.
                </li>
                <li>
                  <span className="font-medium text-slate-100">X-Frame-Options:</span> helps prevent clickjacking.
                </li>
                <li>
                  <span className="font-medium text-slate-100">Referrer-Policy:</span> controls referrer leakage.
                </li>
                <li>
                  <span className="font-medium text-slate-100">Permissions-Policy:</span> restricts browser features.
                </li>
              </ul>
            </div>
          )}
        </section>

        {scanProgress > 0 && (
          <section
            className="mt-4 rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-3"
            aria-live="polite"
            aria-atomic="true"
          >
            <div className="mb-2 flex items-center justify-between text-xs text-slate-400">
              <span>
                {mode === "compare"
                  ? "Comparing security headers..."
                  : mode === "bulk"
                    ? "Running bulk scan..."
                    : "Scanning site..."}
              </span>
              <span>{scanProgress}%</span>
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
                className="progress-pulse h-full rounded-full bg-gradient-to-r from-sky-500 via-cyan-400 to-emerald-400 transition-[width] duration-200"
                style={{ width: `${scanProgress}%` }}
              />
            </div>
          </section>
        )}

        <section className="mt-5 rounded-xl border border-slate-800/90 bg-slate-950/60">
          <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
            <button
              type="button"
              onClick={() => setHistoryOpen((open) => !open)}
              aria-expanded={historyOpen}
              aria-controls="recent-scans-list"
              className="text-sm font-medium text-slate-200 transition hover:text-sky-200"
            >
              Recent Scans ({scanHistory.length}) {historyOpen ? "−" : "+"}
            </button>
            <button
              type="button"
              onClick={clearHistory}
              disabled={scanHistory.length === 0}
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
                <ul className="space-y-2">
                  {scanHistory.map((entry) => (
                    <li key={entry.id}>
                      <button
                        type="button"
                        onClick={() => onHistoryEntryClick(entry.url)}
                        disabled={loading}
                        className="flex w-full items-center justify-between gap-3 rounded-lg border border-slate-800/80 bg-slate-900/70 px-3 py-2 text-left transition hover:border-sky-500/60 hover:bg-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm text-slate-100">{entry.url}</p>
                          <p className="text-xs text-slate-400">
                            {new Date(entry.checkedAt).toLocaleString()}
                          </p>
                        </div>
                        <span className={`text-lg font-semibold ${gradeColor(entry.grade)}`}>
                          {entry.grade}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </section>

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

        <section className="mt-5 rounded-xl border border-slate-800/90 bg-slate-950/60">
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
                  <li key={site} className="rounded-lg border border-slate-800/80 bg-slate-900/70 p-3">
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
                        className="flex-1 rounded-md border border-slate-700 px-2 py-1.5 text-xs text-slate-200 transition hover:border-sky-500/60 hover:text-sky-200 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {cached ? "Open report" : "Pre-scan"}
                      </button>
                      <button
                        type="button"
                        onClick={() => void refreshPopularSite(site)}
                        disabled={loading || isRefreshingThisSite}
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

      <div ref={exportTargetRef}>
        {!loading && report && (
          <>
            <section className="mt-6 grid gap-6 lg:grid-cols-[280px_1fr]">
              <article className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
              <p className="text-sm uppercase tracking-[0.2em] text-slate-400">Overall Grade</p>
              <p className={`mt-2 text-7xl font-bold ${singleGradeColor}`}>{report.grade}</p>
              <p className="mt-1 text-sm text-slate-300">
                Score: {report.score}/{report.results.length * 2}
              </p>
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={onCopyReport}
                  className="w-full rounded-lg border border-slate-700 bg-slate-950/80 px-3 py-2 text-sm font-medium text-slate-200 transition hover:border-sky-500/60 hover:text-sky-200"
                >
                  {copyState === "copied" ? "Copied report" : "Copy Report"}
                </button>
                <button
                  type="button"
                  onClick={() => setBadgePanelOpen((current) => !current)}
                  disabled={!badgeDomain}
                  className="w-full rounded-lg border border-slate-700 bg-slate-950/80 px-3 py-2 text-sm font-medium text-slate-200 transition hover:border-sky-500/60 hover:text-sky-200 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {badgePanelOpen ? "Hide Badge" : "Get Badge"}
                </button>
              </div>
              {copyState === "error" && (
                <p className="mt-2 text-xs text-rose-300">
                  Clipboard unavailable. Please copy manually.
                </p>
              )}
              {badgePanelOpen && (
                <section className="mt-3 rounded-lg border border-slate-800 bg-slate-950/70 p-3">
                  <p className="text-xs uppercase tracking-[0.14em] text-slate-500">Embeddable badge</p>
                  {badgeDomain ? (
                    <>
                      <div className="mt-2 inline-flex rounded-md border border-slate-700 bg-slate-900 p-1">
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
                          onClick={() => setBadgeStyle("flat-square")}
                          className={`rounded px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] transition ${
                            badgeStyle === "flat-square"
                              ? "bg-sky-500 text-slate-950"
                              : "text-slate-300 hover:text-sky-200"
                          }`}
                        >
                          Flat-square
                        </button>
                      </div>

                      <div className="mt-3 flex items-center justify-center rounded-md border border-slate-800 bg-slate-900/60 p-3">
                        <Image
                          src={badgeUrl}
                          alt={`Security headers grade badge for ${badgeDomain}`}
                          width={120}
                          height={20}
                          unoptimized
                        />
                      </div>

                      <div className="mt-3 space-y-2">
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
                  <span className="text-slate-500">Time:</span> {new Date(report.checkedAt).toLocaleString()}
                </p>
              </div>
              </article>

              <div className="grid gap-4 sm:grid-cols-2">
                {report.results.map((header) => (
                  <HeaderCard key={header.key} header={header} />
                ))}
              </div>
            </section>
            <FixSuggestionsPanel results={report.results} />
          </>
        )}

        {!loading && comparison && (
          <section className="mt-6 space-y-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <SiteSummary title="Site A" report={comparison.siteA} />
              <SiteSummary title="Site B" report={comparison.siteB} />
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
                  {comparison.siteA.results.map((header) => (
                    <HeaderCard
                      key={`a-${header.key}`}
                      header={header}
                      highlighted={differingHeaderKeys.has(header.key)}
                    />
                  ))}
                </div>
              </section>
              <section className={mobileCompareView === "siteB" ? "block" : "hidden lg:block"}>
                <h3 className="mb-3 text-sm uppercase tracking-[0.2em] text-slate-400">Site B Headers</h3>
                <div className="grid gap-4 sm:grid-cols-2">
                  {comparison.siteB.results.map((header) => (
                    <HeaderCard
                      key={`b-${header.key}`}
                      header={header}
                      highlighted={differingHeaderKeys.has(header.key)}
                    />
                  ))}
                </div>
              </section>
            </div>
          </section>
        )}
      </div>

      <SiteFooter className="mt-10" />

      {shortcutsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            type="button"
            aria-label="Close keyboard shortcuts modal"
            onClick={closeShortcutsModal}
            className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm"
          />
          <div
            id="keyboard-shortcuts-modal"
            ref={shortcutsDialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="keyboard-shortcuts-title"
            aria-describedby="keyboard-shortcuts-description"
            className="relative z-10 w-full max-w-xl rounded-2xl border border-slate-700 bg-slate-900/95 p-6 shadow-2xl shadow-slate-950/80"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 id="keyboard-shortcuts-title" className="text-xl font-semibold text-slate-100">
                  Keyboard shortcuts
                </h2>
                <p id="keyboard-shortcuts-description" className="mt-1 text-sm text-slate-300">
                  Use these shortcuts to navigate and operate the checker faster.
                </p>
              </div>
              <button
                ref={shortcutCloseButtonRef}
                type="button"
                onClick={closeShortcutsModal}
                className="rounded-md border border-slate-700 px-2 py-1 text-xs uppercase tracking-[0.12em] text-slate-200 transition hover:border-sky-500/60 hover:text-sky-200"
              >
                Close
              </button>
            </div>
            <ul className="mt-4 space-y-2">
              {SHORTCUT_ROWS.map((shortcut) => (
                <li
                  key={shortcut.keys}
                  className="flex items-center justify-between gap-3 rounded-lg border border-slate-800 bg-slate-950/70 px-3 py-2"
                >
                  <kbd className="rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs font-semibold text-sky-200">
                    {shortcut.keys}
                  </kbd>
                  <span className="text-sm text-slate-300">{shortcut.action}</span>
                </li>
              ))}
            </ul>
            <p className="mt-4 text-xs text-slate-500">
              On macOS, Command (⌘) also works for Ctrl-based shortcuts.
            </p>
          </div>
        </div>
      )}
    </main>
  );
}

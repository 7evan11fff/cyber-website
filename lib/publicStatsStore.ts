import "server-only";

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { getAllHeaderInfo } from "@/lib/securityHeaders";
import type { SecurityReport } from "@/lib/securityReport";

type GradeLetter = "A" | "B" | "C" | "D" | "F";
type DailyScoreBucket = {
  totalScore: number;
  totalMaxScore: number;
  scans: number;
};

type PublicStatsFile = {
  totalScans: number;
  scansByDate: Record<string, number>;
  gradeCounts: Record<GradeLetter, number>;
  missingHeaderCounts: Record<string, number>;
  scoreByDate: Record<string, DailyScoreBucket>;
  updatedAt: string | null;
};

export type GradeDistributionSlice = {
  grade: GradeLetter;
  count: number;
  percentage: number;
};

export type MissingHeaderSlice = {
  key: string;
  label: string;
  count: number;
  percentage: number;
};

export type DailyScoreTrendPoint = {
  date: string;
  label: string;
  averageScorePercent: number | null;
  scanCount: number;
};

export type PublicStatsSnapshot = {
  totalScansAllTime: number;
  totalScansToday: number;
  averageScorePercent: number | null;
  gradeDistribution: GradeDistributionSlice[];
  missingHeaders: MissingHeaderSlice[];
  scoreTrend: DailyScoreTrendPoint[];
  updatedAt: string | null;
};

const PUBLIC_STATS_FILE_PATH = path.join(process.cwd(), "data", "public-stats.json");
const GRADE_ORDER: GradeLetter[] = ["A", "B", "C", "D", "F"];
const MAX_DAILY_BUCKETS = 400;
const MAX_MISSING_HEADER_KEYS = 64;

function createEmptyStatsFile(): PublicStatsFile {
  return {
    totalScans: 0,
    scansByDate: {},
    gradeCounts: {
      A: 0,
      B: 0,
      C: 0,
      D: 0,
      F: 0
    },
    missingHeaderCounts: {},
    scoreByDate: {},
    updatedAt: null
  };
}

function toIsoDayKey(input: Date): string {
  return input.toISOString().slice(0, 10);
}

function clampInt(value: unknown, fallback = 0): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  const normalized = Math.trunc(value);
  return normalized >= 0 ? normalized : fallback;
}

function normalizeGrade(input: unknown): GradeLetter {
  if (typeof input !== "string") return "F";
  const normalized = input.trim().toUpperCase();
  return GRADE_ORDER.includes(normalized as GradeLetter) ? (normalized as GradeLetter) : "F";
}

function normalizeDateBucketEntries(value: unknown): Record<string, number> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const entries = Object.entries(value);
  const normalized: Record<string, number> = {};
  for (const [day, count] of entries) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) continue;
    const normalizedCount = clampInt(count);
    if (normalizedCount <= 0) continue;
    normalized[day] = normalizedCount;
  }
  return normalized;
}

function normalizeScoreByDate(value: unknown): Record<string, DailyScoreBucket> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const entries = Object.entries(value);
  const normalized: Record<string, DailyScoreBucket> = {};
  for (const [day, bucketValue] of entries) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) continue;
    if (!bucketValue || typeof bucketValue !== "object" || Array.isArray(bucketValue)) continue;
    const bucket = bucketValue as Partial<DailyScoreBucket>;
    const totalScore = clampInt(bucket.totalScore);
    const totalMaxScore = clampInt(bucket.totalMaxScore);
    const scans = clampInt(bucket.scans);
    if (scans <= 0) continue;
    normalized[day] = { totalScore, totalMaxScore, scans };
  }
  return normalized;
}

function normalizeMissingHeaderCounts(value: unknown): Record<string, number> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const entries = Object.entries(value);
  const normalized: Record<string, number> = {};
  for (const [key, count] of entries) {
    if (typeof key !== "string") continue;
    const normalizedKey = key.trim().toLowerCase();
    if (!normalizedKey) continue;
    const normalizedCount = clampInt(count);
    if (normalizedCount <= 0) continue;
    normalized[normalizedKey] = normalizedCount;
  }

  return Object.fromEntries(
    Object.entries(normalized)
      .sort((a, b) => b[1] - a[1])
      .slice(0, MAX_MISSING_HEADER_KEYS)
  );
}

function normalizeStatsFile(input: unknown): PublicStatsFile {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return createEmptyStatsFile();
  }

  const candidate = input as Partial<PublicStatsFile>;
  const gradeCounts: Record<GradeLetter, number> = {
    A: 0,
    B: 0,
    C: 0,
    D: 0,
    F: 0
  };
  for (const grade of GRADE_ORDER) {
    gradeCounts[grade] = clampInt(candidate.gradeCounts?.[grade]);
  }

  const scansByDate = normalizeDateBucketEntries(candidate.scansByDate);
  const scoreByDate = normalizeScoreByDate(candidate.scoreByDate);
  const missingHeaderCounts = normalizeMissingHeaderCounts(candidate.missingHeaderCounts);
  const totalScans = Math.max(
    clampInt(candidate.totalScans),
    Object.values(scansByDate).reduce((sum, count) => sum + count, 0),
    Object.values(gradeCounts).reduce((sum, count) => sum + count, 0)
  );
  const updatedAt =
    typeof candidate.updatedAt === "string" && Number.isFinite(new Date(candidate.updatedAt).getTime())
      ? new Date(candidate.updatedAt).toISOString()
      : null;

  return {
    totalScans,
    scansByDate,
    gradeCounts,
    missingHeaderCounts,
    scoreByDate,
    updatedAt
  };
}

async function ensureDataFile() {
  await mkdir(path.dirname(PUBLIC_STATS_FILE_PATH), { recursive: true });
  try {
    await readFile(PUBLIC_STATS_FILE_PATH, "utf8");
  } catch {
    await writeFile(PUBLIC_STATS_FILE_PATH, JSON.stringify(createEmptyStatsFile(), null, 2), "utf8");
  }
}

async function readDataFile(): Promise<PublicStatsFile> {
  await ensureDataFile();
  try {
    const raw = await readFile(PUBLIC_STATS_FILE_PATH, "utf8");
    return normalizeStatsFile(JSON.parse(raw));
  } catch {
    return createEmptyStatsFile();
  }
}

async function writeDataFile(data: PublicStatsFile): Promise<void> {
  await ensureDataFile();
  await writeFile(PUBLIC_STATS_FILE_PATH, JSON.stringify(data, null, 2), "utf8");
}

function pruneDailyBuckets(data: PublicStatsFile) {
  const sortedDays = Object.keys(data.scansByDate).sort((a, b) => b.localeCompare(a));
  if (sortedDays.length <= MAX_DAILY_BUCKETS) {
    return;
  }
  const keep = new Set(sortedDays.slice(0, MAX_DAILY_BUCKETS));
  data.scansByDate = Object.fromEntries(
    Object.entries(data.scansByDate).filter(([day]) => keep.has(day))
  );
  data.scoreByDate = Object.fromEntries(
    Object.entries(data.scoreByDate).filter(([day]) => keep.has(day))
  );
}

function formatDayLabel(day: string): string {
  const parsed = new Date(`${day}T00:00:00.000Z`);
  if (!Number.isFinite(parsed.getTime())) return day;
  return parsed.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export async function recordPublicScan(report: SecurityReport): Promise<void> {
  const data = await readDataFile();
  const checkedAtMs = new Date(report.checkedAt).getTime();
  const now = new Date();
  const checkedAt = Number.isFinite(checkedAtMs) ? new Date(checkedAtMs) : now;
  const dayKey = toIsoDayKey(checkedAt);
  const grade = normalizeGrade(report.grade);

  data.totalScans += 1;
  data.scansByDate[dayKey] = clampInt(data.scansByDate[dayKey]) + 1;
  data.gradeCounts[grade] = clampInt(data.gradeCounts[grade]) + 1;

  const maxScore = Math.max(0, report.results.length * 2);
  const safeScore = Math.max(0, Math.min(Math.trunc(report.score), maxScore));
  const scoreBucket = data.scoreByDate[dayKey] ?? { totalScore: 0, totalMaxScore: 0, scans: 0 };
  scoreBucket.totalScore += safeScore;
  scoreBucket.totalMaxScore += maxScore;
  scoreBucket.scans += 1;
  data.scoreByDate[dayKey] = scoreBucket;

  for (const result of report.results) {
    if (result.status !== "missing") continue;
    const headerKey = result.key.trim().toLowerCase();
    if (!headerKey) continue;
    data.missingHeaderCounts[headerKey] = clampInt(data.missingHeaderCounts[headerKey]) + 1;
  }

  data.updatedAt = now.toISOString();
  data.missingHeaderCounts = normalizeMissingHeaderCounts(data.missingHeaderCounts);
  pruneDailyBuckets(data);
  await writeDataFile(data);
}

export async function getPublicStatsSnapshot(days = 30): Promise<PublicStatsSnapshot> {
  const safeDays = Number.isFinite(days) ? Math.max(7, Math.min(Math.trunc(days), 180)) : 30;
  const data = await readDataFile();
  const todayKey = toIsoDayKey(new Date());

  const totalGradeCount = GRADE_ORDER.reduce((sum, grade) => sum + clampInt(data.gradeCounts[grade]), 0);
  const gradeDistribution: GradeDistributionSlice[] = GRADE_ORDER.map((grade) => {
    const count = clampInt(data.gradeCounts[grade]);
    const percentage = totalGradeCount > 0 ? Number(((count / totalGradeCount) * 100).toFixed(1)) : 0;
    return { grade, count, percentage };
  });

  const headerLabelByKey = new Map(getAllHeaderInfo().map((header) => [header.key, header.label]));
  const totalMissingHeaders = Object.values(data.missingHeaderCounts).reduce((sum, count) => sum + count, 0);
  const missingHeaders: MissingHeaderSlice[] = Object.entries(data.missingHeaderCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([key, count]) => ({
      key,
      label: headerLabelByKey.get(key) ?? key,
      count,
      percentage: totalMissingHeaders > 0 ? Number(((count / totalMissingHeaders) * 100).toFixed(1)) : 0
    }));

  const trendDays: string[] = [];
  const today = new Date();
  for (let index = safeDays - 1; index >= 0; index -= 1) {
    const day = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - index));
    trendDays.push(toIsoDayKey(day));
  }
  const scoreTrend: DailyScoreTrendPoint[] = trendDays.map((day) => {
    const bucket = data.scoreByDate[day];
    const averageScorePercent =
      bucket && bucket.totalMaxScore > 0
        ? Number(((bucket.totalScore / bucket.totalMaxScore) * 100).toFixed(1))
        : null;
    return {
      date: day,
      label: formatDayLabel(day),
      averageScorePercent,
      scanCount: bucket?.scans ?? 0
    };
  });

  const totalScore = Object.values(data.scoreByDate).reduce((sum, bucket) => sum + bucket.totalScore, 0);
  const totalMaxScore = Object.values(data.scoreByDate).reduce((sum, bucket) => sum + bucket.totalMaxScore, 0);
  const averageScorePercent = totalMaxScore > 0 ? Number(((totalScore / totalMaxScore) * 100).toFixed(1)) : null;

  return {
    totalScansAllTime: clampInt(data.totalScans),
    totalScansToday: clampInt(data.scansByDate[todayKey]),
    averageScorePercent,
    gradeDistribution,
    missingHeaders,
    scoreTrend,
    updatedAt: data.updatedAt
  };
}

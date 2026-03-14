import "server-only";

import { randomBytes } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { SharedReportPayload, SharedReportRecord, SharedScanReport } from "@/lib/reportShare";

type SharedReportFile = {
  reports: Record<string, SharedReportRecord>;
};

const SHARED_REPORT_FILE_PATH = path.join(process.cwd(), "data", "shared-reports.json");
const MAX_SHARED_REPORTS = 2000;
const REPORT_ID_PATTERN = /^[a-zA-Z0-9_-]{8,64}$/;

function isSharedReportId(id: string): boolean {
  return REPORT_ID_PATTERN.test(id);
}

async function ensureDataFile(): Promise<void> {
  await mkdir(path.dirname(SHARED_REPORT_FILE_PATH), { recursive: true });
  try {
    await readFile(SHARED_REPORT_FILE_PATH, "utf8");
  } catch {
    const empty: SharedReportFile = { reports: {} };
    await writeFile(SHARED_REPORT_FILE_PATH, JSON.stringify(empty, null, 2), "utf8");
  }
}

async function readDataFile(): Promise<SharedReportFile> {
  await ensureDataFile();
  try {
    const raw = await readFile(SHARED_REPORT_FILE_PATH, "utf8");
    const parsed = JSON.parse(raw) as Partial<SharedReportFile>;
    if (!parsed || typeof parsed !== "object" || !parsed.reports || typeof parsed.reports !== "object") {
      return { reports: {} };
    }
    return parsed as SharedReportFile;
  } catch {
    return { reports: {} };
  }
}

async function writeDataFile(data: SharedReportFile): Promise<void> {
  await ensureDataFile();
  await writeFile(SHARED_REPORT_FILE_PATH, JSON.stringify(data, null, 2), "utf8");
}

function createReportId(): string {
  return randomBytes(9).toString("base64url");
}

function pruneReports(reports: Record<string, SharedReportRecord>): Record<string, SharedReportRecord> {
  const entries = Object.entries(reports);
  if (entries.length <= MAX_SHARED_REPORTS) {
    return reports;
  }

  const sorted = entries.sort(
    (a, b) => new Date(b[1].createdAt).getTime() - new Date(a[1].createdAt).getTime()
  );
  return Object.fromEntries(sorted.slice(0, MAX_SHARED_REPORTS));
}

export async function createSharedReport(payload: SharedReportPayload): Promise<SharedReportRecord> {
  const data = await readDataFile();
  let id = createReportId();
  while (data.reports[id]) {
    id = createReportId();
  }

  const record: SharedReportRecord = {
    id,
    createdAt: new Date().toISOString(),
    payload
  };
  data.reports[id] = record;
  data.reports = pruneReports(data.reports);
  await writeDataFile(data);
  return record;
}

export async function getSharedReportById(id: string): Promise<SharedReportRecord | null> {
  const trimmedId = id.trim();
  if (!isSharedReportId(trimmedId)) {
    return null;
  }
  const data = await readDataFile();
  return data.reports[trimmedId] ?? null;
}

export async function listSharedReportPaths(limit = 150): Promise<string[]> {
  const data = await readDataFile();
  return Object.values(data.reports)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, limit)
    .map((entry) => `/report/${entry.id}`);
}

export type PublicScanRecord = {
  id: string;
  createdAt: string;
  report: SharedScanReport;
};

export async function listRecentPublicScans(limit = 5): Promise<PublicScanRecord[]> {
  const safeLimit = Number.isFinite(limit) ? Math.max(1, Math.min(Math.trunc(limit), 25)) : 5;
  const data = await readDataFile();
  const singleReportEntries = Object.values(data.reports).filter(
    (
      entry
    ): entry is SharedReportRecord & {
      payload: Extract<SharedReportPayload, { mode: "single" }>;
    } => entry.payload.mode === "single"
  );
  return singleReportEntries
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, safeLimit)
    .map((entry) => ({
      id: entry.id,
      createdAt: entry.createdAt,
      report: entry.payload.report
    }));
}

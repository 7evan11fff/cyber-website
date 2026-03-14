import { getAllHeaderInfo, type HeaderStatus } from "@/lib/securityHeaders";
import type { ScanHistoryEntry } from "@/lib/userData";

type HeaderDefinition = {
  key: string;
  label: string;
};

const STATUS_SCORE: Record<HeaderStatus, number> = {
  good: 2,
  weak: 1,
  missing: 0
};

function extractDomain(value: string): string {
  try {
    const withProtocol = /^https?:\/\//i.test(value) ? value : `https://${value}`;
    return new URL(withProtocol).hostname || value;
  } catch {
    return value;
  }
}

export function escapeCsvCell(value: string): string {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, "\"\"")}"`;
  }
  return value;
}

export function statusToScore(status: HeaderStatus | undefined): number | null {
  if (!status) return null;
  return STATUS_SCORE[status];
}

export function buildScanHistoryCsv(
  entries: ScanHistoryEntry[],
  options?: { headerDefinitions?: HeaderDefinition[] }
): string {
  const headerDefinitions = options?.headerDefinitions ?? getAllHeaderInfo().map((header) => ({
    key: header.key,
    label: header.label
  }));

  const headerRow = [
    "Scan ID",
    "Date",
    "URL",
    "Domain",
    "Grade",
    "Score",
    "Max Score",
    "Total Header Score",
    "Total Good Headers",
    "Total Weak Headers",
    "Total Missing Headers",
    ...headerDefinitions.flatMap((header) => [`${header.label} Status`, `${header.label} Score`])
  ];

  const dataRows = entries.map((entry) => {
    const statuses = entry.headerStatuses ?? {};
    const statusValues = Object.values(statuses);
    const totalGood = statusValues.filter((status) => status === "good").length;
    const totalWeak = statusValues.filter((status) => status === "weak").length;
    const totalMissing = statusValues.filter((status) => status === "missing").length;
    const totalHeaderScore = statusValues.reduce((sum, status) => sum + STATUS_SCORE[status], 0);

    const perHeaderCells = headerDefinitions.flatMap((header) => {
      const status = statuses[header.key];
      const score = statusToScore(status);
      return [status ?? "unknown", score === null ? "" : String(score)];
    });

    return [
      entry.id,
      entry.checkedAt,
      entry.url,
      extractDomain(entry.url),
      entry.grade,
      typeof entry.score === "number" && Number.isFinite(entry.score) ? String(entry.score) : "",
      typeof entry.maxScore === "number" && Number.isFinite(entry.maxScore) ? String(entry.maxScore) : "",
      String(totalHeaderScore),
      String(totalGood),
      String(totalWeak),
      String(totalMissing),
      ...perHeaderCells
    ];
  });

  return [headerRow, ...dataRows]
    .map((row) => row.map((cell) => escapeCsvCell(String(cell))).join(","))
    .join("\n");
}

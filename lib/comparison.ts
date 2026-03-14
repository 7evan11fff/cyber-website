import type { HeaderResult } from "@/lib/securityHeaders";

export type ComparisonSiteReport = {
  score: number;
  grade: string;
  maxScore?: number;
  results: HeaderResult[];
  responseTimeMs?: number;
  scanDurationMs?: number;
};

export type ComparisonReportData = {
  siteA: ComparisonSiteReport;
  siteB: ComparisonSiteReport;
};

export type ComparisonSide = "siteA" | "siteB";
export type ComparisonAdvantage = ComparisonSide | "tie";
export type ComparisonRowTone = "good" | "missing" | "weak" | "neutral";

export type ComparisonRow = {
  key: string;
  label: string;
  siteA: HeaderResult;
  siteB: HeaderResult;
  tone: ComparisonRowTone;
  advantage: ComparisonAdvantage;
  recommendation: string;
};

export type ComparisonSummary = {
  siteAGradeLabel: string;
  siteBGradeLabel: string;
  winner: ComparisonAdvantage;
  winnerLabel: string | null;
  hasClearWinner: boolean;
  scoreDifference: number;
  narrative: string;
};

const STATUS_WEIGHT: Record<HeaderResult["status"], number> = {
  good: 2,
  weak: 1,
  missing: 0
};

const GRADE_WEIGHT: Record<string, number> = {
  A: 5,
  B: 4,
  C: 3,
  D: 2,
  F: 1
};

function normalizeGrade(grade: string): string {
  return grade.trim().toUpperCase();
}

function pluralizePoints(value: number): string {
  return value === 1 ? "point" : "points";
}

export function formatGradeWithModifier(grade: string, score: number, maxScore: number): string {
  const normalizedGrade = normalizeGrade(grade);
  if (!["A", "B", "C", "D", "F"].includes(normalizedGrade)) {
    return normalizedGrade || grade;
  }

  if (normalizedGrade === "F" || !Number.isFinite(score) || !Number.isFinite(maxScore) || maxScore <= 0) {
    return normalizedGrade;
  }

  const ratio = score / maxScore;
  if (normalizedGrade === "A") {
    if (ratio >= 0.97) return "A+";
    if (ratio < 0.92) return "A-";
    return "A";
  }
  if (normalizedGrade === "B") {
    if (ratio >= 0.86) return "B+";
    if (ratio < 0.83) return "B-";
    return "B";
  }
  if (normalizedGrade === "C") {
    if (ratio >= 0.75) return "C+";
    if (ratio < 0.7) return "C-";
    return "C";
  }
  if (ratio >= 0.58) return "D+";
  if (ratio < 0.54) return "D-";
  return "D";
}

export function getHeaderAdvantage(siteAHeader: HeaderResult, siteBHeader: HeaderResult): ComparisonAdvantage {
  const siteAWeight = STATUS_WEIGHT[siteAHeader.status];
  const siteBWeight = STATUS_WEIGHT[siteBHeader.status];

  if (siteAWeight > siteBWeight) return "siteA";
  if (siteBWeight > siteAWeight) return "siteB";
  return "tie";
}

function comparisonTone(siteAHeader: HeaderResult, siteBHeader: HeaderResult): ComparisonRowTone {
  if (siteAHeader.status === "good" && siteBHeader.status === "good") return "good";
  if (siteAHeader.status === "missing" || siteBHeader.status === "missing") return "missing";
  if (siteAHeader.status === "weak" || siteBHeader.status === "weak") return "weak";
  return "neutral";
}

function buildRecommendation(siteAHeader: HeaderResult, siteBHeader: HeaderResult, siteALabel: string, siteBLabel: string) {
  if (siteAHeader.status === "good" && siteBHeader.status === "good") {
    return "Both sites are configured well for this header.";
  }

  if (siteAHeader.status === "missing" && siteBHeader.status !== "missing") {
    return `${siteALabel}: ${siteAHeader.guidance}`;
  }
  if (siteBHeader.status === "missing" && siteAHeader.status !== "missing") {
    return `${siteBLabel}: ${siteBHeader.guidance}`;
  }

  if (siteAHeader.status !== "good" && siteBHeader.status === "good") {
    return `${siteALabel}: ${siteAHeader.guidance}`;
  }
  if (siteBHeader.status !== "good" && siteAHeader.status === "good") {
    return `${siteBLabel}: ${siteBHeader.guidance}`;
  }

  if (siteAHeader.status !== "good" && siteBHeader.status !== "good") {
    return `${siteALabel}: ${siteAHeader.guidance} ${siteBLabel}: ${siteBHeader.guidance}`;
  }

  return "Review values to align both sites.";
}

export function buildComparisonRows(
  comparison: ComparisonReportData,
  options: {
    siteALabel: string;
    siteBLabel: string;
  }
): ComparisonRow[] {
  const siteBByKey = new Map(comparison.siteB.results.map((result) => [result.key, result]));

  return comparison.siteA.results
    .map((siteAHeader) => {
      const siteBHeader = siteBByKey.get(siteAHeader.key);
      if (!siteBHeader) return null;

      return {
        key: siteAHeader.key,
        label: siteAHeader.label,
        siteA: siteAHeader,
        siteB: siteBHeader,
        tone: comparisonTone(siteAHeader, siteBHeader),
        advantage: getHeaderAdvantage(siteAHeader, siteBHeader),
        recommendation: buildRecommendation(siteAHeader, siteBHeader, options.siteALabel, options.siteBLabel)
      };
    })
    .filter((row): row is ComparisonRow => Boolean(row));
}

export function buildHeaderPresenceDiff(comparison: ComparisonReportData): {
  siteAOnly: string[];
  siteBOnly: string[];
} {
  const siteAOnly: string[] = [];
  const siteBOnly: string[] = [];
  const siteBByKey = new Map(comparison.siteB.results.map((result) => [result.key, result]));

  for (const siteAHeader of comparison.siteA.results) {
    const siteBHeader = siteBByKey.get(siteAHeader.key);
    if (!siteBHeader) continue;
    if (siteAHeader.present && !siteBHeader.present) {
      siteAOnly.push(siteAHeader.label);
    } else if (siteBHeader.present && !siteAHeader.present) {
      siteBOnly.push(siteAHeader.label);
    }
  }

  return { siteAOnly, siteBOnly };
}

export function buildComparisonSummary(
  comparison: ComparisonReportData,
  options: {
    siteALabel: string;
    siteBLabel: string;
  }
): ComparisonSummary {
  const siteAMaxScore = Math.max(
    0,
    typeof comparison.siteA.maxScore === "number" ? comparison.siteA.maxScore : comparison.siteA.results.length * 2
  );
  const siteBMaxScore = Math.max(
    0,
    typeof comparison.siteB.maxScore === "number" ? comparison.siteB.maxScore : comparison.siteB.results.length * 2
  );
  const siteAGradeLabel = formatGradeWithModifier(comparison.siteA.grade, comparison.siteA.score, siteAMaxScore);
  const siteBGradeLabel = formatGradeWithModifier(comparison.siteB.grade, comparison.siteB.score, siteBMaxScore);
  const scoreDifference = comparison.siteA.score - comparison.siteB.score;

  const winner: ComparisonAdvantage =
    scoreDifference > 0 ? "siteA" : scoreDifference < 0 ? "siteB" : "tie";

  const gradeGap =
    (GRADE_WEIGHT[normalizeGrade(comparison.siteA.grade)] ?? 0) -
    (GRADE_WEIGHT[normalizeGrade(comparison.siteB.grade)] ?? 0);
  const hasClearWinner = winner !== "tie" && (Math.abs(scoreDifference) >= 3 || Math.abs(gradeGap) >= 1);
  const winnerLabel = winner === "siteA" ? options.siteALabel : winner === "siteB" ? options.siteBLabel : null;

  let narrative = "Both sites are equally secure based on the current header checks.";
  if (winner !== "tie" && winnerLabel) {
    const points = Math.abs(scoreDifference);
    if (hasClearWinner) {
      narrative = `${winnerLabel} is more secure by ${points} ${pluralizePoints(points)}.`;
    } else {
      narrative = `${winnerLabel} has a slight edge of ${points} ${pluralizePoints(points)}.`;
    }
  }

  return {
    siteAGradeLabel,
    siteBGradeLabel,
    winner,
    winnerLabel,
    hasClearWinner,
    scoreDifference,
    narrative
  };
}

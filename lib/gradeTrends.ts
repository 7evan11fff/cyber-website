import type { DomainGradeHistoryPoint } from "@/lib/userData";

export type TrendDirection = "improving" | "degrading" | "stable";

const GRADE_RANK: Record<string, number> = {
  A: 5,
  B: 4,
  C: 3,
  D: 2,
  F: 1
};

export type GradeChangeAnnotation = {
  from: string;
  to: string;
  checkedAt: string;
  direction: TrendDirection;
};

export function gradeToScore(grade: string): number {
  return GRADE_RANK[grade.toUpperCase()] ?? 0;
}

export function sortHistoryAscending(points: DomainGradeHistoryPoint[]): DomainGradeHistoryPoint[] {
  return [...points].sort((a, b) => new Date(a.checkedAt).getTime() - new Date(b.checkedAt).getTime());
}

export function getTrendDirection(points: DomainGradeHistoryPoint[]): TrendDirection {
  if (points.length < 2) return "stable";
  const sorted = sortHistoryAscending(points);
  const firstScore = gradeToScore(sorted[0]?.grade ?? "");
  const lastScore = gradeToScore(sorted[sorted.length - 1]?.grade ?? "");
  if (lastScore > firstScore) return "improving";
  if (lastScore < firstScore) return "degrading";
  return "stable";
}

export function getGradeChangeAnnotations(
  points: DomainGradeHistoryPoint[]
): GradeChangeAnnotation[] {
  if (points.length < 2) return [];
  const sorted = sortHistoryAscending(points);
  const changes: GradeChangeAnnotation[] = [];
  for (let index = 1; index < sorted.length; index += 1) {
    const previous = sorted[index - 1];
    const current = sorted[index];
    if (previous.grade === current.grade) continue;
    const previousScore = gradeToScore(previous.grade);
    const currentScore = gradeToScore(current.grade);
    changes.push({
      from: previous.grade,
      to: current.grade,
      checkedAt: current.checkedAt,
      direction:
        currentScore > previousScore
          ? "improving"
          : currentScore < previousScore
            ? "degrading"
            : "stable"
    });
  }
  return changes;
}

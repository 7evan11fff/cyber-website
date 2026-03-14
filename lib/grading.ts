import type { HeaderResult } from "@/lib/securityHeaders";

export type GradeResult = {
  score: number;
  grade: string;
  maxScore: number;
};

type GradeOptions = {
  additionalScore?: number;
  additionalMaxScore?: number;
};

export function calculateGrade(results: HeaderResult[], options: GradeOptions = {}): GradeResult {
  const headerScore = results.reduce((total, result) => {
    if (result.status === "good") return total + 2;
    if (result.status === "weak") return total + 1;
    return total;
  }, 0);

  const headerMaxScore = results.length * 2;
  const additionalMaxScore = Math.max(0, Math.trunc(options.additionalMaxScore ?? 0));
  const additionalScore = Math.max(0, Math.min(Math.trunc(options.additionalScore ?? 0), additionalMaxScore));
  const score = headerScore + additionalScore;
  const maxScore = headerMaxScore + additionalMaxScore;
  const ratio = maxScore > 0 ? score / maxScore : 0;

  let grade = "F";
  if (ratio >= 0.92) grade = "A";
  else if (ratio >= 0.8) grade = "B";
  else if (ratio >= 0.65) grade = "C";
  else if (ratio >= 0.5) grade = "D";

  return { score, grade, maxScore };
}

import type { HeaderResult } from "@/lib/securityHeaders";

export type GradeResult = {
  score: number;
  grade: string;
};

export function calculateGrade(results: HeaderResult[]): GradeResult {
  const score = results.reduce((total, result) => {
    if (result.status === "good") return total + 2;
    if (result.status === "weak") return total + 1;
    return total;
  }, 0);

  const maxScore = results.length * 2;
  const ratio = maxScore > 0 ? score / maxScore : 0;

  let grade = "F";
  if (ratio >= 0.92) grade = "A";
  else if (ratio >= 0.8) grade = "B";
  else if (ratio >= 0.65) grade = "C";
  else if (ratio >= 0.5) grade = "D";

  return { score, grade };
}

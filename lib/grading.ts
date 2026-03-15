import type { HeaderResult } from "@/lib/securityHeaders";

export type GradeResult = {
  score: number;
  grade: string;
  maxScore: number;
};

type GradeOptions = {
  additionalScore?: number;
  additionalMaxScore?: number;
  corsScore?: number;
  corsMaxScore?: number;
  tlsScore?: number;
  tlsMaxScore?: number;
  dnsScore?: number;
  dnsMaxScore?: number;
};

const CORS_SCORE_WEIGHT = 0.5;

function toWeightedScorePair(score: number, maxScore: number, weight: number): { score: number; maxScore: number } {
  const safeMaxScore = Math.max(0, Math.trunc(maxScore));
  if (safeMaxScore <= 0 || !Number.isFinite(weight) || weight <= 0) {
    return { score: 0, maxScore: 0 };
  }

  const safeScore = Math.max(0, Math.min(Math.trunc(score), safeMaxScore));
  const weightedMaxScore = Math.max(1, Math.round(safeMaxScore * weight));
  const weightedScore = Math.round((safeScore / safeMaxScore) * weightedMaxScore);
  return {
    score: Math.max(0, Math.min(weightedScore, weightedMaxScore)),
    maxScore: weightedMaxScore
  };
}

export function calculateGrade(results: HeaderResult[], options: GradeOptions = {}): GradeResult {
  const headerScore = results.reduce((total, result) => {
    if (result.status === "good") return total + 2;
    if (result.status === "weak") return total + 1;
    return total;
  }, 0);

  const headerMaxScore = results.length * 2;
  const additionalMaxScore = Math.max(0, Math.trunc(options.additionalMaxScore ?? 0));
  const additionalScore = Math.max(0, Math.min(Math.trunc(options.additionalScore ?? 0), additionalMaxScore));
  const corsRawMaxScore = Math.max(0, Math.trunc(options.corsMaxScore ?? 0));
  const corsRawScore = Math.max(0, Math.min(Math.trunc(options.corsScore ?? 0), corsRawMaxScore));
  const corsWeighted = toWeightedScorePair(corsRawScore, corsRawMaxScore, CORS_SCORE_WEIGHT);
  const tlsRawMaxScore = Math.max(0, Math.trunc(options.tlsMaxScore ?? 0));
  const tlsRawScore = Math.max(0, Math.min(Math.trunc(options.tlsScore ?? 0), tlsRawMaxScore));
  const dnsRawMaxScore = Math.max(0, Math.trunc(options.dnsMaxScore ?? 0));
  const dnsRawScore = Math.max(0, Math.min(Math.trunc(options.dnsScore ?? 0), dnsRawMaxScore));
  const score = headerScore + additionalScore + corsWeighted.score + tlsRawScore + dnsRawScore;
  const maxScore = headerMaxScore + additionalMaxScore + corsWeighted.maxScore + tlsRawMaxScore + dnsRawMaxScore;
  const ratio = maxScore > 0 ? score / maxScore : 0;

  let grade = "F";
  if (ratio >= 0.92) grade = "A";
  else if (ratio >= 0.8) grade = "B";
  else if (ratio >= 0.65) grade = "C";
  else if (ratio >= 0.5) grade = "D";

  return { score, grade, maxScore };
}

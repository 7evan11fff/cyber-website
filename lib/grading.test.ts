import { describe, expect, it } from "vitest";
import { calculateGrade } from "@/lib/grading";
import type { HeaderResult } from "@/lib/securityHeaders";

function header(status: HeaderResult["status"], index: number): HeaderResult {
  return {
    key: `header-${index}`,
    label: `Header ${index}`,
    value: null,
    present: status !== "missing",
    status,
    riskLevel: "low",
    whyItMatters: "test",
    guidance: "test"
  };
}

function buildResults(statuses: HeaderResult["status"][]): HeaderResult[] {
  return statuses.map((status, index) => header(status, index));
}

describe("calculateGrade", () => {
  it("returns an F when there are no results", () => {
    expect(calculateGrade([])).toEqual({ score: 0, grade: "F" });
  });

  it("scores good as 2 points and weak as 1 point", () => {
    const results = buildResults(["good", "weak", "missing"]);
    expect(calculateGrade(results)).toEqual({ score: 3, grade: "D" });
  });

  it("uses score ratio thresholds for letter grades", () => {
    expect(calculateGrade(buildResults(["good", "good", "good", "good", "good", "good", "good", "good", "good", "weak"]))).toEqual({
      score: 19,
      grade: "A"
    });
    expect(
      calculateGrade(buildResults(["good", "good", "good", "good", "good", "good", "good", "good", "missing", "missing"]))
    ).toEqual({
      score: 16,
      grade: "B"
    });
    expect(
      calculateGrade(buildResults(["good", "good", "good", "good", "good", "good", "weak", "missing", "missing", "missing"]))
    ).toEqual({
      score: 13,
      grade: "C"
    });
    expect(
      calculateGrade(buildResults(["good", "good", "good", "good", "good", "missing", "missing", "missing", "missing", "missing"]))
    ).toEqual({
      score: 10,
      grade: "D"
    });
    expect(
      calculateGrade(buildResults(["good", "good", "good", "good", "weak", "missing", "missing", "missing", "missing", "missing"]))
    ).toEqual({
      score: 9,
      grade: "F"
    });
  });
});

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
    expect(calculateGrade([])).toEqual({ score: 0, grade: "F", maxScore: 0 });
  });

  it("scores good as 2 points and weak as 1 point", () => {
    const results = buildResults(["good", "weak", "missing"]);
    expect(calculateGrade(results)).toEqual({ score: 3, grade: "D", maxScore: 6 });
  });

  it("uses score ratio thresholds for letter grades", () => {
    expect(calculateGrade(buildResults(["good", "good", "good", "good", "good", "good", "good", "good", "good", "weak"]))).toEqual({
      score: 19,
      grade: "A",
      maxScore: 20
    });
    expect(
      calculateGrade(buildResults(["good", "good", "good", "good", "good", "good", "good", "good", "missing", "missing"]))
    ).toEqual({
      score: 16,
      grade: "B",
      maxScore: 20
    });
    expect(
      calculateGrade(buildResults(["good", "good", "good", "good", "good", "good", "weak", "missing", "missing", "missing"]))
    ).toEqual({
      score: 13,
      grade: "C",
      maxScore: 20
    });
    expect(
      calculateGrade(buildResults(["good", "good", "good", "good", "good", "missing", "missing", "missing", "missing", "missing"]))
    ).toEqual({
      score: 10,
      grade: "D",
      maxScore: 20
    });
    expect(
      calculateGrade(buildResults(["good", "good", "good", "good", "weak", "missing", "missing", "missing", "missing", "missing"]))
    ).toEqual({
      score: 9,
      grade: "F",
      maxScore: 20
    });
  });

  it("combines optional additional scoring inputs", () => {
    const results = buildResults(["good", "good", "missing", "missing"]);
    expect(calculateGrade(results, { additionalScore: 2, additionalMaxScore: 4 })).toEqual({
      score: 6,
      maxScore: 12,
      grade: "D"
    });
  });

  it("weights CORS scoring lower than core header scoring", () => {
    const results = buildResults(["good", "good", "good", "missing"]);
    expect(calculateGrade(results, { corsScore: 4, corsMaxScore: 4 })).toEqual({
      score: 8,
      maxScore: 10,
      grade: "B"
    });
  });

  it("adds TLS score impact up to 10 points", () => {
    const results = buildResults(["good", "good", "good", "missing"]);
    expect(
      calculateGrade(results, {
        corsScore: 4,
        corsMaxScore: 4,
        tlsScore: 10,
        tlsMaxScore: 10
      })
    ).toEqual({
      score: 18,
      maxScore: 20,
      grade: "B"
    });
  });

  it("adds DNS score impact using provided max score", () => {
    const results = buildResults(["good", "good", "good", "missing"]);
    expect(
      calculateGrade(results, {
        dnsScore: 8,
        dnsMaxScore: 10
      })
    ).toEqual({
      score: 14,
      maxScore: 18,
      grade: "C"
    });
  });

  it("adds SRI score impact using provided max score", () => {
    const results = buildResults(["good", "good", "good", "missing"]);
    expect(
      calculateGrade(results, {
        sriScore: 6,
        sriMaxScore: 8
      })
    ).toEqual({
      score: 12,
      maxScore: 16,
      grade: "C"
    });
  });

  it("applies only a positive security.txt bump when valid", () => {
    const results = buildResults(["good", "good", "good", "missing"]);
    expect(
      calculateGrade(results, {
        securityTxtScore: 1,
        securityTxtMaxScore: 1
      })
    ).toEqual({
      score: 7,
      maxScore: 9,
      grade: "C"
    });
    expect(
      calculateGrade(results, {
        securityTxtScore: 0,
        securityTxtMaxScore: 0
      })
    ).toEqual({
      score: 6,
      maxScore: 8,
      grade: "C"
    });
  });

  it("adds email security score impact using provided max score", () => {
    const results = buildResults(["good", "good", "good", "missing"]);
    expect(
      calculateGrade(results, {
        emailSecurityScore: 25,
        emailSecurityMaxScore: 30
      })
    ).toEqual({
      score: 31,
      maxScore: 38,
      grade: "B"
    });
  });
});

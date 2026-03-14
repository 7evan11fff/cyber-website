import { describe, expect, it } from "vitest";
import {
  buildComparisonRows,
  buildComparisonSummary,
  buildHeaderPresenceDiff,
  formatGradeWithModifier
} from "@/lib/comparison";
import type { HeaderResult } from "@/lib/securityHeaders";

function header(
  key: string,
  status: HeaderResult["status"],
  options?: {
    value?: string | null;
  }
): HeaderResult {
  return {
    key,
    label: `Header ${key}`,
    value: options?.value ?? (status === "missing" ? null : "configured"),
    present: status !== "missing",
    status,
    riskLevel: "low",
    whyItMatters: "test",
    guidance: "fix it"
  };
}

describe("comparison helpers", () => {
  it("formats letter grades with plus/minus modifiers from score ratio", () => {
    expect(formatGradeWithModifier("B", 19, 22)).toBe("B+");
    expect(formatGradeWithModifier("B", 18, 22)).toBe("B-");
    expect(formatGradeWithModifier("D", 11, 22)).toBe("D-");
    expect(formatGradeWithModifier("F", 7, 22)).toBe("F");
  });

  it("builds a clear winner summary when one site is stronger", () => {
    const comparison = {
      siteA: {
        score: 19,
        grade: "B",
        results: [header("a", "good"), header("b", "good"), header("c", "good")]
      },
      siteB: {
        score: 10,
        grade: "D",
        results: [header("a", "missing"), header("b", "weak"), header("c", "weak")]
      }
    };

    const summary = buildComparisonSummary(comparison, {
      siteALabel: "site-a.example",
      siteBLabel: "site-b.example"
    });

    expect(summary.siteAGradeLabel).toBe("B+");
    expect(summary.siteBGradeLabel).toBe("D+");
    expect(summary.winner).toBe("siteA");
    expect(summary.hasClearWinner).toBe(true);
    expect(summary.narrative).toContain("more secure");
  });

  it("returns a tie summary when scores are equal", () => {
    const comparison = {
      siteA: {
        score: 14,
        grade: "C",
        results: [header("a", "good"), header("b", "weak")]
      },
      siteB: {
        score: 14,
        grade: "C",
        results: [header("a", "good"), header("b", "weak")]
      }
    };

    const summary = buildComparisonSummary(comparison, {
      siteALabel: "Site A",
      siteBLabel: "Site B"
    });

    expect(summary.winner).toBe("tie");
    expect(summary.hasClearWinner).toBe(false);
    expect(summary.narrative).toContain("equally secure");
  });

  it("detects headers only present on one site", () => {
    const comparison = {
      siteA: {
        score: 10,
        grade: "D",
        results: [header("h1", "good"), header("h2", "missing")]
      },
      siteB: {
        score: 10,
        grade: "D",
        results: [header("h1", "missing"), header("h2", "good")]
      }
    };

    const diff = buildHeaderPresenceDiff(comparison);
    expect(diff.siteAOnly).toEqual(["Header h1"]);
    expect(diff.siteBOnly).toEqual(["Header h2"]);
  });

  it("builds per-header rows with directional advantage", () => {
    const comparison = {
      siteA: {
        score: 10,
        grade: "D",
        results: [header("csp", "good"), header("hsts", "weak")]
      },
      siteB: {
        score: 10,
        grade: "D",
        results: [header("csp", "missing"), header("hsts", "good")]
      }
    };

    const rows = buildComparisonRows(comparison, {
      siteALabel: "Site A",
      siteBLabel: "Site B"
    });

    expect(rows).toHaveLength(2);
    expect(rows[0]?.advantage).toBe("siteA");
    expect(rows[0]?.tone).toBe("missing");
    expect(rows[1]?.advantage).toBe("siteB");
    expect(rows[1]?.recommendation).toContain("Site A");
  });
});

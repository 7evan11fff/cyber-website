import { describe, expect, it } from "vitest";
import { buildScanHistoryCsv, escapeCsvCell, statusToScore } from "@/lib/scanHistoryCsv";
import type { ScanHistoryEntry } from "@/lib/userData";

describe("scanHistoryCsv", () => {
  it("escapes quoted csv cells", () => {
    expect(escapeCsvCell('value "with" quotes')).toBe('"value ""with"" quotes"');
    expect(escapeCsvCell("safe-value")).toBe("safe-value");
  });

  it("maps header status to numeric score", () => {
    expect(statusToScore("good")).toBe(2);
    expect(statusToScore("weak")).toBe(1);
    expect(statusToScore("missing")).toBe(0);
    expect(statusToScore(undefined)).toBeNull();
  });

  it("builds scan history csv with metadata and per-header scores", () => {
    const entries: ScanHistoryEntry[] = [
      {
        id: "scan-1",
        url: "https://app.example.com/login",
        grade: "B",
        checkedAt: "2026-03-14T10:00:00.000Z",
        score: 15,
        maxScore: 22,
        headerStatuses: {
          "content-security-policy": "good",
          "strict-transport-security": "weak"
        }
      }
    ];

    const csv = buildScanHistoryCsv(entries, {
      headerDefinitions: [
        { key: "content-security-policy", label: "Content-Security-Policy" },
        { key: "strict-transport-security", label: "Strict-Transport-Security" }
      ]
    });

    const [headerRow, valueRow] = csv.split("\n");
    expect(headerRow).toContain("Scan ID,Date,URL,Domain,Grade,Score,Max Score,Total Header Score");
    expect(headerRow).toContain("Content-Security-Policy Status,Content-Security-Policy Score");
    expect(headerRow).toContain("Strict-Transport-Security Status,Strict-Transport-Security Score");

    expect(valueRow).toContain("scan-1,2026-03-14T10:00:00.000Z,https://app.example.com/login,app.example.com,B,15,22,3");
    expect(valueRow).toContain(",1,1,0,good,2,weak,1");
  });
});

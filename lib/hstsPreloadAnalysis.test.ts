import { afterEach, describe, expect, it, vi } from "vitest";
import { __private__, analyzeHstsPreloadStatus } from "@/lib/hstsPreloadAnalysis";

describe("hstsPreloadAnalysis helpers", () => {
  it("parses strict-transport-security directives", () => {
    const parsed = __private__.parseHeader("max-age=63072000; includeSubDomains; preload");
    expect(parsed.hasHeader).toBe(true);
    expect(parsed.maxAge).toBe(63072000);
    expect(parsed.hasSufficientMaxAge).toBe(true);
    expect(parsed.hasIncludeSubDomains).toBe(true);
    expect(parsed.hasPreloadDirective).toBe(true);
  });

  it("normalizes preload enrollment states", () => {
    expect(__private__.normalizeEnrollmentStatus("preloaded")).toBe("preloaded");
    expect(__private__.normalizeEnrollmentStatus("pending")).toBe("pending");
    expect(__private__.normalizeEnrollmentStatus("unknown")).toBe("not-preloaded");
  });
});

describe("analyzeHstsPreloadStatus", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns full points for preloaded domains", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue({
        status: "preloaded",
        errors: [],
        warnings: []
      })
    } as unknown as Response);

    const analysis = await analyzeHstsPreloadStatus(
      "example.com",
      "max-age=63072000; includeSubDomains; preload"
    );

    expect(analysis.available).toBe(true);
    expect(analysis.status).toBe("preloaded");
    expect(analysis.score).toBe(3);
    expect(analysis.maxScore).toBe(3);
    expect(analysis.grade).toBe("A");
  });

  it("returns partial score for pending preload submissions", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue({
        status: "pending",
        errors: [],
        warnings: []
      })
    } as unknown as Response);

    const analysis = await analyzeHstsPreloadStatus(
      "https://example.com",
      "max-age=63072000; includeSubDomains; preload"
    );

    expect(analysis.status).toBe("pending");
    expect(analysis.score).toBe(2);
    expect(analysis.maxScore).toBe(3);
    expect(analysis.findings.some((finding) => finding.id === "hsts-preload-pending")).toBe(true);
  });

  it("classifies eligible but not submitted domains as informational", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue({
        status: "unknown",
        errors: [],
        warnings: []
      })
    } as unknown as Response);

    const analysis = await analyzeHstsPreloadStatus(
      "example.com",
      "max-age=63072000; includeSubDomains; preload"
    );

    expect(analysis.status).toBe("not-preloaded");
    expect(analysis.eligibility).toBe("eligible");
    expect(analysis.score).toBe(1);
    expect(analysis.findings.some((finding) => finding.id === "hsts-preload-eligible")).toBe(true);
  });

  it("classifies ineligible domains as warning state", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue({
        status: "unknown",
        errors: [],
        warnings: []
      })
    } as unknown as Response);

    const analysis = await analyzeHstsPreloadStatus("example.com", "max-age=600");

    expect(analysis.status).toBe("not-preloaded");
    expect(analysis.eligibility).toBe("ineligible");
    expect(analysis.score).toBe(0);
    expect(analysis.requirements.some((requirement) => !requirement.passed)).toBe(true);
    expect(analysis.findings.some((finding) => finding.id === "hsts-preload-ineligible")).toBe(true);
  });

  it("returns unavailable scoring when preload API fails", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("network failure"));

    const analysis = await analyzeHstsPreloadStatus(
      "example.com",
      "max-age=63072000; includeSubDomains; preload"
    );

    expect(analysis.available).toBe(false);
    expect(analysis.score).toBe(0);
    expect(analysis.maxScore).toBe(0);
    expect(analysis.grade).toBe("N/A");
    expect(analysis.summary).toContain("could not be verified");
  });
});

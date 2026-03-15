import { afterEach, describe, expect, it, vi } from "vitest";
import { SRI_MAX_SCORE, __private__, analyzeSubresourceIntegrity } from "@/lib/sriAnalysis";

describe("sriAnalysis helpers", () => {
  it("extracts only external scripts and stylesheets", () => {
    const html = `
      <html>
        <head>
          <script src="/local.js"></script>
          <script src="https://cdn.jsdelivr.net/npm/alpinejs@3.14.0/dist/cdn.min.js" integrity="sha384-abc" crossorigin="anonymous"></script>
          <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter" />
          <link rel="stylesheet preload" href="/local.css" />
        </head>
      </html>
    `;

    const resources = __private__.extractExternalResources(html, "https://example.com");
    expect(resources).toHaveLength(2);
    expect(resources.every((resource) => resource.url.startsWith("https://"))).toBe(true);
    expect(resources.every((resource) => resource.host !== "example.com")).toBe(true);
  });

  it("parses malformed tags without throwing", () => {
    const html = `
      <script src="https://cdnjs.cloudflare.com/a.js" integrity="sha384-aa
      <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/a.css"
      <script src="//unpkg.com/react@18/umd/react.production.min.js"></script>
    `;

    const resources = __private__.extractExternalResources(html, "https://example.com/path");
    expect(resources.length).toBeGreaterThanOrEqual(1);
  });
});

describe("analyzeSubresourceIntegrity", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns perfect coverage when no external resources are present", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      url: "https://example.com/",
      text: vi.fn().mockResolvedValue("<html><head><script src='/app.js'></script></head></html>")
    } as unknown as Response);

    const analysis = await analyzeSubresourceIntegrity("https://example.com");

    expect(analysis.available).toBe(true);
    expect(analysis.externalResourceCount).toBe(0);
    expect(analysis.coveragePercent).toBe(100);
    expect(analysis.score).toBe(SRI_MAX_SCORE);
    expect(analysis.grade).toBe("A");
    expect(analysis.findings).toHaveLength(0);
  });

  it("flags missing SRI on popular CDN scripts as critical", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      url: "https://example.com/",
      text: vi.fn().mockResolvedValue(
        `
          <script src="https://cdnjs.cloudflare.com/ajax/libs/jquery/3.7.1/jquery.min.js"></script>
          <script src="https://cdn.jsdelivr.net/npm/axios/dist/axios.min.js" integrity="sha384-abc"></script>
        `
      )
    } as unknown as Response);

    const analysis = await analyzeSubresourceIntegrity("https://example.com");
    expect(analysis.externalResourceCount).toBe(2);
    expect(analysis.missingIntegrityCount).toBe(1);
    expect(analysis.findings.some((finding) => finding.severity === "critical")).toBe(true);
  });

  it("flags missing crossorigin when integrity is present", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      url: "https://example.com/",
      text: vi.fn().mockResolvedValue(
        `
          <script src="https://cdn.jsdelivr.net/npm/vue@3/dist/vue.global.prod.js" integrity="sha384-xyz"></script>
          <link rel="stylesheet" href="https://unpkg.com/reset-css@5.0.2/reset.css" integrity="sha384-def" />
        `
      )
    } as unknown as Response);

    const analysis = await analyzeSubresourceIntegrity("https://example.com");
    expect(analysis.missingCrossoriginCount).toBe(2);
    expect(analysis.findings.some((finding) => finding.id.includes("missing-crossorigin"))).toBe(true);
  });

  it("uses scanner-style request options when fetching html", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      url: "https://example.com/",
      text: vi.fn().mockResolvedValue("<html></html>")
    } as unknown as Response);

    await analyzeSubresourceIntegrity("https://example.com", {
      userAgent: "CustomAgent/1.0",
      followRedirects: false,
      timeoutMs: 5000
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://example.com",
      expect.objectContaining({
        method: "GET",
        redirect: "manual",
        cache: "no-store",
        headers: expect.objectContaining({
          "user-agent": "CustomAgent/1.0"
        })
      })
    );
  });

  it("returns unavailable analysis when fetch fails", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("network failure"));

    const analysis = await analyzeSubresourceIntegrity("https://example.com");

    expect(analysis.available).toBe(false);
    expect(analysis.maxScore).toBe(0);
    expect(analysis.grade).toBe("N/A");
    expect(analysis.summary).toContain("Reason: network failure");
  });
});

import { describe, expect, it } from "vitest";
import {
  MIXED_CONTENT_MAX_SCORE,
  __private__,
  analyzeMixedContent,
  buildUnavailableMixedContentAnalysis
} from "@/lib/mixedContentAnalysis";

describe("mixedContentAnalysis", () => {
  it("detects mixed-content references across supported resource types", () => {
    const html = `
      <script src="http://cdn.example.com/app.js"></script>
      <link rel="stylesheet" href="http://cdn.example.com/app.css" />
      <img src="http://cdn.example.com/logo.png" />
      <iframe src="http://cdn.example.com/embed"></iframe>
      <video src="http://cdn.example.com/video.mp4"></video>
      <audio src="http://cdn.example.com/audio.mp3"></audio>
      <source src="http://cdn.example.com/source.webm" />
      <form action="http://example.com/submit"></form>
      <a href="http://downloads.example.com/file.zip">Download</a>
    `;

    const analysis = analyzeMixedContent(html, "https://example.com", "https://example.com");
    expect(analysis.available).toBe(true);
    expect(analysis.totalMixedContentCount).toBe(9);
    expect(analysis.activeCount).toBe(3);
    expect(analysis.passiveCount).toBe(6);
    expect(analysis.findings.some((finding) => finding.element === "script" && finding.category === "active")).toBe(true);
    expect(analysis.findings.some((finding) => finding.element === "img" && finding.category === "passive")).toBe(true);
  });

  it("applies heavy penalties for active mixed content", () => {
    const html = `
      <script src="http://cdn.example.com/app.js"></script>
      <iframe src="http://cdn.example.com/frame"></iframe>
    `;

    const analysis = analyzeMixedContent(html, "https://example.com");
    expect(analysis.activeCount).toBe(2);
    expect(analysis.score).toBeLessThanOrEqual(1);
    expect(analysis.maxScore).toBe(MIXED_CONTENT_MAX_SCORE);
    expect(["D", "F"]).toContain(analysis.grade);
  });

  it("applies partial penalties when only passive mixed content exists", () => {
    const html = `
      <img src="http://cdn.example.com/logo.png" />
      <video src="http://cdn.example.com/video.mp4"></video>
      <a href="http://example.com/file.zip">file</a>
    `;
    const analysis = analyzeMixedContent(html, "https://example.com");
    expect(analysis.activeCount).toBe(0);
    expect(analysis.passiveCount).toBe(3);
    expect(analysis.score).toBeGreaterThan(0);
    expect(analysis.score).toBeLessThan(MIXED_CONTENT_MAX_SCORE);
  });

  it("returns full points when no mixed-content URLs are present", () => {
    const html = `
      <script src="https://cdn.example.com/app.js"></script>
      <img src="/logo.png" />
      <a href="//example.com/download">download</a>
      <video src="data:video/mp4;base64,AAAA"></video>
    `;

    const analysis = analyzeMixedContent(html, "https://example.com");
    expect(analysis.totalMixedContentCount).toBe(0);
    expect(analysis.score).toBe(MIXED_CONTENT_MAX_SCORE);
    expect(analysis.grade).toBe("A");
  });

  it("treats non-HTTPS pages as not applicable", () => {
    const html = `<script src="http://cdn.example.com/app.js"></script>`;
    const analysis = analyzeMixedContent(html, "http://example.com");
    expect(analysis.available).toBe(true);
    expect(analysis.isHttpsPage).toBe(false);
    expect(analysis.maxScore).toBe(0);
    expect(analysis.grade).toBe("N/A");
  });

  it("builds unavailable analysis when parsing cannot run", () => {
    const analysis = buildUnavailableMixedContentAnalysis("https://example.com", "https://example.com", "not html");
    expect(analysis.available).toBe(false);
    expect(analysis.summary).toContain("Reason: not html");
  });
});

describe("mixedContentAnalysis helper scoring", () => {
  it("keeps multiple active issues near zero", () => {
    const { score, maxScore } = __private__.calculateScore(3, 0);
    expect(score).toBe(0);
    expect(maxScore).toBe(MIXED_CONTENT_MAX_SCORE);
  });
});

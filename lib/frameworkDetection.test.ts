import { describe, expect, it } from "vitest";
import { detectFrameworkInfo } from "@/lib/frameworkDetection";

describe("detectFrameworkInfo", () => {
  it("detects Next.js from X-Powered-By", () => {
    const info = detectFrameworkInfo(
      new Headers({
        "x-powered-by": "Next.js"
      })
    );

    expect(info.detected?.id).toBe("nextjs");
    expect(info.detected?.label).toBe("Next.js");
  });

  it("detects Nginx from Server header", () => {
    const info = detectFrameworkInfo(
      new Headers({
        server: "nginx/1.25.4"
      })
    );

    expect(info.detected?.id).toBe("nginx");
  });

  it("detects Cloudflare Workers from Cloudflare edge headers", () => {
    const info = detectFrameworkInfo(
      new Headers({
        server: "cloudflare",
        "cf-worker": "edge-router"
      })
    );

    expect(info.detected?.id).toBe("cloudflare-workers");
    expect(info.detected?.evidence.length).toBeGreaterThan(0);
  });

  it("returns null when no known framework signal exists", () => {
    const info = detectFrameworkInfo(new Headers({}));
    expect(info.detected).toBeNull();
  });
});

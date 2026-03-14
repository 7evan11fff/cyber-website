import { describe, expect, it } from "vitest";
import { analyzeSecurityHeaders, getAllHeaderInfo, parseHeaders } from "@/lib/securityHeaders";

describe("securityHeaders", () => {
  it("parses plain object headers and evaluates common strengths", () => {
    const results = parseHeaders({
      "content-security-policy": "default-src 'self'; script-src 'unsafe-inline'",
      "strict-transport-security": "max-age=31536000; includeSubDomains",
      "x-content-type-options": "nosniff",
      "permissions-policy": "camera=(), microphone=()"
    });

    expect(results).toHaveLength(11);

    const csp = results.find((item) => item.key === "content-security-policy");
    const hsts = results.find((item) => item.key === "strict-transport-security");
    const xcto = results.find((item) => item.key === "x-content-type-options");
    const permissions = results.find((item) => item.key === "permissions-policy");

    expect(csp?.status).toBe("weak");
    expect(csp?.riskLevel).toBe("medium");
    expect(hsts?.status).toBe("good");
    expect(xcto?.status).toBe("good");
    expect(permissions?.status).toBe("good");
  });

  it("accepts Headers input and aligns with analyzeSecurityHeaders", () => {
    const headers = new Headers({
      "x-frame-options": "ALLOWALL",
      "referrer-policy": "unsafe-url"
    });

    expect(parseHeaders(headers)).toEqual(analyzeSecurityHeaders(headers));

    const parsed = parseHeaders(headers);
    expect(parsed.find((item) => item.key === "x-frame-options")?.status).toBe("weak");
    expect(parsed.find((item) => item.key === "referrer-policy")?.status).toBe("weak");
    expect(parsed.find((item) => item.key === "content-security-policy")?.status).toBe("missing");
  });

  it("returns stable header metadata snapshots", () => {
    const first = getAllHeaderInfo();
    const second = getAllHeaderInfo();

    expect(first).toHaveLength(11);
    expect(new Set(first.map((item) => item.key)).size).toBe(11);
    expect(first.find((item) => item.key === "content-security-policy")?.label).toBe(
      "Content-Security-Policy"
    );

    first[0].label = "mutated";
    expect(second[0].label).not.toBe("mutated");
  });
});

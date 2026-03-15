import { afterEach, describe, expect, it, vi } from "vitest";
import { __private__, analyzeSecurityTxt } from "@/lib/securityTxtAnalysis";

describe("securityTxtAnalysis helpers", () => {
  it("parses standard security.txt fields", () => {
    const parsed = __private__.parseSecurityTxt(`
      # Security contact metadata
      Contact: mailto:security@example.com
      Contact: https://example.com/security/contact
      Expires: 2030-01-31T00:00:00Z
      Encryption: https://example.com/pgp-key.txt
      Acknowledgments: https://example.com/hall-of-fame
      Preferred-Languages: en, fr
      Canonical: https://example.com/.well-known/security.txt
      Policy: https://example.com/security-policy
      Hiring: https://example.com/careers/security
    `);

    expect(parsed.fields.contact).toEqual([
      "mailto:security@example.com",
      "https://example.com/security/contact"
    ]);
    expect(parsed.fields.expires).toBe("2030-01-31T00:00:00Z");
    expect(parsed.fields.preferredLanguages).toEqual(["en", "fr"]);
    expect(parsed.foundFields).toEqual([
      "contact",
      "expires",
      "encryption",
      "acknowledgments",
      "preferredLanguages",
      "canonical",
      "policy",
      "hiring"
    ]);
  });
});

describe("analyzeSecurityTxt", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("uses /security.txt when /.well-known/security.txt is missing", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce({
        ok: false,
        status: 404,
        url: "https://example.com/.well-known/security.txt",
        text: vi.fn().mockResolvedValue("")
      } as unknown as Response)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        url: "https://example.com/security.txt",
        text: vi.fn().mockResolvedValue(`
          Contact: mailto:security@example.com
          Expires: 2030-12-31T23:59:59Z
          Canonical: https://example.com/security.txt
        `)
      } as unknown as Response);

    const analysis = await analyzeSecurityTxt("https://example.com");

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(analysis.available).toBe(true);
    expect(analysis.fetchedFrom).toBe("/security.txt");
    expect(analysis.fallbackUsed).toBe(true);
    expect(analysis.validation.present).toBe(true);
    expect(analysis.validation.isValid).toBe(true);
    expect(analysis.score).toBe(1);
    expect(analysis.maxScore).toBe(1);
  });

  it("warns when Expires is already expired", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      status: 200,
      url: "https://example.com/.well-known/security.txt",
      text: vi.fn().mockResolvedValue(`
        Contact: mailto:security@example.com
        Expires: 2020-01-01T00:00:00Z
      `)
    } as unknown as Response);

    const analysis = await analyzeSecurityTxt("https://example.com");

    expect(analysis.validation.expiresExpired).toBe(true);
    expect(analysis.validation.isValid).toBe(false);
    expect(analysis.warnings.some((warning) => warning.includes("expired"))).toBe(true);
    expect(analysis.score).toBe(0);
    expect(analysis.maxScore).toBe(0);
  });

  it("returns missing when no security.txt path is found", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce({
        ok: false,
        status: 404,
        url: "https://example.com/.well-known/security.txt",
        text: vi.fn().mockResolvedValue("")
      } as unknown as Response)
      .mockResolvedValueOnce({
        ok: false,
        status: 404,
        url: "https://example.com/security.txt",
        text: vi.fn().mockResolvedValue("")
      } as unknown as Response);

    const analysis = await analyzeSecurityTxt("https://example.com");

    expect(analysis.available).toBe(true);
    expect(analysis.validation.present).toBe(false);
    expect(analysis.summary).toContain("No security.txt file was found");
    expect(analysis.recommendations[0]).toContain("Publish a security.txt file");
  });

  it("returns unavailable when both fetch attempts fail", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("network failure"));

    const analysis = await analyzeSecurityTxt("https://example.com");

    expect(analysis.available).toBe(false);
    expect(analysis.summary).toContain("could not be completed");
    expect(analysis.warnings[0]).toContain("network failure");
  });
});

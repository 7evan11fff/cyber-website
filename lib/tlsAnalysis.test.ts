import { describe, expect, it } from "vitest";
import { analyzeTlsConfiguration, buildTlsAnalysisFromProbe, detectIssuerCategory, TLS_MAX_SCORE } from "@/lib/tlsAnalysis";

describe("tlsAnalysis helpers", () => {
  it("detects major issuer families", () => {
    expect(detectIssuerCategory("Let's Encrypt Authority X3")).toBe("Let's Encrypt");
    expect(detectIssuerCategory("DigiCert TLS RSA SHA256 2020 CA1")).toBe("DigiCert");
    expect(detectIssuerCategory("Unknown CA")).toBe("Unknown");
  });
});

describe("buildTlsAnalysisFromProbe", () => {
  it("warns when certificate expires within 30 days", () => {
    const analysis = buildTlsAnalysisFromProbe({
      hostname: "example.com",
      port: 443,
      tlsVersion: "TLSv1.3",
      cipherName: "TLS_AES_256_GCM_SHA384",
      cipherVersion: "TLSv1.3",
      issuer: "Let's Encrypt",
      subject: "example.com",
      validFrom: "Jan 01 00:00:00 2026 GMT",
      validTo: "Jan 31 00:00:00 2030 GMT",
      daysUntilExpiration: 12,
      chainLength: 3,
      authorized: true,
      authorizationError: null,
      selfSigned: false,
      weakAlgorithms: []
    });

    expect(analysis.certificateExpiringSoon).toBe(true);
    expect(analysis.issuerCategory).toBe("Let's Encrypt");
    expect(analysis.findings.some((finding) => finding.id === "certificate-expiring-soon")).toBe(true);
  });

  it("flags insecure TLS versions and weak ciphers", () => {
    const analysis = buildTlsAnalysisFromProbe({
      hostname: "legacy.example",
      port: 443,
      tlsVersion: "TLSv1.0",
      cipherName: "RC4-MD5",
      cipherVersion: "TLSv1.0",
      issuer: "Legacy CA",
      subject: "legacy.example",
      validFrom: "Jan 01 00:00:00 2025 GMT",
      validTo: "Jan 01 00:00:00 2028 GMT",
      daysUntilExpiration: 600,
      chainLength: 2,
      authorized: true,
      authorizationError: null,
      selfSigned: false,
      weakAlgorithms: ["RC4", "MD5"]
    });

    expect(analysis.isInsecureTlsVersion).toBe(true);
    expect(analysis.weakAlgorithms).toEqual(["RC4", "MD5"]);
    expect(analysis.findings.some((finding) => finding.id === "insecure-tls-version")).toBe(true);
    expect(analysis.findings.some((finding) => finding.id === "weak-cipher-suite")).toBe(true);
    expect(analysis.score).toBeLessThan(TLS_MAX_SCORE);
  });

  it("detects incomplete certificate chain", () => {
    const analysis = buildTlsAnalysisFromProbe({
      hostname: "chain.example",
      port: 443,
      tlsVersion: "TLSv1.2",
      cipherName: "ECDHE-RSA-AES256-GCM-SHA384",
      cipherVersion: "TLSv1.2",
      issuer: "DigiCert",
      subject: "chain.example",
      validFrom: "Jan 01 00:00:00 2025 GMT",
      validTo: "Jan 01 00:00:00 2028 GMT",
      daysUntilExpiration: 600,
      chainLength: 1,
      authorized: false,
      authorizationError: "UNABLE_TO_VERIFY_LEAF_SIGNATURE",
      selfSigned: false,
      weakAlgorithms: []
    });

    expect(analysis.chainComplete).toBe(false);
    expect(analysis.findings.some((finding) => finding.id === "incomplete-certificate-chain")).toBe(true);
  });

  it("detects self-signed certificates", () => {
    const analysis = buildTlsAnalysisFromProbe({
      hostname: "internal.example",
      port: 443,
      tlsVersion: "TLSv1.3",
      cipherName: "TLS_AES_128_GCM_SHA256",
      cipherVersion: "TLSv1.3",
      issuer: "internal.example",
      subject: "internal.example",
      validFrom: "Jan 01 00:00:00 2026 GMT",
      validTo: "Jan 01 00:00:00 2027 GMT",
      daysUntilExpiration: 300,
      chainLength: 1,
      authorized: false,
      authorizationError: "DEPTH_ZERO_SELF_SIGNED_CERT",
      selfSigned: true,
      weakAlgorithms: []
    });

    expect(analysis.selfSigned).toBe(true);
    expect(analysis.findings.some((finding) => finding.id === "self-signed-certificate")).toBe(true);
  });
});

describe("analyzeTlsConfiguration", () => {
  it("returns non-HTTPS analysis for plain HTTP URLs", async () => {
    const analysis = await analyzeTlsConfiguration("http://example.com");
    expect(analysis.available).toBe(false);
    expect(analysis.score).toBe(0);
    expect(analysis.summary).toContain("not served over HTTPS");
  });
});

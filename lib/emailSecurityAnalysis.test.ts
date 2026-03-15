import { describe, expect, it } from "vitest";
import {
  EMAIL_SECURITY_MAX_SCORE,
  analyzeEmailSecurity,
  fetchDkimSelector,
  fetchDmarcRecord,
  fetchSpfRecord,
  __private__
} from "@/lib/emailSecurityAnalysis";

type ResolverFixture = Record<string, string[] | Error>;

function dnsError(code: string): Error {
  return Object.assign(new Error(code), { code });
}

function makeResolver(fixture: ResolverFixture) {
  return async (hostname: string): Promise<string[][]> => {
    const outcome = fixture[hostname];
    if (!outcome) {
      throw dnsError("ENOTFOUND");
    }
    if (outcome instanceof Error) {
      throw outcome;
    }
    return outcome.map((record) => [record]);
  };
}

describe("emailSecurityAnalysis helpers", () => {
  it("parses SPF policy variants and lookup counts", () => {
    expect(__private__.parseSpfPolicy("v=spf1 include:_spf.example.com -all")).toBe("hard-fail");
    expect(__private__.parseSpfPolicy("v=spf1 include:_spf.example.com ~all")).toBe("soft-fail");
    expect(__private__.parseSpfPolicy("v=spf1 include:_spf.example.com ?all")).toBe("neutral");
    expect(__private__.parseSpfPolicy("v=spf1 +all")).toBe("allow-all");
    expect(__private__.countSpfDnsLookups("v=spf1 include:a include:b a mx exists:%{i}.x ptr redirect=x -all")).toBe(7);
  });

  it("parses DMARC policy and reporting tags", () => {
    expect(
      __private__.parseDmarcRecord("v=DMARC1; p=reject; rua=mailto:agg@example.com; ruf=mailto:for@example.com; pct=50")
    ).toEqual({
      policy: "reject",
      rua: ["mailto:agg@example.com"],
      ruf: ["mailto:for@example.com"],
      pct: 50
    });
    expect(__private__.parseDmarcRecord("v=DMARC1; p=none")).toMatchObject({
      policy: "none",
      rua: [],
      ruf: []
    });
    expect(__private__.parseDmarcRecord("not-a-dmarc-record").policy).toBe("invalid");
  });
});

describe("fetchSpfRecord", () => {
  it("extracts SPF records, policy, and lookup limits", async () => {
    const resolver = makeResolver({
      "example.com": ["v=spf1 include:_spf.example.com include:mail.example.com -all"]
    });
    const result = await fetchSpfRecord("Example.COM", resolver);

    expect(result.record).toBe("v=spf1 include:_spf.example.com include:mail.example.com -all");
    expect(result.policy).toBe("hard-fail");
    expect(result.dnsLookupCount).toBe(2);
    expect(result.tooManyLookups).toBe(false);
  });

  it("flags SPF records that exceed DNS lookup limits", async () => {
    const resolver = makeResolver({
      "example.com": ["v=spf1 include:a include:b include:c include:d include:e include:f include:g include:h include:i include:j include:k -all"]
    });
    const result = await fetchSpfRecord("example.com", resolver);

    expect(result.tooManyLookups).toBe(true);
    expect(result.dnsLookupCount).toBe(11);
    expect(result.notes.some((note) => note.includes("RFC limit"))).toBe(true);
  });

  it("returns missing policy when no SPF records exist", async () => {
    const resolver = makeResolver({
      "example.com": dnsError("ENODATA")
    });
    const result = await fetchSpfRecord("example.com", resolver);
    expect(result.record).toBeNull();
    expect(result.policy).toBe("missing");
  });
});

describe("fetchDmarcRecord", () => {
  it("parses DMARC policy, reporting addresses, and pct", async () => {
    const resolver = makeResolver({
      "_dmarc.example.com": ["v=DMARC1; p=quarantine; rua=mailto:agg@example.com; ruf=mailto:for@example.com; pct=75"]
    });
    const result = await fetchDmarcRecord("example.com", resolver);

    expect(result.policy).toBe("quarantine");
    expect(result.rua).toEqual(["mailto:agg@example.com"]);
    expect(result.ruf).toEqual(["mailto:for@example.com"]);
    expect(result.pct).toBe(75);
    expect(result.hasReporting).toBe(true);
  });

  it("marks malformed DMARC as invalid", async () => {
    const resolver = makeResolver({
      "_dmarc.example.com": ["v=DMARC1; rua=mailto:agg@example.com"]
    });
    const result = await fetchDmarcRecord("example.com", resolver);

    expect(result.policy).toBe("invalid");
    expect(result.notes.some((note) => note.includes("malformed"))).toBe(true);
  });
});

describe("fetchDkimSelector", () => {
  it("detects present and valid DKIM selectors", async () => {
    const resolver = makeResolver({
      "selector1._domainkey.example.com": ["v=DKIM1; k=rsa; p=MIIBIjANBgkq..."]
    });
    const result = await fetchDkimSelector("example.com", "selector1", resolver);
    expect(result.present).toBe(true);
    expect(result.valid).toBe(true);
  });

  it("returns missing selector when TXT is absent", async () => {
    const resolver = makeResolver({
      "selector1._domainkey.example.com": dnsError("ENOTFOUND")
    });
    const result = await fetchDkimSelector("example.com", "selector1", resolver);
    expect(result.present).toBe(false);
    expect(result.valid).toBe(false);
  });
});

describe("analyzeEmailSecurity", () => {
  it("awards full score for reject + -all + DKIM", async () => {
    const resolver = makeResolver({
      "example.com": ["v=spf1 include:_spf.example.com -all"],
      "_dmarc.example.com": ["v=DMARC1; p=reject; rua=mailto:agg@example.com"],
      "google._domainkey.example.com": ["v=DKIM1; p=AAA"],
      "selector1._domainkey.example.com": dnsError("ENOTFOUND"),
      "selector2._domainkey.example.com": dnsError("ENOTFOUND"),
      "default._domainkey.example.com": dnsError("ENOTFOUND"),
      "mail._domainkey.example.com": dnsError("ENOTFOUND")
    });
    const result = await analyzeEmailSecurity("example.com", { resolver });

    expect(result.score).toBe(EMAIL_SECURITY_MAX_SCORE);
    expect(result.maxScore).toBe(EMAIL_SECURITY_MAX_SCORE);
    expect(result.findings.some((finding) => finding.id === "spf-missing")).toBe(false);
    expect(result.findings.some((finding) => finding.id === "dmarc-missing")).toBe(false);
    expect(result.findings.some((finding) => finding.id === "dkim-missing-common-selectors")).toBe(false);
  });

  it("produces findings and recommendations for weak/missing controls", async () => {
    const resolver = makeResolver({
      "example.com": ["v=spf1 include:_spf.example.com ~all"],
      "_dmarc.example.com": ["v=DMARC1; p=none"],
      "google._domainkey.example.com": dnsError("ENOTFOUND"),
      "selector1._domainkey.example.com": dnsError("ENOTFOUND"),
      "selector2._domainkey.example.com": dnsError("ENOTFOUND"),
      "default._domainkey.example.com": dnsError("ENOTFOUND"),
      "mail._domainkey.example.com": dnsError("ENOTFOUND")
    });
    const result = await analyzeEmailSecurity("example.com", { resolver });

    expect(result.score).toBe(10);
    const findingIds = result.findings.map((finding) => finding.id);
    expect(findingIds).toContain("spf-soft-fail");
    expect(findingIds).toContain("dmarc-monitor-only");
    expect(findingIds).toContain("dmarc-reporting-missing");
    expect(findingIds).toContain("dkim-missing-common-selectors");
    expect(result.recommendations.length).toBeGreaterThan(0);
  });

  it("uses custom selector lists in analysis", async () => {
    const resolver = makeResolver({
      "example.com": ["v=spf1 -all"],
      "_dmarc.example.com": ["v=DMARC1; p=reject; rua=mailto:agg@example.com"],
      "custom._domainkey.example.com": ["v=DKIM1; p=AAA"]
    });

    const result = await analyzeEmailSecurity("example.com", {
      resolver,
      selectors: ["custom"]
    });

    expect(result.dkim.testedSelectors).toEqual(["custom"]);
    expect(result.dkim.present).toBe(true);
    expect(result.score).toBe(EMAIL_SECURITY_MAX_SCORE);
  });
});

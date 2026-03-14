import { describe, expect, it } from "vitest";
import {
  analyzeCookieSecurity,
  extractSetCookieHeaderValues,
  splitSetCookieHeaderValue
} from "@/lib/cookieSecurity";

describe("cookieSecurity", () => {
  it("splits combined Set-Cookie headers without breaking Expires", () => {
    const combined =
      "session=abc; Path=/; HttpOnly; Secure; Expires=Wed, 21 Oct 2026 07:28:00 GMT, prefs=1; Path=/; SameSite=Lax";

    expect(splitSetCookieHeaderValue(combined)).toEqual([
      "session=abc; Path=/; HttpOnly; Secure; Expires=Wed, 21 Oct 2026 07:28:00 GMT",
      "prefs=1; Path=/; SameSite=Lax"
    ]);
  });

  it("returns no cookies when Set-Cookie is absent", () => {
    const analysis = analyzeCookieSecurity(new Headers({ "x-frame-options": "DENY" }));
    expect(analysis.cookieCount).toBe(0);
    expect(analysis.score).toBe(0);
    expect(analysis.maxScore).toBe(0);
    expect(analysis.grade).toBe("N/A");
  });

  it("extracts Set-Cookie header values from Headers", () => {
    const headers = new Headers();
    headers.append("set-cookie", "session=abc; Path=/; HttpOnly; Secure; SameSite=Lax");
    headers.append("set-cookie", "prefs=1; Path=/settings; Secure; SameSite=Strict");

    const values = extractSetCookieHeaderValues(headers);
    expect(values).toHaveLength(2);
    expect(values[0]).toContain("session=abc");
    expect(values[1]).toContain("prefs=1");
  });

  it("grades cookies individually and aggregates score", () => {
    const headers = new Headers();
    headers.append("set-cookie", "session=abc; Path=/auth; HttpOnly; Secure; SameSite=Strict");
    headers.append("set-cookie", "legacy=1; Path=/; Domain=example.com");

    const analysis = analyzeCookieSecurity(headers);
    expect(analysis.cookieCount).toBe(2);
    expect(analysis.score).toBe(2);
    expect(analysis.maxScore).toBe(4);
    expect(analysis.grade).toBe("D");

    const session = analysis.cookies.find((cookie) => cookie.name === "session");
    const legacy = analysis.cookies.find((cookie) => cookie.name === "legacy");
    expect(session?.status).toBe("good");
    expect(session?.grade).toBe("A");
    expect(legacy?.status).toBe("missing");
    expect(legacy?.grade).toBe("F");
  });
});

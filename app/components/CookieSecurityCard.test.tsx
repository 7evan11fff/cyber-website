import type { CookieSecurityAnalysis, CookieSecurityResult } from "@/lib/cookieSecurity";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CookieSecurityCard } from "@/app/components/CookieSecurityCard";

const cookieStatusStyles = {
  good: "text-emerald-200 border-emerald-500/30",
  weak: "text-amber-200 border-amber-500/30",
  missing: "text-rose-200 border-rose-500/30"
} as const;

function buildCookie(overrides: Partial<CookieSecurityResult> = {}): CookieSecurityResult {
  return {
    name: "session",
    raw: "session=abc123; HttpOnly",
    httpOnly: true,
    secure: false,
    sameSite: "Lax",
    path: "/",
    domain: null,
    score: 1,
    maxScore: 2,
    status: "weak",
    grade: "C",
    findings: ["Missing Secure"],
    guidance: ["Add Secure so the cookie is only sent over HTTPS."],
    ...overrides
  };
}

function buildAnalysis(overrides: Partial<CookieSecurityAnalysis> = {}): CookieSecurityAnalysis {
  return {
    cookies: [buildCookie()],
    cookieCount: 1,
    score: 1,
    maxScore: 2,
    grade: "C",
    summary: "1 cookie analyzed: 0 strong, 1 need attention.",
    ...overrides
  };
}

describe("CookieSecurityCard", () => {
  it("renders empty state when analysis is undefined", () => {
    render(<CookieSecurityCard cookieStatusStyles={cookieStatusStyles} />);

    expect(screen.getByRole("heading", { name: "Cookie security analysis" })).toBeInTheDocument();
    expect(screen.getByText("No Set-Cookie headers were returned by this response.")).toBeInTheDocument();
    expect(screen.getByText("Grade N/A")).toBeInTheDocument();
    expect(screen.getByText("0/0")).toBeInTheDocument();
    expect(screen.getByText("No cookies were set in the scanned response.")).toBeInTheDocument();
  });

  it("renders cookie rows with score badges, attributes, and findings", () => {
    render(<CookieSecurityCard analysis={buildAnalysis()} cookieStatusStyles={cookieStatusStyles} />);

    expect(screen.getByText("1 cookie analyzed: 0 strong, 1 need attention.")).toBeInTheDocument();
    expect(screen.getByText("Grade C")).toBeInTheDocument();
    expect(screen.getByText("1/2")).toBeInTheDocument();
    expect(screen.getByText("session")).toBeInTheDocument();
    expect(screen.getByText("weak")).toHaveClass("text-amber-200");
    expect(screen.getByText(/HttpOnly:/)).toHaveTextContent("HttpOnly: Yes · Secure: No · SameSite: Lax");
    expect(screen.getByText(/Path:/)).toHaveTextContent("Path: / · Domain: (host-only)");
    expect(screen.getByText(/Findings:/)).toHaveTextContent("Findings: Missing Secure");
  });

  it("hides findings text for cookies without findings", () => {
    const cookieWithoutFindings = buildCookie({
      name: "prefs",
      status: "good",
      secure: true,
      findings: [],
      grade: "A"
    });

    render(
      <CookieSecurityCard
        analysis={buildAnalysis({
          cookies: [cookieWithoutFindings],
          cookieCount: 1,
          score: 2,
          maxScore: 2,
          grade: "A",
          summary: "1 cookie analyzed: 1 strong, 0 need attention."
        })}
        cookieStatusStyles={cookieStatusStyles}
      />
    );

    expect(screen.getByText("prefs")).toBeInTheDocument();
    expect(screen.queryByText(/Findings:/)).not.toBeInTheDocument();
  });

  it("handles inconsistent data where cookieCount is positive but cookies are empty", () => {
    const { container } = render(
      <CookieSecurityCard
        analysis={buildAnalysis({
          cookies: [],
          cookieCount: 2,
          score: 0,
          maxScore: 4,
          grade: "F",
          summary: "2 cookies analyzed: 0 strong, 2 need attention."
        })}
        cookieStatusStyles={cookieStatusStyles}
      />
    );

    expect(screen.getByText("2 cookies analyzed: 0 strong, 2 need attention.")).toBeInTheDocument();
    expect(container.querySelectorAll("li")).toHaveLength(0);
    expect(screen.queryByText("No cookies were set in the scanned response.")).not.toBeInTheDocument();
  });
});

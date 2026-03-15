import type { CookieSecurityAnalysis } from "@/lib/cookieSecurity";
import type { HeaderResult } from "@/lib/securityHeaders";

type CookieSecurityCardProps = {
  analysis?: CookieSecurityAnalysis;
  cookieStatusStyles: Record<HeaderResult["status"], string>;
};

export function CookieSecurityCard({ analysis, cookieStatusStyles }: CookieSecurityCardProps) {
  return (
    <details className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4" open>
      <summary className="cursor-pointer list-none">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-[0.12em] text-slate-200">Cookie security analysis</h3>
            <p className="mt-1 text-sm text-slate-400">
              {analysis?.summary ?? "No Set-Cookie headers were returned by this response."}
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs uppercase tracking-[0.1em]">
            <span className="rounded-full border border-slate-700 bg-slate-950/80 px-2.5 py-1 text-slate-300">
              Grade {analysis?.grade ?? "N/A"}
            </span>
            <span className="rounded-full border border-slate-700 bg-slate-950/80 px-2.5 py-1 text-slate-300">
              {analysis ? `${analysis.score}/${analysis.maxScore || 0}` : "0/0"}
            </span>
          </div>
        </div>
      </summary>

      {analysis && analysis.cookieCount > 0 ? (
        <ul className="mt-4 grid gap-3 sm:grid-cols-2">
          {analysis.cookies.map((cookie) => (
            <li key={`${cookie.name}-${cookie.raw}`} className="rounded-xl border border-slate-800 bg-slate-950/70 p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="break-all text-sm font-semibold text-slate-100">{cookie.name}</p>
                <span
                  className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase ${
                    cookieStatusStyles[cookie.status]
                  }`}
                >
                  {cookie.status}
                </span>
              </div>
              <p className="mt-2 text-xs text-slate-400">
                HttpOnly: <span className="text-slate-200">{cookie.httpOnly ? "Yes" : "No"}</span> · Secure:{" "}
                <span className="text-slate-200">{cookie.secure ? "Yes" : "No"}</span> · SameSite:{" "}
                <span className="text-slate-200">{cookie.sameSite}</span>
              </p>
              <p className="mt-1 text-xs text-slate-400">
                Path: <span className="text-slate-200">{cookie.path ?? "(default)"}</span> · Domain:{" "}
                <span className="text-slate-200">{cookie.domain ?? "(host-only)"}</span>
              </p>
              {cookie.findings.length > 0 && (
                <p className="mt-2 text-xs text-slate-400">
                  Findings: <span className="text-slate-200">{cookie.findings.join(", ")}</span>
                </p>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-slate-400">No cookies were set in the scanned response.</p>
      )}
    </details>
  );
}

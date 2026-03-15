import type { CorsAnalysis, CorsFindingSeverity } from "@/lib/corsAnalysis";

type CorsCardProps = {
  analysis?: CorsAnalysis;
};

type StatusTone = "good" | "warn" | "bad";

const toneStyles: Record<StatusTone, string> = {
  good: "border-emerald-500/35 bg-emerald-500/15 text-emerald-200",
  warn: "border-amber-500/35 bg-amber-500/15 text-amber-200",
  bad: "border-rose-500/35 bg-rose-500/15 text-rose-200"
};

const findingStyles: Record<CorsFindingSeverity, string> = {
  low: "border-emerald-500/35 bg-emerald-500/15 text-emerald-100",
  medium: "border-amber-500/35 bg-amber-500/15 text-amber-100",
  high: "border-orange-500/35 bg-orange-500/15 text-orange-100",
  critical: "border-rose-500/35 bg-rose-500/15 text-rose-100"
};

function highestSeverity(analysis: CorsAnalysis): CorsFindingSeverity | "none" {
  if (analysis.findings.some((finding) => finding.severity === "critical")) return "critical";
  if (analysis.findings.some((finding) => finding.severity === "high")) return "high";
  if (analysis.findings.some((finding) => finding.severity === "medium")) return "medium";
  if (analysis.findings.some((finding) => finding.severity === "low")) return "low";
  return "none";
}

function originTone(analysis: CorsAnalysis): StatusTone {
  if (analysis.allowsAnyOrigin && analysis.allowsCredentials) return "bad";
  if (analysis.allowsAnyOrigin || analysis.isOverlyPermissive) return "warn";
  return "good";
}

function credentialsTone(analysis: CorsAnalysis): StatusTone {
  if (analysis.allowsAnyOrigin && analysis.allowsCredentials) return "bad";
  if (analysis.allowsCredentials) return "warn";
  return "good";
}

function exposedHeadersTone(exposedHeaders: string | null): StatusTone {
  if (!exposedHeaders) return "good";
  if (exposedHeaders === "*") return "warn";
  return "good";
}

function preflightTone(hasPreflightConfig: boolean): StatusTone {
  return hasPreflightConfig ? "good" : "warn";
}

function StatusChip({
  title,
  value,
  detail,
  tone
}: {
  title: string;
  value: string;
  detail: string;
  tone: StatusTone;
}) {
  return (
    <div className={`rounded-lg border px-3 py-2 text-xs ${toneStyles[tone]}`}>
      <p className="font-semibold uppercase tracking-[0.12em]">{title}</p>
      <p className="mt-1 text-sm text-slate-100">{value}</p>
      <p className="mt-1 text-xs text-slate-200/90">{detail}</p>
    </div>
  );
}

export function CorsCard({ analysis }: CorsCardProps) {
  const risk = analysis ? highestSeverity(analysis) : "none";
  const exposeHeaders = analysis?.allowExposeHeaders ?? null;
  const maxAge = analysis?.maxAge ?? null;
  const hasPreflightConfig =
    analysis?.hasPreflightConfiguration ?? Boolean(analysis?.allowMethods || analysis?.allowHeaders || maxAge);

  return (
    <details className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4" open>
      <summary className="cursor-pointer list-none">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-[0.12em] text-slate-200">CORS analysis</h3>
            <p className="mt-1 text-sm text-slate-400">
              {analysis?.summary ?? "No CORS analysis is available for this report snapshot."}
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs uppercase tracking-[0.1em]">
            <span
              className={`rounded-full border px-2.5 py-1 ${
                risk === "critical"
                  ? "border-rose-500/35 bg-rose-500/15 text-rose-200"
                  : risk === "high"
                    ? "border-orange-500/35 bg-orange-500/15 text-orange-200"
                    : risk === "medium"
                      ? "border-amber-500/35 bg-amber-500/15 text-amber-200"
                      : "border-emerald-500/35 bg-emerald-500/15 text-emerald-200"
              }`}
            >
              Risk {risk === "none" ? "low" : risk}
            </span>
            <span className="rounded-full border border-slate-700 bg-slate-950/80 px-2.5 py-1 text-slate-300">
              Grade {analysis?.grade ?? "N/A"}
            </span>
            <span className="rounded-full border border-slate-700 bg-slate-950/80 px-2.5 py-1 text-slate-300">
              {analysis ? `${analysis.score}/${analysis.maxScore}` : "0/0"}
            </span>
          </div>
        </div>
      </summary>

      {analysis ? (
        <div className="mt-4 space-y-4">
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <StatusChip
              title="Allow-Origin"
              value={analysis.allowOrigin ?? "Not returned"}
              detail={
                analysis.allowsAnyOrigin
                  ? "Any origin is allowed."
                  : "Cross-origin access is origin-restricted or not enabled."
              }
              tone={originTone(analysis)}
            />
            <StatusChip
              title="Credentials"
              value={analysis.allowsCredentials ? "Allowed" : "Not allowed"}
              detail={
                analysis.allowsCredentials
                  ? "Credentialed cross-origin requests are permitted."
                  : "Cookies/auth headers are not allowed across origins."
              }
              tone={credentialsTone(analysis)}
            />
            <StatusChip
              title="Exposed headers"
              value={exposeHeaders ?? "Not returned"}
              detail={exposeHeaders ? "Headers available to browser JavaScript." : "No explicit exposed headers were returned."}
              tone={exposedHeadersTone(exposeHeaders)}
            />
            <StatusChip
              title="Preflight config"
              value={hasPreflightConfig ? "Configured" : "Not configured"}
              detail={
                hasPreflightConfig
                  ? `Methods: ${analysis.allowMethods ?? "not set"} | Headers: ${analysis.allowHeaders ?? "not set"}`
                  : "No Access-Control-Allow-Methods/Headers/Max-Age values detected."
              }
              tone={preflightTone(hasPreflightConfig)}
            />
          </div>

          <dl className="grid gap-2 text-xs text-slate-400 sm:grid-cols-2">
            <div className="rounded-lg border border-slate-800 bg-slate-950/70 px-3 py-2">
              <dt className="uppercase tracking-[0.12em] text-slate-500">Allow methods</dt>
              <dd className="mt-1 break-all text-slate-200">{analysis.allowMethods ?? "Missing"}</dd>
            </div>
            <div className="rounded-lg border border-slate-800 bg-slate-950/70 px-3 py-2">
              <dt className="uppercase tracking-[0.12em] text-slate-500">Allow headers</dt>
              <dd className="mt-1 break-all text-slate-200">{analysis.allowHeaders ?? "Missing"}</dd>
            </div>
            <div className="rounded-lg border border-slate-800 bg-slate-950/70 px-3 py-2">
              <dt className="uppercase tracking-[0.12em] text-slate-500">Allow credentials</dt>
              <dd className="mt-1 break-all text-slate-200">{analysis.allowCredentials ?? "Missing"}</dd>
            </div>
            <div className="rounded-lg border border-slate-800 bg-slate-950/70 px-3 py-2">
              <dt className="uppercase tracking-[0.12em] text-slate-500">Preflight max-age</dt>
              <dd className="mt-1 break-all text-slate-200">{maxAge ?? "Not returned"}</dd>
            </div>
          </dl>

          {analysis.findings.length === 0 ? (
            <p className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">
              CORS configuration appears reasonably restrictive for this response.
            </p>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2">
              {analysis.findings.map((finding) => (
                <li key={finding.id} className={`rounded-xl border px-3 py-3 text-sm ${findingStyles[finding.severity]}`}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-semibold text-slate-100">{finding.message}</p>
                    <span className="rounded-full border border-slate-700/60 bg-slate-950/70 px-2 py-0.5 text-[11px] uppercase tracking-[0.12em] text-slate-200">
                      {finding.severity}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-slate-200/90">
                    <span className="text-slate-300">Header:</span> {finding.header}
                  </p>
                  <p className="mt-1 text-xs text-slate-200/90">
                    <span className="text-slate-300">Recommendation:</span> {finding.recommendation}
                  </p>
                </li>
              ))}
            </ul>
          )}

          <div className="rounded-xl border border-sky-500/30 bg-sky-500/10 p-3 text-xs text-sky-100">
            <p className="font-semibold uppercase tracking-[0.12em] text-sky-200">Security implications</p>
            {analysis.findings.length === 0 ? (
              <p className="mt-2">No broad cross-origin exposure patterns were detected in the observed response.</p>
            ) : (
              <ul className="mt-2 space-y-1">
                {analysis.findings.slice(0, 4).map((finding) => (
                  <li key={`implication-${finding.id}`}>- {finding.message}</li>
                ))}
              </ul>
            )}
          </div>
        </div>
      ) : (
        <p className="mt-3 text-sm text-slate-400">This report does not include CORS analysis details.</p>
      )}
    </details>
  );
}

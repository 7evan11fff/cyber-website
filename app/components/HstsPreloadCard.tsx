import type { HstsPreloadAnalysis } from "@/lib/hstsPreloadAnalysis";

type HstsPreloadCardProps = {
  analysis?: HstsPreloadAnalysis;
};

function statusBadgeClass(status: HstsPreloadAnalysis["status"]) {
  if (status === "preloaded") {
    return "border-emerald-500/35 bg-emerald-500/15 text-emerald-200";
  }
  if (status === "pending") {
    return "border-cyan-500/35 bg-cyan-500/15 text-cyan-200";
  }
  return "border-amber-500/35 bg-amber-500/15 text-amber-200";
}

function statusLabel(status: HstsPreloadAnalysis["status"]) {
  if (status === "preloaded") return "Preloaded";
  if (status === "pending") return "Pending";
  return "Not Preloaded";
}

export function HstsPreloadCard({ analysis }: HstsPreloadCardProps) {
  return (
    <details className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4" open>
      <summary className="cursor-pointer list-none">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-[0.12em] text-slate-200">HSTS preload analysis</h3>
            <p className="mt-1 text-sm text-slate-400">
              {analysis?.summary ?? "No HSTS preload analysis is available for this report snapshot."}
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs uppercase tracking-[0.1em]">
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
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.1em] ${statusBadgeClass(analysis.status)}`}>
              {statusLabel(analysis.status)}
            </span>
            <span className="rounded-full border border-slate-700 bg-slate-950/80 px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.1em] text-slate-300">
              API status {analysis.apiStatus ?? "unknown"}
            </span>
            <span className="rounded-full border border-slate-700 bg-slate-950/80 px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.1em] text-slate-300">
              Eligibility {analysis.eligibility}
            </span>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">Header requirement checklist</p>
            <ul className="mt-2 space-y-2 text-xs">
              {analysis.requirements.map((requirement) => (
                <li
                  key={requirement.id}
                  className={`rounded-md border px-2.5 py-2 ${
                    requirement.passed
                      ? "border-emerald-500/35 bg-emerald-500/10 text-emerald-100"
                      : "border-amber-500/35 bg-amber-500/10 text-amber-100"
                  }`}
                >
                  <p className="font-semibold">
                    {requirement.passed ? "PASS" : "FAIL"} · {requirement.label}
                  </p>
                  <p className="mt-1 opacity-90">{requirement.details}</p>
                </li>
              ))}
            </ul>
          </div>

          {analysis.findings.length > 0 ? (
            <ul className="space-y-2">
              {analysis.findings.map((finding) => (
                <li
                  key={finding.id}
                  className={`rounded-xl border px-3 py-3 text-xs ${
                    finding.severity === "warning"
                      ? "border-amber-500/35 bg-amber-500/10 text-amber-100"
                      : "border-cyan-500/35 bg-cyan-500/10 text-cyan-100"
                  }`}
                >
                  <p className="font-semibold">{finding.message}</p>
                  <p className="mt-1 opacity-90">Recommendation: {finding.recommendation}</p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">
              No HSTS preload findings were detected.
            </p>
          )}

          <div className="rounded-xl border border-cyan-500/30 bg-cyan-500/10 p-3 text-xs text-cyan-100">
            <p className="font-semibold uppercase tracking-[0.12em] text-cyan-200">Submit to preload list</p>
            <p className="mt-2">
              Submit and verify your domain at{" "}
              <a
                href={analysis.submissionUrl}
                target="_blank"
                rel="noreferrer"
                className="font-semibold text-cyan-200 underline decoration-cyan-400/70 underline-offset-2 transition hover:text-cyan-100"
              >
                hstspreload.org
              </a>
              .
            </p>
            {analysis.recommendations.length > 0 && (
              <ul className="mt-2 space-y-1">
                {analysis.recommendations.map((recommendation) => (
                  <li key={recommendation}>• {recommendation}</li>
                ))}
              </ul>
            )}
          </div>
        </div>
      ) : (
        <p className="mt-3 text-sm text-slate-400">This report does not include HSTS preload analysis details.</p>
      )}
    </details>
  );
}

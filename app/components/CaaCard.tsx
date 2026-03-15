import type { CaaAnalysis } from "@/lib/caaAnalysis";

type CaaCardProps = {
  analysis?: CaaAnalysis;
};

function StatusBadge({ label, ok }: { label: string; ok: boolean }) {
  return (
    <span
      className={`rounded-full border px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.1em] ${
        ok ? "border-emerald-500/35 bg-emerald-500/15 text-emerald-200" : "border-amber-500/35 bg-amber-500/15 text-amber-200"
      }`}
    >
      {label}
    </span>
  );
}

export function CaaCard({ analysis }: CaaCardProps) {
  return (
    <details className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4" open>
      <summary className="cursor-pointer list-none">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-[0.12em] text-slate-200">CAA analysis</h3>
            <p className="mt-1 text-sm text-slate-400">
              {analysis?.summary ?? "No CAA analysis is available for this report snapshot."}
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
          <div className="flex flex-wrap gap-2">
            <StatusBadge label={analysis.hasRecords ? "CAA present" : "CAA missing"} ok={analysis.hasRecords} />
            <StatusBadge
              label={analysis.restrictsIssuance ? "Issuance restricted" : "Issuance unrestricted"}
              ok={analysis.restrictsIssuance}
            />
            <StatusBadge
              label={analysis.specificCaOnly ? "Specific CAs only" : "Policy can be tightened"}
              ok={analysis.specificCaOnly}
            />
          </div>

          <dl className="grid gap-2 text-xs text-slate-400 sm:grid-cols-2">
            <div className="rounded-lg border border-slate-800 bg-slate-950/70 px-3 py-2">
              <dt className="uppercase tracking-[0.12em] text-slate-500">Allowed certificate authorities</dt>
              <dd className="mt-1 space-y-1 text-slate-200">
                {analysis.allowedCertificateAuthorities.length > 0 ? (
                  analysis.allowedCertificateAuthorities.map((authority) => (
                    <p key={authority} className="break-all text-xs">
                      {authority}
                    </p>
                  ))
                ) : (
                  <p className="text-xs text-slate-400">No explicit CA allowlist detected.</p>
                )}
              </dd>
            </div>
            <div className="rounded-lg border border-slate-800 bg-slate-950/70 px-3 py-2">
              <dt className="uppercase tracking-[0.12em] text-slate-500">CAA directives</dt>
              <dd className="mt-1 space-y-1 text-slate-200">
                {analysis.directives.length > 0 ? (
                  analysis.directives.slice(0, 5).map((directive, index) => (
                    <p key={`${directive.tag}-${directive.value}-${index}`} className="break-all text-xs">
                      <span className="font-semibold">{directive.tag}</span>: {directive.value} — {directive.meaning}
                    </p>
                  ))
                ) : (
                  <p className="text-xs text-slate-400">No CAA directives were parsed.</p>
                )}
              </dd>
            </div>
          </dl>

          {analysis.findings.length > 0 ? (
            <ul className="grid gap-3 sm:grid-cols-2">
              {analysis.findings.map((finding) => (
                <li
                  key={finding.id}
                  className={`rounded-xl border px-3 py-3 text-sm ${
                    finding.severity === "high"
                      ? "border-rose-500/35 bg-rose-500/15 text-rose-100"
                      : finding.severity === "medium"
                        ? "border-amber-500/35 bg-amber-500/15 text-amber-100"
                        : "border-slate-700 bg-slate-950/80 text-slate-200"
                  }`}
                >
                  <p className="font-semibold">{finding.message}</p>
                  <p className="mt-1 text-xs opacity-90">Recommendation: {finding.recommendation}</p>
                  {finding.evidence ? <p className="mt-1 break-all text-xs opacity-85">Evidence: {finding.evidence}</p> : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">
              No risky CAA findings were detected.
            </p>
          )}
        </div>
      ) : (
        <p className="mt-3 text-sm text-slate-400">This report does not include CAA analysis details.</p>
      )}
    </details>
  );
}

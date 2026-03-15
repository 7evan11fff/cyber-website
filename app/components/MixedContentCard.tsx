import type { MixedContentAnalysis } from "@/lib/mixedContentAnalysis";

type MixedContentCardProps = {
  analysis?: MixedContentAnalysis;
};

function badgeTone(tone: "critical" | "warning" | "good"): string {
  if (tone === "critical") return "border-rose-500/40 bg-rose-500/20 text-rose-100";
  if (tone === "warning") return "border-amber-500/35 bg-amber-500/15 text-amber-100";
  return "border-emerald-500/35 bg-emerald-500/15 text-emerald-200";
}

export function MixedContentCard({ analysis }: MixedContentCardProps) {
  const activeFindings = analysis?.findings.filter((finding) => finding.category === "active") ?? [];
  const passiveFindings = analysis?.findings.filter((finding) => finding.category === "passive") ?? [];

  return (
    <details className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4" open>
      <summary className="cursor-pointer list-none">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-[0.12em] text-slate-200">Mixed content analysis</h3>
            <p className="mt-1 text-sm text-slate-400">
              {analysis?.summary ?? "No mixed-content analysis is available for this report snapshot."}
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
          {analysis.available && analysis.isHttpsPage ? (
            <>
              <dl className="grid gap-2 text-xs text-slate-400 sm:grid-cols-3">
                <div className="rounded-lg border border-slate-800 bg-slate-950/70 px-3 py-2">
                  <dt className="uppercase tracking-[0.12em] text-slate-500">Total findings</dt>
                  <dd className="mt-1 text-slate-200">{analysis.totalMixedContentCount}</dd>
                </div>
                <div className="rounded-lg border border-slate-800 bg-slate-950/70 px-3 py-2">
                  <dt className="uppercase tracking-[0.12em] text-slate-500">Active (critical)</dt>
                  <dd className="mt-1 text-slate-200">{analysis.activeCount}</dd>
                </div>
                <div className="rounded-lg border border-slate-800 bg-slate-950/70 px-3 py-2">
                  <dt className="uppercase tracking-[0.12em] text-slate-500">Passive (warning)</dt>
                  <dd className="mt-1 text-slate-200">{analysis.passiveCount}</dd>
                </div>
              </dl>

              {analysis.findings.length === 0 ? (
                <p className={`rounded-xl border px-3 py-2 text-sm ${badgeTone("good")}`}>
                  No mixed-content references were detected.
                </p>
              ) : (
                <>
                  {activeFindings.length > 0 ? (
                    <section className="space-y-2">
                      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-rose-200">
                        Active mixed content (critical)
                      </p>
                      <ul className="grid gap-3 sm:grid-cols-2">
                        {activeFindings.map((finding) => (
                          <li key={finding.id} className={`rounded-xl border px-3 py-3 text-sm ${badgeTone("critical")}`}>
                            <p className="font-semibold text-slate-100">{finding.message}</p>
                            <p className="mt-1 break-all text-xs">
                              <span className="text-slate-300">Element:</span> {finding.element} ({finding.attribute})
                            </p>
                            <p className="mt-1 break-all text-xs">
                              <span className="text-slate-300">URL:</span> {finding.url}
                            </p>
                          </li>
                        ))}
                      </ul>
                    </section>
                  ) : null}

                  {passiveFindings.length > 0 ? (
                    <section className="space-y-2">
                      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-amber-200">
                        Passive mixed content (warning)
                      </p>
                      <ul className="grid gap-3 sm:grid-cols-2">
                        {passiveFindings.map((finding) => (
                          <li key={finding.id} className={`rounded-xl border px-3 py-3 text-sm ${badgeTone("warning")}`}>
                            <p className="font-semibold text-slate-100">{finding.message}</p>
                            <p className="mt-1 break-all text-xs">
                              <span className="text-slate-300">Element:</span> {finding.element} ({finding.attribute})
                            </p>
                            <p className="mt-1 break-all text-xs">
                              <span className="text-slate-300">URL:</span> {finding.url}
                            </p>
                          </li>
                        ))}
                      </ul>
                    </section>
                  ) : null}
                </>
              )}
            </>
          ) : (
            <p className="rounded-xl border border-slate-700 bg-slate-950/80 px-3 py-2 text-sm text-slate-300">
              Mixed-content checks run only for HTTPS HTML pages.
            </p>
          )}

          {analysis.recommendations.length > 0 ? (
            <div className="rounded-xl border border-sky-500/30 bg-sky-500/10 p-3 text-xs text-sky-100">
              <p className="font-semibold uppercase tracking-[0.12em] text-sky-200">Fix guidance</p>
              <ul className="mt-2 space-y-1">
                {analysis.recommendations.map((recommendation) => (
                  <li key={recommendation}>• {recommendation}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : (
        <p className="mt-3 text-sm text-slate-400">This report does not include mixed-content analysis details.</p>
      )}
    </details>
  );
}

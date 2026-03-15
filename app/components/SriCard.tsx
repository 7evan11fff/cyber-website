import type { SriAnalysis, SriFindingSeverity, SriResourceType } from "@/lib/sriAnalysis";

type SriCardProps = {
  analysis?: SriAnalysis;
};

const findingStyles: Record<SriFindingSeverity, string> = {
  low: "border-emerald-500/35 bg-emerald-500/15 text-emerald-100",
  medium: "border-amber-500/35 bg-amber-500/15 text-amber-100",
  high: "border-orange-500/35 bg-orange-500/15 text-orange-100",
  critical: "border-rose-500/35 bg-rose-500/15 text-rose-100"
};

const riskStyles: Record<SriFindingSeverity | "none", string> = {
  none: "border-emerald-500/35 bg-emerald-500/15 text-emerald-200",
  low: "border-cyan-500/35 bg-cyan-500/15 text-cyan-200",
  medium: "border-amber-500/35 bg-amber-500/15 text-amber-200",
  high: "border-orange-500/35 bg-orange-500/15 text-orange-200",
  critical: "border-rose-500/35 bg-rose-500/15 text-rose-200"
};

function highestSeverity(analysis: SriAnalysis): SriFindingSeverity | "none" {
  if (analysis.findings.some((finding) => finding.severity === "critical")) return "critical";
  if (analysis.findings.some((finding) => finding.severity === "high")) return "high";
  if (analysis.findings.some((finding) => finding.severity === "medium")) return "medium";
  if (analysis.findings.some((finding) => finding.severity === "low")) return "low";
  return "none";
}

function countByType(resources: SriAnalysis["resources"], resourceType: SriResourceType) {
  const all = resources.filter((resource) => resource.resourceType === resourceType);
  const withSri = all.filter((resource) => resource.hasIntegrity).length;
  return {
    total: all.length,
    withSri,
    withoutSri: all.length - withSri
  };
}

export function SriCard({ analysis }: SriCardProps) {
  const scriptStats = analysis ? countByType(analysis.resources, "script") : null;
  const stylesheetStats = analysis ? countByType(analysis.resources, "stylesheet") : null;
  const needsSri = analysis?.resources.filter((resource) => !resource.hasIntegrity) ?? [];
  const risk = analysis ? highestSeverity(analysis) : "none";
  const unprotectedCount = analysis ? analysis.externalResourceCount - analysis.protectedResourceCount : 0;

  return (
    <details className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4" open>
      <summary className="cursor-pointer list-none">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-[0.12em] text-slate-200">
              Subresource integrity (SRI) analysis
            </h3>
            <p className="mt-1 text-sm text-slate-400">
              {analysis?.summary ?? "No SRI analysis is available for this report snapshot."}
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs uppercase tracking-[0.1em]">
            <span className={`rounded-full border px-2.5 py-1 ${riskStyles[risk]}`}>
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
          <dl className="grid gap-2 text-xs text-slate-400 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-lg border border-slate-800 bg-slate-950/70 px-3 py-2">
              <dt className="uppercase tracking-[0.12em] text-slate-500">Protected resources</dt>
              <dd className="mt-1 break-all text-slate-200">
                {analysis.protectedResourceCount}/{analysis.externalResourceCount}
              </dd>
            </div>
            <div className="rounded-lg border border-slate-800 bg-slate-950/70 px-3 py-2">
              <dt className="uppercase tracking-[0.12em] text-slate-500">Unprotected resources</dt>
              <dd className="mt-1 break-all text-slate-200">{unprotectedCount}</dd>
            </div>
            <div className="rounded-lg border border-slate-800 bg-slate-950/70 px-3 py-2">
              <dt className="uppercase tracking-[0.12em] text-slate-500">Coverage</dt>
              <dd className="mt-1 break-all text-slate-200">{analysis.coveragePercent}%</dd>
            </div>
            <div className="rounded-lg border border-slate-800 bg-slate-950/70 px-3 py-2">
              <dt className="uppercase tracking-[0.12em] text-slate-500">Crossorigin coverage</dt>
              <dd className="mt-1 break-all text-slate-200">{analysis.crossoriginCoveragePercent}%</dd>
            </div>
          </dl>

          <div className="grid gap-2 sm:grid-cols-2">
            <div className="rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-3 text-xs text-slate-300">
              <p className="font-semibold uppercase tracking-[0.12em] text-slate-400">Scripts</p>
              <p className="mt-1 text-sm text-slate-100">
                {scriptStats?.withSri ?? 0}/{scriptStats?.total ?? 0} with SRI
              </p>
              <p className="mt-1 text-slate-400">{scriptStats?.withoutSri ?? 0} script resources need SRI.</p>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-3 text-xs text-slate-300">
              <p className="font-semibold uppercase tracking-[0.12em] text-slate-400">Stylesheets</p>
              <p className="mt-1 text-sm text-slate-100">
                {stylesheetStats?.withSri ?? 0}/{stylesheetStats?.total ?? 0} with SRI
              </p>
              <p className="mt-1 text-slate-400">{stylesheetStats?.withoutSri ?? 0} stylesheet resources need SRI.</p>
            </div>
          </div>

          {needsSri.length > 0 ? (
            <div className="rounded-xl border border-amber-500/35 bg-amber-500/10 p-3">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-amber-200">Resources missing SRI</p>
              <ul className="mt-2 space-y-2 text-xs text-amber-100">
                {needsSri.map((resource) => (
                  <li key={`needs-sri-${resource.id}`} className="rounded-md border border-amber-500/30 bg-slate-950/40 px-2.5 py-2">
                    <p className="break-all font-semibold text-slate-100">{resource.url}</p>
                    <p className="mt-1 text-slate-300">
                      Type: {resource.resourceType} | CDN: {resource.isCdn ? "Yes" : "No"}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">
              All external scripts and stylesheets are protected with SRI.
            </p>
          )}

          {analysis.findings.length > 0 ? (
            <ul className="grid gap-3 sm:grid-cols-2">
              {analysis.findings.map((finding) => (
                <li key={finding.id} className={`rounded-xl border px-3 py-3 text-sm ${findingStyles[finding.severity]}`}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-semibold text-slate-100">{finding.message}</p>
                    <span className="rounded-full border border-slate-700/60 bg-slate-950/70 px-2 py-0.5 text-[11px] uppercase tracking-[0.12em] text-slate-200">
                      {finding.severity}
                    </span>
                  </div>
                  <p className="mt-1 break-all text-xs text-slate-200/90">
                    <span className="text-slate-300">Resource:</span> {finding.resourceUrl}
                  </p>
                  <p className="mt-1 text-xs text-slate-200/90">
                    <span className="text-slate-300">Recommendation:</span> {finding.recommendation}
                  </p>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : (
        <p className="mt-3 text-sm text-slate-400">This report does not include SRI analysis details.</p>
      )}
    </details>
  );
}

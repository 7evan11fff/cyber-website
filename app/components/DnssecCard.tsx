import type { DnssecAnalysis } from "@/lib/dnssecAnalysis";

type DnssecCardProps = {
  analysis?: DnssecAnalysis;
};

type StatusTone = "good" | "warn" | "bad";

const toneStyles: Record<StatusTone, string> = {
  good: "border-emerald-500/35 bg-emerald-500/15 text-emerald-200",
  warn: "border-amber-500/35 bg-amber-500/15 text-amber-200",
  bad: "border-rose-500/35 bg-rose-500/15 text-rose-200"
};

function statusTone(status: DnssecAnalysis["status"]): StatusTone {
  if (status === "enabled") return "good";
  if (status === "partial") return "warn";
  return "bad";
}

function statusLabel(status: DnssecAnalysis["status"]): string {
  if (status === "enabled") return "Enabled";
  if (status === "partial") return "Partial";
  return "Disabled";
}

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

export function DnssecCard({ analysis }: DnssecCardProps) {
  return (
    <details className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4" open>
      <summary className="cursor-pointer list-none">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-[0.12em] text-slate-200">DNSSEC analysis</h3>
            <p className="mt-1 text-sm text-slate-400">
              {analysis?.summary ?? "No DNSSEC analysis is available for this report snapshot."}
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
          <div className={`rounded-xl border px-3 py-3 text-sm ${toneStyles[statusTone(analysis.status)]}`}>
            <p className="font-semibold uppercase tracking-[0.12em]">Status: {statusLabel(analysis.status)}</p>
            <p className="mt-1 text-xs">
              DNSKEY records: {analysis.dnskeyRecordCount} · DS records: {analysis.dsRecordCount}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <StatusBadge label={analysis.zoneSigned ? "Zone signed" : "Zone unsigned"} ok={analysis.zoneSigned} />
            <StatusBadge label={analysis.parentHasDs ? "Parent DS present" : "Parent DS missing"} ok={analysis.parentHasDs} />
            <StatusBadge label={analysis.chainValid ? "Chain valid" : "Chain incomplete"} ok={analysis.chainValid} />
          </div>

          <dl className="grid gap-2 text-xs text-slate-400 sm:grid-cols-2">
            <div className="rounded-lg border border-slate-800 bg-slate-950/70 px-3 py-2">
              <dt className="uppercase tracking-[0.12em] text-slate-500">DNSKEY details</dt>
              <dd className="mt-1 space-y-1 text-slate-200">
                {analysis.dnskeyRecords.length > 0 ? (
                  analysis.dnskeyRecords.slice(0, 3).map((record) => (
                    <p key={`dnskey-${record}`} className="break-all text-xs">
                      {record}
                    </p>
                  ))
                ) : (
                  <p className="text-xs text-slate-400">No DNSKEY records observed.</p>
                )}
              </dd>
            </div>
            <div className="rounded-lg border border-slate-800 bg-slate-950/70 px-3 py-2">
              <dt className="uppercase tracking-[0.12em] text-slate-500">DS details</dt>
              <dd className="mt-1 space-y-1 text-slate-200">
                {analysis.dsRecords.length > 0 ? (
                  analysis.dsRecords.slice(0, 3).map((record) => (
                    <p key={`ds-${record}`} className="break-all text-xs">
                      {record}
                    </p>
                  ))
                ) : (
                  <p className="text-xs text-slate-400">No DS records observed.</p>
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
              No risky DNSSEC findings were detected.
            </p>
          )}
        </div>
      ) : (
        <p className="mt-3 text-sm text-slate-400">This report does not include DNSSEC analysis details.</p>
      )}
    </details>
  );
}

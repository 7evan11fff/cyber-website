import type { SecurityTxtAnalysis } from "@/lib/securityTxtAnalysis";

type SecurityTxtCardProps = {
  analysis?: SecurityTxtAnalysis;
};

function Badge({ label, ok }: { label: string; ok: boolean }) {
  return (
    <span
      className={`rounded-full border px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.1em] ${
        ok
          ? "border-emerald-500/35 bg-emerald-500/15 text-emerald-200"
          : "border-amber-500/35 bg-amber-500/15 text-amber-200"
      }`}
    >
      {label}
    </span>
  );
}

function FieldList({ label, values }: { label: string; values: string[] }) {
  if (values.length === 0) return null;
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-950/70 px-3 py-2">
      <dt className="uppercase tracking-[0.12em] text-slate-500">{label}</dt>
      <dd className="mt-1 space-y-1 text-slate-200">
        {values.map((value) => (
          <p key={`${label}-${value}`} className="break-all text-xs">
            {value}
          </p>
        ))}
      </dd>
    </div>
  );
}

export function SecurityTxtCard({ analysis }: SecurityTxtCardProps) {
  return (
    <details className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4" open>
      <summary className="cursor-pointer list-none">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-[0.12em] text-slate-200">security.txt analysis</h3>
            <p className="mt-1 text-sm text-slate-400">
              {analysis?.summary ?? "No security.txt analysis is available for this report snapshot."}
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
            <Badge label={analysis.validation.present ? "Present" : "Missing"} ok={analysis.validation.present} />
            <Badge label={analysis.validation.usesHttps ? "HTTPS source" : "HTTP source"} ok={analysis.validation.usesHttps} />
            <Badge label={analysis.validation.isValid ? "Valid" : "Needs attention"} ok={analysis.validation.isValid} />
          </div>

          <dl className="grid gap-2 text-xs text-slate-400 sm:grid-cols-2 lg:grid-cols-3">
            {analysis.fetchedUrl ? (
              <div className="rounded-lg border border-slate-800 bg-slate-950/70 px-3 py-2 sm:col-span-2 lg:col-span-3">
                <dt className="uppercase tracking-[0.12em] text-slate-500">Fetched URL</dt>
                <dd className="mt-1 break-all text-slate-200">{analysis.fetchedUrl}</dd>
              </div>
            ) : null}
            {analysis.fields.expires && (
              <div className="rounded-lg border border-slate-800 bg-slate-950/70 px-3 py-2">
                <dt className="uppercase tracking-[0.12em] text-slate-500">Expires</dt>
                <dd className="mt-1 break-all text-slate-200">{analysis.fields.expires}</dd>
              </div>
            )}
            <FieldList label="Contact" values={analysis.fields.contact} />
            <FieldList label="Encryption" values={analysis.fields.encryption} />
            <FieldList label="Acknowledgments" values={analysis.fields.acknowledgments} />
            <FieldList label="Preferred-Languages" values={analysis.fields.preferredLanguages} />
            <FieldList label="Canonical" values={analysis.fields.canonical} />
            <FieldList label="Policy" values={analysis.fields.policy} />
            <FieldList label="Hiring" values={analysis.fields.hiring} />
          </dl>

          {analysis.warnings.length > 0 ? (
            <ul className="space-y-2 rounded-xl border border-amber-500/35 bg-amber-500/10 p-3 text-xs text-amber-100">
              {analysis.warnings.map((warning) => (
                <li key={warning}>• {warning}</li>
              ))}
            </ul>
          ) : (
            <p className="rounded-xl border border-emerald-500/35 bg-emerald-500/10 p-3 text-xs text-emerald-200">
              No security.txt validation warnings were detected.
            </p>
          )}

          {analysis.recommendations.length > 0 && (
            <div className="rounded-xl border border-sky-500/30 bg-sky-500/10 p-3 text-xs text-sky-100">
              <p className="font-semibold uppercase tracking-[0.12em] text-sky-200">Recommendations</p>
              <ul className="mt-2 space-y-1">
                {analysis.recommendations.map((recommendation) => (
                  <li key={recommendation}>• {recommendation}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      ) : (
        <p className="mt-3 text-sm text-slate-400">This report does not include security.txt analysis details.</p>
      )}
    </details>
  );
}

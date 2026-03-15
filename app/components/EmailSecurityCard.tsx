import type { EmailSecurityAnalysis } from "@/lib/emailSecurityAnalysis";

type EmailSecurityCardProps = {
  analysis?: EmailSecurityAnalysis;
};

type StatusTone = "good" | "warn" | "bad";

const toneStyles: Record<StatusTone, string> = {
  good: "border-emerald-500/35 bg-emerald-500/15 text-emerald-200",
  warn: "border-amber-500/35 bg-amber-500/15 text-amber-200",
  bad: "border-rose-500/35 bg-rose-500/15 text-rose-200"
};

function StatusIcon({ tone }: { tone: StatusTone }) {
  if (tone === "good") {
    return (
      <svg viewBox="0 0 20 20" aria-hidden="true" className="h-4 w-4 text-emerald-300">
        <path fill="currentColor" d="M10 1.5a8.5 8.5 0 1 0 8.5 8.5A8.51 8.51 0 0 0 10 1.5Zm4.1 6.7-4.6 4.8a1 1 0 0 1-1.4 0L5.9 10.8a1 1 0 1 1 1.4-1.4l1.5 1.5 3.9-4.1a1 1 0 1 1 1.4 1.4Z" />
      </svg>
    );
  }
  if (tone === "warn") {
    return (
      <svg viewBox="0 0 20 20" aria-hidden="true" className="h-4 w-4 text-amber-300">
        <path fill="currentColor" d="M10 2.3a1.8 1.8 0 0 1 1.6.9l6.6 11.4a1.8 1.8 0 0 1-1.6 2.7H3.4a1.8 1.8 0 0 1-1.6-2.7L8.4 3.2A1.8 1.8 0 0 1 10 2.3Zm0 4.5a1 1 0 0 0-1 1v3.3a1 1 0 0 0 2 0V7.8a1 1 0 0 0-1-1Zm0 7.4a1.1 1.1 0 1 0 0 2.2 1.1 1.1 0 0 0 0-2.2Z" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" className="h-4 w-4 text-rose-300">
      <path fill="currentColor" d="M10 1.5a8.5 8.5 0 1 0 8.5 8.5A8.51 8.51 0 0 0 10 1.5Zm3.2 11.7a1 1 0 0 1-1.4 1.4L10 12.8l-1.8 1.8a1 1 0 0 1-1.4-1.4L8.6 11 6.8 9.2a1 1 0 0 1 1.4-1.4L10 9.6l1.8-1.8a1 1 0 1 1 1.4 1.4L11.4 11l1.8 1.8Z" />
    </svg>
  );
}

function spfTone(policy: EmailSecurityAnalysis["spf"]["policy"]): StatusTone {
  if (policy === "hard-fail") return "good";
  if (policy === "soft-fail") return "warn";
  return "bad";
}

function dmarcTone(policy: EmailSecurityAnalysis["dmarc"]["policy"]): StatusTone {
  if (policy === "reject") return "good";
  if (policy === "quarantine") return "warn";
  return "bad";
}

function Label({
  title,
  value,
  tone,
  detail
}: {
  title: string;
  value: string;
  tone: StatusTone;
  detail?: string;
}) {
  return (
    <div className={`rounded-lg border px-3 py-2 text-xs ${toneStyles[tone]}`}>
      <div className="flex items-center gap-2">
        <StatusIcon tone={tone} />
        <p className="font-semibold uppercase tracking-[0.12em]">{title}</p>
      </div>
      <p className="mt-1 break-all text-sm text-slate-100">{value}</p>
      {detail ? <p className="mt-1 break-all text-[11px] text-slate-200/90">{detail}</p> : null}
    </div>
  );
}

function titleCase(input: string): string {
  return input
    .split("-")
    .map((token) => token.charAt(0).toUpperCase() + token.slice(1))
    .join(" ");
}

export function EmailSecurityCard({ analysis }: EmailSecurityCardProps) {
  return (
    <details className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4" open>
      <summary className="cursor-pointer list-none">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-[0.12em] text-slate-200">Email security analysis</h3>
            <p className="mt-1 text-sm text-slate-400">
              {analysis
                ? `SPF ${titleCase(analysis.spf.policy)}, DMARC ${titleCase(analysis.dmarc.policy)}, DKIM ${
                    analysis.dkim.present ? "present" : "not detected"
                  }.`
                : "No email security analysis is available for this report snapshot."}
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs uppercase tracking-[0.1em]">
            <span className="rounded-full border border-slate-700 bg-slate-950/80 px-2.5 py-1 text-slate-300">
              {analysis ? `${analysis.score}/${analysis.maxScore}` : "0/0"}
            </span>
          </div>
        </div>
      </summary>

      {analysis ? (
        <div className="mt-4 space-y-4">
          <div className="grid gap-2 sm:grid-cols-3">
            <Label
              title="SPF"
              value={titleCase(analysis.spf.policy)}
              tone={spfTone(analysis.spf.policy)}
              detail={`DNS lookups: ${analysis.spf.dnsLookupCount}/${analysis.spf.lookupLimit}${
                analysis.spf.tooManyLookups ? " (too many)" : ""
              }`}
            />
            <Label
              title="DMARC"
              value={titleCase(analysis.dmarc.policy)}
              tone={dmarcTone(analysis.dmarc.policy)}
              detail={`rua: ${analysis.dmarc.rua.length || 0} | ruf: ${analysis.dmarc.ruf.length || 0}`}
            />
            <Label
              title="DKIM"
              value={analysis.dkim.present ? "Present" : "Not detected"}
              tone={analysis.dkim.present ? "good" : "bad"}
              detail={`Selectors hit: ${analysis.dkim.presentSelectors.join(", ") || "none"}`}
            />
          </div>

          {analysis.findings.length > 0 ? (
            <ul className="grid gap-3 sm:grid-cols-2">
              {analysis.findings.map((finding) => (
                <li
                  key={`${finding.id}-${finding.message}`}
                  className={`rounded-xl border px-3 py-3 text-sm ${
                    finding.severity === "critical"
                      ? "border-rose-500/40 bg-rose-500/20 text-rose-100"
                      : finding.severity === "high"
                        ? "border-orange-500/35 bg-orange-500/15 text-orange-100"
                        : finding.severity === "medium"
                          ? "border-amber-500/35 bg-amber-500/15 text-amber-100"
                          : "border-slate-700 bg-slate-950/80 text-slate-200"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-semibold">{finding.message}</p>
                    <span className="rounded-full border border-slate-700/60 bg-slate-950/60 px-2 py-0.5 text-[11px] uppercase tracking-[0.12em]">
                      {finding.severity}
                    </span>
                  </div>
                  {finding.evidence ? <p className="mt-1 break-all text-xs opacity-90">Evidence: {finding.evidence}</p> : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">
              No high-risk email authentication findings were detected.
            </p>
          )}

          {analysis.recommendations.length > 0 ? (
            <div className="rounded-xl border border-sky-500/30 bg-sky-500/10 p-3 text-xs text-sky-100">
              <p className="font-semibold uppercase tracking-[0.12em] text-sky-200">Recommendations</p>
              <ul className="mt-2 space-y-1">
                {analysis.recommendations.map((recommendation) => (
                  <li key={recommendation}>- {recommendation}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : (
        <p className="mt-3 text-sm text-slate-400">This report does not include email security analysis details.</p>
      )}
    </details>
  );
}

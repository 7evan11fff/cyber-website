import type { TlsAnalysis, TlsFindingSeverity } from "@/lib/tlsAnalysis";

type TlsCardProps = {
  analysis?: TlsAnalysis;
};

type StatusTone = "good" | "warn" | "bad";

const toneStyles: Record<StatusTone, string> = {
  good: "border-emerald-500/35 bg-emerald-500/15 text-emerald-200",
  warn: "border-amber-500/35 bg-amber-500/15 text-amber-200",
  bad: "border-rose-500/35 bg-rose-500/15 text-rose-200"
};

const findingStyles: Record<TlsFindingSeverity, string> = {
  low: "border-emerald-500/35 bg-emerald-500/15 text-emerald-100",
  medium: "border-amber-500/35 bg-amber-500/15 text-amber-100",
  high: "border-orange-500/35 bg-orange-500/15 text-orange-100",
  critical: "border-rose-500/35 bg-rose-500/15 text-rose-100"
};

function protocolLabel(version: string | null): string {
  if (!version) return "Unknown";
  if (version === "TLSv1.3") return "TLS 1.3";
  if (version === "TLSv1.2") return "TLS 1.2";
  if (version === "TLSv1.1") return "TLS 1.1";
  if (version === "TLSv1.0" || version === "TLSv1") return "TLS 1.0";
  return version;
}

function protocolTone(analysis: TlsAnalysis): StatusTone {
  if (analysis.isInsecureTlsVersion) return "bad";
  if (analysis.prefersTls13) return "good";
  return "warn";
}

function certificateLabel(analysis: TlsAnalysis): { label: string; tone: StatusTone; detail: string } {
  if (!analysis.available) {
    return {
      label: "Unavailable",
      tone: "bad",
      detail: "Endpoint is not served over HTTPS."
    };
  }

  if (analysis.certificateExpired) {
    return {
      label: "Expired",
      tone: "bad",
      detail: `Expired on ${analysis.validTo ?? "unknown date"}.`
    };
  }

  if (analysis.certificateExpiringSoon) {
    return {
      label: "Expiring soon",
      tone: "warn",
      detail:
        typeof analysis.daysUntilExpiration === "number"
          ? `${analysis.daysUntilExpiration} day${analysis.daysUntilExpiration === 1 ? "" : "s"} remaining.`
          : "Renewal needed soon."
    };
  }

  if (analysis.certificateValid) {
    return {
      label: "Valid",
      tone: "good",
      detail: `Valid through ${analysis.validTo ?? "unknown date"}.`
    };
  }

  return {
    label: "Unknown",
    tone: "warn",
    detail: "Validity timestamps were not fully verified."
  };
}

function chainTone(analysis: TlsAnalysis): StatusTone {
  if (!analysis.chainComplete) return "bad";
  if (analysis.selfSigned || !analysis.authorized) return "warn";
  return "good";
}

function cipherTone(analysis: TlsAnalysis): StatusTone {
  if (analysis.weakAlgorithms.length > 0) return "bad";
  if (!analysis.cipherName) return "warn";
  return "good";
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

export function TlsCard({ analysis }: TlsCardProps) {
  const certificate = analysis ? certificateLabel(analysis) : null;

  return (
    <details className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4" open>
      <summary className="cursor-pointer list-none">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-[0.12em] text-slate-200">TLS / SSL analysis</h3>
            <p className="mt-1 text-sm text-slate-400">
              {analysis?.summary ?? "No TLS analysis is available for this report snapshot."}
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
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <StatusChip
              title="Certificate"
              value={certificate?.label ?? "Unknown"}
              detail={certificate?.detail ?? "No certificate data."}
              tone={certificate?.tone ?? "warn"}
            />
            <StatusChip
              title="Protocol"
              value={protocolLabel(analysis.tlsVersion)}
              detail={analysis.prefersTls13 ? "Modern protocol negotiated." : "Prefer TLS 1.3 when possible."}
              tone={protocolTone(analysis)}
            />
            <StatusChip
              title="Cipher"
              value={analysis.cipherName ?? "Unknown"}
              detail={
                analysis.weakAlgorithms.length > 0
                  ? `Weak algorithms: ${analysis.weakAlgorithms.join(", ")}`
                  : "No weak algorithms detected."
              }
              tone={cipherTone(analysis)}
            />
            <StatusChip
              title="Chain"
              value={analysis.chainComplete ? "Complete" : "Incomplete"}
              detail={
                analysis.selfSigned
                  ? "Self-signed certificate detected."
                  : analysis.authorized
                    ? "Trusted by local verifier."
                    : analysis.authorizationError ?? "Authorization not confirmed."
              }
              tone={chainTone(analysis)}
            />
          </div>

          <dl className="grid gap-2 text-xs text-slate-400 sm:grid-cols-2">
            <div className="rounded-lg border border-slate-800 bg-slate-950/70 px-3 py-2">
              <dt className="uppercase tracking-[0.12em] text-slate-500">Issuer</dt>
              <dd className="mt-1 break-all text-slate-200">
                {analysis.issuer ?? "Unknown"}
                {analysis.issuerCategory ? ` (${analysis.issuerCategory})` : ""}
              </dd>
            </div>
            <div className="rounded-lg border border-slate-800 bg-slate-950/70 px-3 py-2">
              <dt className="uppercase tracking-[0.12em] text-slate-500">Expiry date</dt>
              <dd className="mt-1 break-all text-slate-200">
                {analysis.validTo ?? "Unknown"}
                {typeof analysis.daysUntilExpiration === "number"
                  ? ` (${analysis.daysUntilExpiration} day${analysis.daysUntilExpiration === 1 ? "" : "s"})`
                  : ""}
              </dd>
            </div>
          </dl>

          {analysis.findings.length === 0 ? (
            <p className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">
              No risky TLS findings were detected.
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
                    <span className="text-slate-300">Recommendation:</span> {finding.recommendation}
                  </p>
                  {finding.evidence ? (
                    <p className="mt-1 break-all text-xs text-slate-200/90">
                      <span className="text-slate-300">Evidence:</span> {finding.evidence}
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        <p className="mt-3 text-sm text-slate-400">This report does not include TLS analysis details.</p>
      )}
    </details>
  );
}

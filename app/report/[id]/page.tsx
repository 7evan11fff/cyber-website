import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteFooter } from "@/app/components/SiteFooter";
import { SiteNav } from "@/app/components/SiteNav";
import { absoluteUrl, buildPageMetadata } from "@/lib/seo";
import { getSuggestedPlatformFromFramework } from "@/lib/platformFixes";
import { summarizeSharedPayload, type SharedComparisonReport, type SharedScanReport } from "@/lib/reportShare";
import { getSharedReportById } from "@/lib/sharedReportsStore";

export const dynamic = "force-dynamic";

function gradeColor(grade: string) {
  const byGrade: Record<string, string> = {
    A: "text-emerald-300",
    B: "text-lime-300",
    C: "text-amber-300",
    D: "text-orange-300",
    F: "text-rose-300"
  };
  return byGrade[grade] ?? "text-slate-200";
}

function scoreLabel(report: SharedScanReport): string {
  return `${report.score}/${report.results.length * 2}`;
}

function hostLabel(value: string): string {
  try {
    return new URL(value).hostname || value;
  } catch {
    return value;
  }
}

function SingleReportSection({ report }: { report: SharedScanReport }) {
  const suggestedPlatform = getSuggestedPlatformFromFramework(report.framework?.detected);
  const quickFixesHref = suggestedPlatform
    ? `/fixes?platform=${encodeURIComponent(suggestedPlatform)}`
    : "/fixes";

  return (
    <>
      <section className="rounded-2xl border border-slate-800/90 bg-slate-900/70 p-5 shadow-xl shadow-slate-950/60">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-300">Scanned URL</p>
            <p className="mt-2 break-all text-sm text-slate-300">{report.checkedUrl}</p>
          </div>
          <div className="text-right">
            <p className={`text-5xl font-bold ${gradeColor(report.grade)}`}>{report.grade}</p>
            <p className="mt-1 text-sm text-slate-300">Score {scoreLabel(report)}</p>
          </div>
        </div>
        <div className="mt-4 grid gap-3 text-sm text-slate-300 sm:grid-cols-3">
          <p className="break-all">
            <span className="text-slate-500">Final URL:</span> {report.finalUrl}
          </p>
          <p>
            <span className="text-slate-500">HTTP status:</span> {report.statusCode}
          </p>
          <p>
            <span className="text-slate-500">Checked at:</span> {new Date(report.checkedAt).toLocaleString()}
          </p>
          {report.framework?.detected && (
            <p className="sm:col-span-3">
              <span className="text-slate-500">Detected stack:</span> {report.framework.detected.label} (
              {report.framework.detected.reason}){" "}
              <Link
                href={quickFixesHref}
                className="mt-2 inline-flex rounded-md border border-slate-700 px-2.5 py-1.5 text-xs font-semibold uppercase tracking-[0.1em] text-sky-300 transition hover:border-sky-500/60 hover:text-sky-200 sm:mt-0 sm:ml-1"
              >
                Open quick fixes
              </Link>
            </p>
          )}
        </div>
      </section>

      <section className="mt-5 grid gap-4 sm:grid-cols-2">
        {report.results.map((header) => (
          <article key={header.key} className="rounded-2xl border border-slate-800/90 bg-slate-950/70 p-4">
            <div className="flex items-start justify-between gap-2">
              <h2 className="text-base font-semibold text-slate-100">{header.label}</h2>
              <span
                className={`rounded-full px-2.5 py-1 text-xs font-semibold uppercase ${
                  header.status === "good"
                    ? "bg-emerald-500/20 text-emerald-300"
                    : header.status === "weak"
                      ? "bg-amber-500/20 text-amber-300"
                      : "bg-rose-500/20 text-rose-300"
                }`}
              >
                {header.status}
              </span>
            </div>
            <p className="mt-2 text-sm text-slate-300">{header.whyItMatters}</p>
            <p className="mt-2 break-all text-xs text-slate-400">
              <span className="text-slate-500">Value:</span> {header.value ?? "Missing"}
            </p>
            <p className="mt-2 text-sm text-slate-300">
              <span className="font-medium text-slate-200">Guidance:</span> {header.guidance}
            </p>
          </article>
        ))}
      </section>
    </>
  );
}

function CompareReportSection({ comparison }: { comparison: SharedComparisonReport }) {
  const siteAName = hostLabel(comparison.siteA.finalUrl || comparison.siteA.checkedUrl);
  const siteBName = hostLabel(comparison.siteB.finalUrl || comparison.siteB.checkedUrl);
  const siteBByKey = new Map(comparison.siteB.results.map((entry) => [entry.key, entry]));

  return (
    <>
      <section className="grid gap-4 sm:grid-cols-2">
        <article className="rounded-2xl border border-slate-800/90 bg-slate-900/70 p-5 shadow-xl shadow-slate-950/60">
          <p className="text-xs uppercase tracking-[0.14em] text-slate-400">Site A</p>
          <p className="mt-1 break-all text-sm text-slate-300">{comparison.siteA.checkedUrl}</p>
          <p className={`mt-3 text-4xl font-bold ${gradeColor(comparison.siteA.grade)}`}>{comparison.siteA.grade}</p>
          <p className="mt-1 text-sm text-slate-300">Score {scoreLabel(comparison.siteA)}</p>
        </article>
        <article className="rounded-2xl border border-slate-800/90 bg-slate-900/70 p-5 shadow-xl shadow-slate-950/60">
          <p className="text-xs uppercase tracking-[0.14em] text-slate-400">Site B</p>
          <p className="mt-1 break-all text-sm text-slate-300">{comparison.siteB.checkedUrl}</p>
          <p className={`mt-3 text-4xl font-bold ${gradeColor(comparison.siteB.grade)}`}>{comparison.siteB.grade}</p>
          <p className="mt-1 text-sm text-slate-300">Score {scoreLabel(comparison.siteB)}</p>
        </article>
      </section>

      <section className="mt-5 space-y-3 sm:hidden">
        {comparison.siteA.results.map((siteAHeader) => {
          const siteBHeader = siteBByKey.get(siteAHeader.key);
          if (!siteBHeader) return null;
          return (
            <article key={siteAHeader.key} className="rounded-xl border border-slate-800/90 bg-slate-950/60 p-4">
              <p className="text-sm font-semibold text-slate-100">{siteAHeader.label}</p>
              <div className="mt-3 space-y-2">
                <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-2.5">
                  <p className="text-[11px] uppercase tracking-[0.12em] text-slate-500">{siteAName}</p>
                  <p className="mt-1 text-sm text-slate-200">{siteAHeader.status}</p>
                  <p className="mt-1 break-all text-xs text-slate-500">{siteAHeader.value ?? "Missing"}</p>
                </div>
                <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-2.5">
                  <p className="text-[11px] uppercase tracking-[0.12em] text-slate-500">{siteBName}</p>
                  <p className="mt-1 text-sm text-slate-200">{siteBHeader.status}</p>
                  <p className="mt-1 break-all text-xs text-slate-500">{siteBHeader.value ?? "Missing"}</p>
                </div>
              </div>
            </article>
          );
        })}
      </section>

      <section className="mt-5 hidden overflow-x-auto rounded-2xl border border-slate-800/90 bg-slate-950/60 sm:block">
        <table className="min-w-[860px] text-left text-sm">
          <thead className="bg-slate-900/70 text-xs uppercase tracking-[0.12em] text-slate-400">
            <tr>
              <th className="px-4 py-3">Header</th>
              <th className="px-4 py-3">{siteAName}</th>
              <th className="px-4 py-3">{siteBName}</th>
            </tr>
          </thead>
          <tbody>
            {comparison.siteA.results.map((siteAHeader) => {
              const siteBHeader = siteBByKey.get(siteAHeader.key);
              if (!siteBHeader) return null;
              return (
                <tr key={siteAHeader.key} className="border-t border-slate-800/80">
                  <td className="px-4 py-3 text-slate-100">{siteAHeader.label}</td>
                  <td className="px-4 py-3">
                    <span className="text-slate-300">{siteAHeader.status}</span>
                    <p className="mt-1 break-all text-xs text-slate-500">{siteAHeader.value ?? "Missing"}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-slate-300">{siteBHeader.status}</span>
                    <p className="mt-1 break-all text-xs text-slate-500">{siteBHeader.value ?? "Missing"}</p>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
    </>
  );
}

export async function generateMetadata({
  params
}: {
  params: { id: string };
}): Promise<Metadata> {
  const shared = await getSharedReportById(params.id);
  if (!shared) {
    return buildPageMetadata({
      title: "Shared report not found",
      description: "The requested shared report could not be found.",
      path: `/report/${params.id}`,
      robots: { index: false, follow: false }
    });
  }

  const summary = summarizeSharedPayload(shared.payload);
  const metadata = buildPageMetadata({
    title: summary.title,
    description: summary.description,
    path: `/report/${shared.id}`
  });
  const reportImageUrl = absoluteUrl(`/report/${shared.id}/opengraph-image`);
  const image = {
    url: reportImageUrl,
    width: 1200,
    height: 630,
    alt: summary.title
  };
  const existingOpenGraphImages = metadata.openGraph?.images
    ? Array.isArray(metadata.openGraph.images)
      ? metadata.openGraph.images
      : [metadata.openGraph.images]
    : [];
  metadata.openGraph = {
    ...metadata.openGraph,
    images: [image, ...existingOpenGraphImages]
  };
  metadata.twitter = {
    ...metadata.twitter,
    images: [reportImageUrl]
  };
  return metadata;
}

export default async function SharedReportPage({
  params
}: {
  params: { id: string };
}) {
  const shared = await getSharedReportById(params.id);
  if (!shared) {
    notFound();
  }

  const summary = summarizeSharedPayload(shared.payload);
  const structuredData =
    shared.payload.mode === "single"
      ? {
          "@context": "https://schema.org",
          "@type": "WebPage",
          name: summary.title,
          description: summary.description,
          url: absoluteUrl(`/report/${shared.id}`),
          datePublished: shared.createdAt,
          mainEntity: {
            "@type": "Thing",
            name: shared.payload.report.checkedUrl,
            additionalProperty: [
              { "@type": "PropertyValue", name: "Grade", value: shared.payload.report.grade },
              {
                "@type": "PropertyValue",
                name: "Score",
                value: `${shared.payload.report.score}/${shared.payload.report.results.length * 2}`
              }
            ]
          }
        }
      : {
          "@context": "https://schema.org",
          "@type": "WebPage",
          name: summary.title,
          description: summary.description,
          url: absoluteUrl(`/report/${shared.id}`),
          datePublished: shared.createdAt,
          mainEntity: {
            "@type": "ItemList",
            itemListElement: [
              {
                "@type": "ListItem",
                position: 1,
                name: shared.payload.comparison.siteA.checkedUrl,
                additionalProperty: [
                  { "@type": "PropertyValue", name: "Grade", value: shared.payload.comparison.siteA.grade }
                ]
              },
              {
                "@type": "ListItem",
                position: 2,
                name: shared.payload.comparison.siteB.checkedUrl,
                additionalProperty: [
                  { "@type": "PropertyValue", name: "Grade", value: shared.payload.comparison.siteB.grade }
                ]
              }
            ]
          }
        };

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-4 py-10 sm:px-6 lg:px-8">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} />
      <SiteNav />

      <section className="mb-6 rounded-2xl border border-sky-500/20 bg-gradient-to-br from-slate-900/90 via-slate-900/80 to-sky-950/40 p-6 shadow-2xl shadow-slate-950/70">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-300">Shared report</p>
        <h1 className="mt-2 text-2xl font-semibold text-slate-100 sm:text-3xl">{summary.title}</h1>
        <p className="mt-2 text-sm text-slate-300">{summary.description}</p>
        <p className="mt-2 text-xs text-slate-500">Shared on {new Date(shared.createdAt).toLocaleString()}</p>
      </section>

      {shared.payload.mode === "single" ? (
        <SingleReportSection report={shared.payload.report} />
      ) : (
        <CompareReportSection comparison={shared.payload.comparison} />
      )}

      <p className="mt-6 text-sm text-slate-300">
        Want to run your own live scan?{" "}
        <Link href="/" className="text-sky-300 transition hover:text-sky-200">
          Open Security Header Checker
        </Link>
        .
      </p>

      <SiteFooter className="mt-10" />
    </main>
  );
}

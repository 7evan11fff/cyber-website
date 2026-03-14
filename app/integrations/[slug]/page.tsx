import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteFooter } from "@/app/components/SiteFooter";
import { SiteNav } from "@/app/components/SiteNav";
import { getAllIntegrationGuides, getIntegrationGuide } from "@/lib/integrationGuides";
import { absoluteUrl, buildPageMetadata } from "@/lib/seo";

type IntegrationGuidePageProps = {
  params: {
    slug: string;
  };
};

export const dynamicParams = false;

export function generateStaticParams() {
  return getAllIntegrationGuides().map((guide) => ({ slug: guide.slug }));
}

export function generateMetadata({ params }: IntegrationGuidePageProps): Metadata {
  const guide = getIntegrationGuide(params.slug);

  if (!guide) {
    return buildPageMetadata({
      title: "Integrations",
      description:
        "Integration guides for Security Header Checker across CI/CD pipelines and team notification platforms.",
      path: "/integrations"
    });
  }

  return buildPageMetadata({
    title: `${guide.name} Integration Guide`,
    description: guide.summary,
    path: `/integrations/${guide.slug}`
  });
}

function CodeBlock({ code }: { code: string }) {
  return (
    <pre className="mt-3 overflow-x-auto rounded-xl border border-slate-800 bg-slate-950/80 p-4 text-xs text-slate-200">
      <code>{code}</code>
    </pre>
  );
}

export default function IntegrationGuidePage({ params }: IntegrationGuidePageProps) {
  const guide = getIntegrationGuide(params.slug);

  if (!guide) {
    notFound();
  }

  const howToStructuredData = {
    "@context": "https://schema.org",
    "@type": "HowTo",
    name: `${guide.name} integration for Security Header Checker`,
    description: guide.summary,
    url: absoluteUrl(`/integrations/${guide.slug}`),
    step: guide.steps.map((step, index) => ({
      "@type": "HowToStep",
      position: index + 1,
      name: step.title,
      text: step.description,
      url: absoluteUrl(`/integrations/${guide.slug}#${step.id}`)
    }))
  };

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col px-4 py-10 sm:px-6 lg:px-8">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(howToStructuredData) }} />
      <SiteNav />

      <section className="mb-6 overflow-hidden rounded-2xl border border-sky-500/20 bg-gradient-to-br from-slate-900/90 via-slate-900/80 to-sky-950/40 p-6 shadow-2xl shadow-slate-950/70 backdrop-blur">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-300">Integration guide</p>
        <div className="mt-2 flex items-center gap-3">
          <span
            aria-hidden="true"
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-700 bg-slate-900 text-xl"
          >
            {guide.icon}
          </span>
          <h1 className="text-3xl font-semibold text-slate-100 sm:text-4xl">{guide.name}</h1>
        </div>
        <p className="mt-3 max-w-3xl text-slate-300">{guide.intro}</p>
      </section>

      <section className="rounded-2xl border border-slate-800/80 bg-slate-900/70 p-6 shadow-2xl shadow-slate-950/70 backdrop-blur">
        <h2 className="text-2xl font-semibold text-slate-100">Before you start</h2>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-slate-300">
          {guide.prerequisites.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>

      <section className="mt-6 space-y-5 rounded-2xl border border-slate-800/80 bg-slate-900/70 p-6 shadow-2xl shadow-slate-950/70 backdrop-blur">
        {guide.steps.map((step, index) => (
          <article key={step.id} id={step.id} className="rounded-xl border border-slate-800/90 bg-slate-950/60 p-5">
            <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Step {index + 1}</p>
            <h2 className="mt-2 text-2xl font-semibold text-slate-100">{step.title}</h2>
            <p className="mt-2 text-sm text-slate-300">{step.description}</p>
            {step.code ? <CodeBlock code={step.code} /> : null}
          </article>
        ))}
      </section>

      <div className="mt-6 flex flex-wrap gap-3">
        <Link
          href="/integrations"
          className="rounded-lg border border-slate-700 bg-slate-950/80 px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-200 transition hover:border-sky-500/60 hover:text-sky-200"
        >
          Back to integrations
        </Link>
        <Link
          href="/settings"
          className="rounded-lg border border-slate-700 bg-slate-950/80 px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-200 transition hover:border-sky-500/60 hover:text-sky-200"
        >
          Open settings
        </Link>
      </div>

      <SiteFooter className="mt-10" />
    </main>
  );
}

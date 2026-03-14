import type { Metadata } from "next";
import dynamic from "next/dynamic";
import { buildPageMetadata } from "@/lib/seo";

const ComparePageClient = dynamic(
  () => import("@/app/components/ComparePageClient").then((module) => module.ComparePageClient),
  {
    loading: () => (
      <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-4 py-10 sm:px-6 lg:px-8">
        <section className="rounded-2xl border border-slate-800/90 bg-slate-900/70 p-5">
          <div className="skeleton-shimmer h-7 w-48 rounded" />
          <div className="skeleton-shimmer mt-3 h-4 w-2/3 rounded" />
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <div className="skeleton-shimmer h-12 rounded-lg" />
            <div className="skeleton-shimmer h-12 rounded-lg" />
          </div>
        </section>
      </main>
    )
  }
);

export const metadata: Metadata = buildPageMetadata({
  title: "Compare",
  description:
    "Compare security headers between two URLs side by side with clear, color-coded differences and grade summaries.",
  path: "/compare"
});

export default function ComparePage() {
  return <ComparePageClient />;
}

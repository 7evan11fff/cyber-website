import type { Metadata } from "next";
import dynamic from "next/dynamic";
import { buildPageMetadata } from "@/lib/seo";

const BulkPageClient = dynamic(
  () => import("@/app/components/BulkPageClient").then((module) => module.BulkPageClient),
  {
    loading: () => (
      <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-4 py-10 sm:px-6 lg:px-8">
        <section className="rounded-2xl border border-slate-800/90 bg-slate-900/70 p-5">
          <div className="skeleton-shimmer h-7 w-44 rounded" />
          <div className="skeleton-shimmer mt-3 h-4 w-2/3 rounded" />
          <div className="skeleton-shimmer mt-5 h-36 rounded-xl" />
        </section>
      </main>
    )
  }
);

export const metadata: Metadata = buildPageMetadata({
  title: "Bulk Scan",
  description:
    "Bulk scan up to 10 URLs at once and compare grade, missing headers, and full report links in one table.",
  path: "/bulk"
});

export default function BulkPage() {
  return <BulkPageClient />;
}

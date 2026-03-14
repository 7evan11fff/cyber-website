import type { Metadata } from "next";
import Link from "next/link";
import { SiteFooter } from "@/app/components/SiteFooter";
import { SiteNav } from "@/app/components/SiteNav";
import { getAllBlogPosts } from "@/lib/blogPosts";
import { absoluteUrl, buildPageMetadata } from "@/lib/seo";

export const metadata: Metadata = buildPageMetadata({
  title: "Blog & News",
  description:
    "Security Header Checker blog and announcement feed with practical guidance for CSP, HSTS, and browser hardening.",
  path: "/blog",
  openGraphType: "article",
  keywords: ["security headers blog", "csp guide", "hsts best practices", "web security announcements"]
});

function formatPublishedDate(value: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric"
  }).format(new Date(`${value}T00:00:00Z`));
}

export default function BlogPage() {
  const posts = getAllBlogPosts();
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "Blog",
    name: "Security Header Checker Blog",
    url: absoluteUrl("/blog"),
    blogPost: posts.map((post) => ({
      "@type": "BlogPosting",
      headline: post.title,
      datePublished: post.publishedAt,
      url: absoluteUrl(`/blog/${post.slug}`),
      description: post.description
    }))
  };

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col px-4 py-10 sm:px-6 lg:px-8">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} />
      <SiteNav />

      <section className="mb-6 overflow-hidden rounded-2xl border border-sky-500/20 bg-gradient-to-br from-slate-900/90 via-slate-900/80 to-sky-950/40 p-6 shadow-2xl shadow-slate-950/70 backdrop-blur">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-300">Blog & announcements</p>
        <h1 className="mt-3 text-3xl font-semibold text-slate-100 sm:text-4xl">Security header insights</h1>
        <p className="mt-3 max-w-3xl text-slate-300">
          Practical posts on browser security headers, hardening strategies, and product updates from the Security
          Header Checker roadmap.
        </p>
      </section>

      <section className="space-y-4 rounded-2xl border border-slate-800/80 bg-slate-900/70 p-6 shadow-2xl shadow-slate-950/70 backdrop-blur">
        {posts.map((post) => (
          <article key={post.slug} className="rounded-xl border border-slate-800/90 bg-slate-950/60 p-5">
            <div className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-[0.12em] text-slate-500">
              <time dateTime={post.publishedAt}>{formatPublishedDate(post.publishedAt)}</time>
              <span className="text-slate-700">•</span>
              <span>{post.readingTime}</span>
            </div>
            <h2 className="mt-2 text-2xl font-semibold text-slate-100">
              <Link href={`/blog/${post.slug}`} className="transition hover:text-sky-200">
                {post.title}
              </Link>
            </h2>
            <p className="mt-3 text-sm text-slate-300">{post.excerpt}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {post.tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-md border border-slate-700 bg-slate-900/80 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-300"
                >
                  {tag}
                </span>
              ))}
            </div>
            <Link
              href={`/blog/${post.slug}`}
              className="mt-5 inline-flex rounded-lg border border-slate-700 bg-slate-950/80 px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-200 transition hover:border-sky-500/60 hover:text-sky-200"
            >
              Read article
            </Link>
          </article>
        ))}
      </section>

      <SiteFooter className="mt-10" />
    </main>
  );
}

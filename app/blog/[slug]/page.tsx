import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteFooter } from "@/app/components/SiteFooter";
import { SiteNav } from "@/app/components/SiteNav";
import { getAllBlogPosts, getBlogPostBySlug } from "@/lib/blogPosts";
import { absoluteUrl, buildPageMetadata } from "@/lib/seo";

type BlogPostPageProps = {
  params: {
    slug: string;
  };
};

export const dynamicParams = false;

export function generateStaticParams() {
  return getAllBlogPosts().map((post) => ({ slug: post.slug }));
}

export function generateMetadata({ params }: BlogPostPageProps): Metadata {
  const post = getBlogPostBySlug(params.slug);

  if (!post) {
    return buildPageMetadata({
      title: "Blog & News",
      description: "Security Header Checker blog posts and announcement updates.",
      path: "/blog"
    });
  }

  return buildPageMetadata({
    title: post.title,
    description: post.description,
    path: `/blog/${post.slug}`,
    openGraphType: "article",
    keywords: [...post.tags, "security headers", "website hardening"]
  });
}

function formatPublishedDate(value: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric"
  }).format(new Date(`${value}T00:00:00Z`));
}

export default function BlogPostPage({ params }: BlogPostPageProps) {
  const post = getBlogPostBySlug(params.slug);

  if (!post) {
    notFound();
  }

  const structuredData = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    datePublished: post.publishedAt,
    dateModified: post.publishedAt,
    description: post.description,
    keywords: post.tags.join(", "),
    url: absoluteUrl(`/blog/${post.slug}`),
    author: {
      "@type": "Organization",
      name: "Security Header Checker"
    },
    publisher: {
      "@type": "Organization",
      name: "Security Header Checker"
    }
  };

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col px-4 py-10 sm:px-6 lg:px-8">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} />
      <SiteNav />

      <article className="overflow-hidden rounded-2xl border border-slate-800/80 bg-slate-900/70 p-6 shadow-2xl shadow-slate-950/70 backdrop-blur">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-300">Security blog</p>
        <h1 className="mt-3 text-3xl font-semibold text-slate-100 sm:text-4xl">{post.title}</h1>
        <div className="mt-4 flex flex-wrap items-center gap-2 text-xs uppercase tracking-[0.12em] text-slate-500">
          <time dateTime={post.publishedAt}>{formatPublishedDate(post.publishedAt)}</time>
          <span className="text-slate-700">•</span>
          <span>{post.readingTime}</span>
        </div>
        <p className="mt-5 max-w-3xl text-slate-300">{post.description}</p>

        <div className="mt-5 flex flex-wrap gap-2">
          {post.tags.map((tag) => (
            <span
              key={tag}
              className="rounded-md border border-slate-700 bg-slate-900/80 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-300"
            >
              {tag}
            </span>
          ))}
        </div>

        <div className="mt-8 space-y-8">
          {post.sections.map((section) => (
            <section key={section.heading}>
              <h2 className="text-xl font-semibold text-slate-100">{section.heading}</h2>
              <div className="mt-3 space-y-3 text-sm leading-7 text-slate-300">
                {section.paragraphs.map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
              </div>
              {section.bullets && section.bullets.length > 0 && (
                <ul className="mt-4 list-disc space-y-2 pl-5 text-sm text-slate-300">
                  {section.bullets.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              )}
            </section>
          ))}
        </div>
      </article>

      <div className="mt-6 flex flex-wrap gap-3">
        <Link
          href="/blog"
          className="rounded-lg border border-slate-700 bg-slate-950/80 px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-200 transition hover:border-sky-500/60 hover:text-sky-200"
        >
          Back to blog
        </Link>
        <Link
          href="/"
          className="rounded-lg border border-slate-700 bg-slate-950/80 px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-200 transition hover:border-sky-500/60 hover:text-sky-200"
        >
          Open scanner
        </Link>
      </div>

      <SiteFooter className="mt-10" />
    </main>
  );
}

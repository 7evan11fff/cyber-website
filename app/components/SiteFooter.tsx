import Link from "next/link";
import type { ComponentPropsWithoutRef } from "react";

type SiteFooterProps = {
  className?: string;
} & Omit<ComponentPropsWithoutRef<"footer">, "className">;

export function SiteFooter({ className = "", ...props }: SiteFooterProps) {
  const currentYear = new Date().getFullYear();
  const githubRepositoryUrl = "https://github.com/7evan11fff/cyber-website";
  const linkClassName =
    "pressable inline-flex min-h-11 items-center rounded-md px-1 text-slate-300 transition hover:text-sky-200";
  const sectionTitleClassName = "text-xs font-semibold uppercase tracking-[0.14em] text-slate-500";

  return (
    <footer
      className={`rounded-2xl border border-slate-800/80 bg-slate-900/60 p-6 text-sm text-slate-400 ${className}`.trim()}
      {...props}
    >
      <div className="grid gap-6 lg:grid-cols-[1.2fr_2fr]">
        <div>
          <p className="text-sm font-semibold text-slate-100">Security Header Checker</p>
          <p className="mt-2 max-w-sm text-sm text-slate-400">
            Launch-ready scans, watchlist monitoring, and actionable guidance for HTTP security headers.
          </p>
          <a
            href={githubRepositoryUrl}
            target="_blank"
            rel="noreferrer"
            aria-label="Star Security Header Checker on GitHub"
            className="pressable mt-4 inline-flex min-h-11 items-center gap-2 rounded-lg border border-slate-700 bg-slate-950/80 px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-200 transition hover:border-sky-500/60 hover:text-sky-200"
          >
            <svg viewBox="0 0 20 20" className="h-4 w-4" aria-hidden="true">
              <path
                d="m10 2.2 2.34 4.74 5.22.76-3.78 3.68.9 5.2L10 14.12 5.32 16.58l.9-5.2L2.44 7.7l5.22-.76L10 2.2Z"
                fill="currentColor"
              />
            </svg>
            Star on GitHub
          </a>
        </div>

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <p className={sectionTitleClassName}>Product</p>
            <div className="mt-2 grid gap-1 text-sm">
              <Link href="/" aria-label="Navigate to Scanner" className={linkClassName}>
                Scanner
              </Link>
              <Link href="/badge" aria-label="Navigate to Badge generator" className={linkClassName}>
                Badge Generator
              </Link>
              <Link href="/pricing" aria-label="Navigate to Pricing" className={linkClassName}>
                Pricing
              </Link>
              <Link href="/api-docs" aria-label="Navigate to API Docs" className={linkClassName}>
                API Docs
              </Link>
              <Link href="/docs" aria-label="Navigate to Guides" className={linkClassName}>
                Guides
              </Link>
            </div>
          </div>

          <div>
            <p className={sectionTitleClassName}>Company</p>
            <div className="mt-2 grid gap-1 text-sm">
              <Link href="/about" aria-label="Navigate to About" className={linkClassName}>
                About
              </Link>
              <Link href="/blog" aria-label="Navigate to Blog" className={linkClassName}>
                Blog
              </Link>
              <Link href="/changelog" aria-label="Navigate to Changelog" className={linkClassName}>
                Changelog
              </Link>
              <Link href="/contact" aria-label="Navigate to Contact" className={linkClassName}>
                Contact
              </Link>
            </div>
          </div>

          <div>
            <p className={sectionTitleClassName}>Legal</p>
            <div className="mt-2 grid gap-1 text-sm">
              <Link href="/privacy" aria-label="Navigate to Privacy policy" className={linkClassName}>
                Privacy
              </Link>
              <Link href="/terms" aria-label="Navigate to Terms of service" className={linkClassName}>
                Terms
              </Link>
              <Link href="/contact" aria-label="Navigate to Contact" className={linkClassName}>
                Contact
              </Link>
            </div>
          </div>

          <div>
            <p className={sectionTitleClassName}>Social</p>
            <div className="mt-2 grid gap-1 text-sm">
              <a
                href="https://x.com/"
                target="_blank"
                rel="noreferrer"
                aria-label="Open Twitter or X in a new tab"
                className={linkClassName}
              >
                Twitter / X
              </a>
              <a
                href="https://www.linkedin.com/"
                target="_blank"
                rel="noreferrer"
                aria-label="Open LinkedIn in a new tab"
                className={linkClassName}
              >
                LinkedIn
              </a>
              <a
                href={githubRepositoryUrl}
                target="_blank"
                rel="noreferrer"
                aria-label="Open GitHub repository in a new tab"
                className={linkClassName}
              >
                GitHub
              </a>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-2 border-t border-slate-800/80 pt-4 text-xs text-slate-500">
        <p>&copy; {currentYear} Security Header Checker. All rights reserved.</p>
        <p>
          Made with <span className="text-rose-300">love</span> for secure releases.
        </p>
      </div>
    </footer>
  );
}

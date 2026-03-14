import Link from "next/link";
import type { ComponentPropsWithoutRef } from "react";

type SiteFooterProps = {
  className?: string;
} & Omit<ComponentPropsWithoutRef<"footer">, "className">;

export function SiteFooter({ className = "", ...props }: SiteFooterProps) {
  const currentYear = new Date().getFullYear();
  const linkClassName = "text-slate-300 transition hover:text-sky-200";
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
        </div>

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <p className={sectionTitleClassName}>Product</p>
            <div className="mt-2 grid gap-1 text-sm">
              <Link href="/" className={linkClassName}>
                Scanner
              </Link>
              <Link href="/pricing" className={linkClassName}>
                Pricing
              </Link>
              <Link href="/api-docs" className={linkClassName}>
                API Docs
              </Link>
              <Link href="/docs" className={linkClassName}>
                Guides
              </Link>
            </div>
          </div>

          <div>
            <p className={sectionTitleClassName}>Company</p>
            <div className="mt-2 grid gap-1 text-sm">
              <Link href="/about" className={linkClassName}>
                About
              </Link>
              <Link href="/blog" className={linkClassName}>
                Blog
              </Link>
              <Link href="/changelog" className={linkClassName}>
                Changelog
              </Link>
              <Link href="/contact" className={linkClassName}>
                Contact
              </Link>
            </div>
          </div>

          <div>
            <p className={sectionTitleClassName}>Legal</p>
            <div className="mt-2 grid gap-1 text-sm">
              <Link href="/privacy" className={linkClassName}>
                Privacy
              </Link>
              <Link href="/terms" className={linkClassName}>
                Terms
              </Link>
              <Link href="/contact" className={linkClassName}>
                Contact
              </Link>
            </div>
          </div>

          <div>
            <p className={sectionTitleClassName}>Social</p>
            <div className="mt-2 grid gap-1 text-sm">
              <a href="https://x.com/" target="_blank" rel="noreferrer" className={linkClassName}>
                Twitter / X
              </a>
              <a
                href="https://github.com/7evan11fff/cyber-website"
                target="_blank"
                rel="noreferrer"
                className={linkClassName}
              >
                GitHub
              </a>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-6 border-t border-slate-800/80 pt-4 text-xs text-slate-500">
        &copy; {currentYear} Security Header Checker. All rights reserved.
      </div>
    </footer>
  );
}

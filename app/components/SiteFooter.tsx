import Link from "next/link";
import type { ComponentPropsWithoutRef } from "react";

type SiteFooterProps = {
  className?: string;
} & Omit<ComponentPropsWithoutRef<"footer">, "className">;

export function SiteFooter({ className = "", ...props }: SiteFooterProps) {
  return (
    <footer
      className={`rounded-2xl border border-slate-800/80 bg-slate-900/50 p-5 text-sm text-slate-400 ${className}`.trim()}
      {...props}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <p>
            Built by Evan Klein ·{" "}
            <a
              className="text-sky-300 transition hover:text-sky-200"
              href="https://github.com/7evan11fff/cyber-website"
              target="_blank"
              rel="noreferrer"
            >
              GitHub repo
            </a>
          </p>
          <div className="flex flex-wrap gap-3 text-xs uppercase tracking-[0.12em]">
            <Link href="/" className="text-slate-300 transition hover:text-sky-200">
              Scanner
            </Link>
            <Link href="/api-docs" className="text-slate-300 transition hover:text-sky-200">
              API Docs
            </Link>
            <Link href="/pricing" className="text-slate-300 transition hover:text-sky-200">
              Pricing
            </Link>
            <Link href="/docs" className="text-slate-300 transition hover:text-sky-200">
              Guides
            </Link>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <a
            href="https://github.com/7evan11fff/cyber-website"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center justify-center rounded-lg border border-slate-700 bg-slate-950/80 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-slate-100 transition hover:border-sky-500/60 hover:text-sky-200"
          >
            Star on GitHub
          </a>
        </div>
      </div>
    </footer>
  );
}

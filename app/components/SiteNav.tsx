"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

const NAV_LINKS = [
  { href: "/", label: "Scanner" },
  { href: "/pricing", label: "Pricing" },
  { href: "/changelog", label: "Changelog" },
  { href: "/docs", label: "API Docs" },
  { href: "/about", label: "About" }
];

export function SiteNav({ trailing }: { trailing?: ReactNode }) {
  const pathname = usePathname();

  return (
    <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
      <p className="text-sm font-semibold uppercase tracking-[0.24em] text-sky-300">Security Header Checker</p>
      <div className="flex flex-wrap items-center gap-2">
        <nav className="flex items-center gap-2" aria-label="Main navigation">
          {NAV_LINKS.map((link) => {
            const active = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`rounded-lg border px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] transition ${
                  active
                    ? "border-sky-500/70 bg-sky-500/20 text-sky-100"
                    : "border-slate-700 bg-slate-950/80 text-slate-200 hover:border-sky-500/60 hover:text-sky-200"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>
        {trailing}
      </div>
    </header>
  );
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { signIn, signOut, useSession } from "next-auth/react";

const NAV_LINKS = [
  { href: "/", label: "Scanner" },
  { href: "/dashboard", label: "Dashboard" },
  { href: "/pricing", label: "Pricing" },
  { href: "/changelog", label: "Changelog" },
  { href: "/docs", label: "API Docs" },
  { href: "/about", label: "About" }
];

export function SiteNav({ trailing }: { trailing?: ReactNode }) {
  const pathname = usePathname();
  const { data: session, status } = useSession();
  const [providerMenuOpen, setProviderMenuOpen] = useState(false);

  useEffect(() => {
    setProviderMenuOpen(false);
  }, [pathname]);

  const userInitial = useMemo(() => {
    const source = session?.user?.name ?? session?.user?.email ?? "";
    return source.trim().slice(0, 1).toUpperCase() || "U";
  }, [session?.user?.email, session?.user?.name]);

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
        {status === "authenticated" ? (
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-950/80 px-2 py-1.5">
              {session.user?.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={session.user.image}
                  alt={session.user.name ? `${session.user.name} avatar` : "User avatar"}
                  className="h-7 w-7 rounded-full border border-slate-700 object-cover"
                />
              ) : (
                <span className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-slate-700 bg-slate-900 text-xs font-semibold text-slate-200">
                  {userInitial}
                </span>
              )}
              <span className="hidden max-w-[180px] truncate text-xs text-slate-200 sm:block">
                {session.user?.name ?? session.user?.email}
              </span>
            </div>
            <button
              type="button"
              onClick={() => void signOut({ callbackUrl: "/" })}
              className="rounded-lg border border-slate-700 bg-slate-950/80 px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-200 transition hover:border-sky-500/60 hover:text-sky-200"
            >
              Sign out
            </button>
          </div>
        ) : (
          <div className="relative">
            <button
              type="button"
              onClick={() => setProviderMenuOpen((open) => !open)}
              className="rounded-lg border border-slate-700 bg-slate-950/80 px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-200 transition hover:border-sky-500/60 hover:text-sky-200"
            >
              Sign in
            </button>
            {providerMenuOpen && (
              <div className="absolute right-0 top-full z-20 mt-2 w-44 rounded-xl border border-slate-700 bg-slate-950/95 p-2 shadow-lg shadow-slate-950/70">
                <button
                  type="button"
                  onClick={() => void signIn("github", { callbackUrl: pathname || "/" })}
                  className="w-full rounded-lg px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.1em] text-slate-200 transition hover:bg-slate-900 hover:text-sky-200"
                >
                  GitHub
                </button>
                <button
                  type="button"
                  onClick={() => void signIn("google", { callbackUrl: pathname || "/" })}
                  className="mt-1 w-full rounded-lg px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.1em] text-slate-200 transition hover:bg-slate-900 hover:text-sky-200"
                >
                  Google
                </button>
              </div>
            )}
          </div>
        )}
        {trailing}
      </div>
    </header>
  );
}

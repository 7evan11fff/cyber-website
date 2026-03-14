"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { signIn, signOut, useSession } from "next-auth/react";
import { ThemeToggle } from "@/app/components/ThemeToggle";

const NAV_LINKS = [
  { href: "/", label: "Scanner" },
  { href: "/compare", label: "Compare" },
  { href: "/bulk", label: "Bulk" },
  { href: "/dashboard", label: "Dashboard" },
  { href: "/settings", label: "Settings" },
  { href: "/pricing", label: "Pricing" },
  { href: "/blog", label: "Blog" },
  { href: "/changelog", label: "Changelog" },
  { href: "/api-docs", label: "API Docs" },
  { href: "/integrations", label: "Integrations" },
  { href: "/security-headers-guide", label: "Header Guide" },
  { href: "/contact", label: "Contact" },
  { href: "/about", label: "About" }
];

export function SiteNav({ trailing }: { trailing?: ReactNode }) {
  const pathname = usePathname();
  const { data: session, status } = useSession();
  const [providerMenuOpen, setProviderMenuOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mobileMenuRendered, setMobileMenuRendered] = useState(false);
  const headerRef = useRef<HTMLElement | null>(null);
  const providerMenuRef = useRef<HTMLDivElement | null>(null);
  const mobileFirstLinkRef = useRef<HTMLAnchorElement | null>(null);

  useEffect(() => {
    setProviderMenuOpen(false);
    setMobileMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (mobileMenuOpen) {
      setMobileMenuRendered(true);
      return;
    }

    const timeoutId = window.setTimeout(() => setMobileMenuRendered(false), 200);
    return () => window.clearTimeout(timeoutId);
  }, [mobileMenuOpen]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setProviderMenuOpen(false);
      setMobileMenuOpen(false);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    if (!providerMenuOpen) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!providerMenuRef.current) return;
      if (providerMenuRef.current.contains(event.target as Node)) return;
      setProviderMenuOpen(false);
    };

    window.addEventListener("mousedown", onPointerDown);
    return () => window.removeEventListener("mousedown", onPointerDown);
  }, [providerMenuOpen]);

  useEffect(() => {
    if (!mobileMenuOpen) return;

    const onPointerDown = (event: MouseEvent | TouchEvent) => {
      if (headerRef.current?.contains(event.target as Node)) return;
      setMobileMenuOpen(false);
    };

    window.addEventListener("mousedown", onPointerDown);
    window.addEventListener("touchstart", onPointerDown);
    return () => {
      window.removeEventListener("mousedown", onPointerDown);
      window.removeEventListener("touchstart", onPointerDown);
    };
  }, [mobileMenuOpen]);

  useEffect(() => {
    if (!mobileMenuOpen) return;

    const timeoutId = window.setTimeout(() => {
      mobileFirstLinkRef.current?.focus();
    }, 60);

    return () => window.clearTimeout(timeoutId);
  }, [mobileMenuOpen]);

  useEffect(() => {
    if (!mobileMenuOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [mobileMenuOpen]);

  const userInitial = useMemo(() => {
    const source = session?.user?.name ?? session?.user?.email ?? "";
    return source.trim().slice(0, 1).toUpperCase() || "U";
  }, [session?.user?.email, session?.user?.name]);

  return (
    <header ref={headerRef} className="mb-6">
      <div className="flex items-center justify-between gap-3">
        <p className="truncate pr-2 text-xs font-semibold uppercase tracking-[0.18em] text-sky-300 sm:text-sm sm:tracking-[0.24em]">
          Security Header Checker
        </p>
        <button
          type="button"
          onClick={() => setMobileMenuOpen((open) => !open)}
          aria-controls="mobile-nav-menu"
          aria-haspopup="menu"
          aria-expanded={mobileMenuOpen}
          aria-label={mobileMenuOpen ? "Close navigation menu" : "Open navigation menu"}
          className="pressable min-h-11 rounded-lg border border-slate-700 bg-slate-950/80 px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-200 transition hover:border-sky-500/60 hover:text-sky-200 lg:hidden"
        >
          {mobileMenuOpen ? "Close" : "Menu"}
        </button>
      </div>

      <div className="mt-4 hidden items-center justify-between gap-4 lg:flex">
        <nav className="flex flex-wrap items-center gap-2" aria-label="Main navigation">
          {NAV_LINKS.map((link) => {
            const active =
              pathname === link.href ||
              (link.href === "/api-docs" && (pathname.startsWith("/api-docs") || pathname.startsWith("/docs/api"))) ||
              (link.href === "/integrations" && pathname.startsWith("/integrations")) ||
              (link.href === "/blog" && pathname.startsWith("/blog/"));
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-label={`Navigate to ${link.label}`}
                className={`pressable min-h-11 rounded-lg border px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] transition ${
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
        <div className="flex items-center gap-2">
          <ThemeToggle />
          {trailing}
          {status === "authenticated" ? (
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-950/80 px-2 py-1.5">
                {session.user?.image ? (
                  <Image
                    src={session.user.image}
                    alt={session.user.name ? `${session.user.name} avatar` : "User avatar"}
                    width={28}
                    height={28}
                    sizes="28px"
                    loading="lazy"
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
                aria-label="Sign out of your account"
                className="pressable min-h-11 rounded-lg border border-slate-700 bg-slate-950/80 px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-200 transition hover:border-sky-500/60 hover:text-sky-200"
              >
                Sign out
              </button>
            </div>
          ) : status === "loading" ? (
            <span className="rounded-lg border border-slate-700 bg-slate-950/80 px-3 py-2 text-xs uppercase tracking-[0.12em] text-slate-400">
              Loading...
            </span>
          ) : (
            <div ref={providerMenuRef} className="relative">
              <button
                type="button"
                onClick={() => setProviderMenuOpen((open) => !open)}
                aria-expanded={providerMenuOpen}
                aria-controls="provider-sign-in-menu"
                aria-label="Open sign in options"
                className="pressable min-h-11 rounded-lg border border-slate-700 bg-slate-950/80 px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-200 transition hover:border-sky-500/60 hover:text-sky-200"
              >
                Sign in
              </button>
              {providerMenuOpen && (
                <div
                  id="provider-sign-in-menu"
                  className="absolute right-0 top-full z-20 mt-2 w-44 rounded-xl border border-slate-700 bg-slate-950/95 p-2 shadow-lg shadow-slate-950/70"
                >
                  <button
                    type="button"
                    onClick={() => void signIn("github", { callbackUrl: pathname || "/" })}
                    aria-label="Sign in with GitHub"
                    className="pressable min-h-11 w-full rounded-lg px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.1em] text-slate-200 transition hover:bg-slate-900 hover:text-sky-200"
                  >
                    GitHub
                  </button>
                  <button
                    type="button"
                    onClick={() => void signIn("google", { callbackUrl: pathname || "/" })}
                    aria-label="Sign in with Google"
                    className="pressable mt-1 min-h-11 w-full rounded-lg px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.1em] text-slate-200 transition hover:bg-slate-900 hover:text-sky-200"
                  >
                    Google
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {mobileMenuRendered && (
        <div
          id="mobile-nav-menu"
          aria-hidden={!mobileMenuOpen}
          className={`mt-4 overflow-hidden rounded-xl border border-slate-800 bg-slate-950/95 p-3 shadow-xl shadow-slate-950/70 transition-all duration-200 ease-out lg:hidden ${
            mobileMenuOpen ? "max-h-[85vh] translate-y-0 opacity-100" : "pointer-events-none max-h-0 -translate-y-2 opacity-0"
          }`}
        >
          <nav className="grid gap-2" aria-label="Mobile navigation">
            {NAV_LINKS.map((link, index) => {
              const active =
                pathname === link.href ||
                (link.href === "/api-docs" && (pathname.startsWith("/api-docs") || pathname.startsWith("/docs/api"))) ||
                (link.href === "/integrations" && pathname.startsWith("/integrations")) ||
                (link.href === "/blog" && pathname.startsWith("/blog/"));
              return (
                <Link
                  key={`mobile-${link.href}`}
                  href={link.href}
                  ref={index === 0 ? mobileFirstLinkRef : undefined}
                  aria-label={`Navigate to ${link.label}`}
                  className={`pressable min-h-11 rounded-lg border px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] transition ${
                    active
                      ? "border-sky-500/70 bg-sky-500/20 text-sky-100"
                      : "border-slate-700 bg-slate-900/80 text-slate-200 hover:border-sky-500/60 hover:text-sky-200"
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>
          <div className="mt-3 border-t border-slate-800 pt-3">
            <div className="mb-3">
              <ThemeToggle />
            </div>
            {status === "authenticated" ? (
              <>
                <div className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-900/80 px-2 py-1.5">
                  {session.user?.image ? (
                    <Image
                      src={session.user.image}
                      alt={session.user.name ? `${session.user.name} avatar` : "User avatar"}
                      width={28}
                      height={28}
                      sizes="28px"
                      loading="lazy"
                      className="h-7 w-7 rounded-full border border-slate-700 object-cover"
                    />
                  ) : (
                    <span className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-slate-700 bg-slate-900 text-xs font-semibold text-slate-200">
                      {userInitial}
                    </span>
                  )}
                  <span className="truncate text-xs text-slate-200">
                    {session.user?.name ?? session.user?.email}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => void signOut({ callbackUrl: "/" })}
                  aria-label="Sign out of your account"
                  className="pressable mt-2 min-h-11 w-full rounded-lg border border-slate-700 bg-slate-900/80 px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-200 transition hover:border-sky-500/60 hover:text-sky-200"
                >
                  Sign out
                </button>
              </>
            ) : (
              <div className="grid gap-2">
                <button
                  type="button"
                  onClick={() => void signIn("github", { callbackUrl: pathname || "/" })}
                  aria-label="Sign in with GitHub"
                  className="pressable min-h-11 w-full rounded-lg border border-slate-700 bg-slate-900/80 px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-200 transition hover:border-sky-500/60 hover:text-sky-200"
                >
                  Sign in with GitHub
                </button>
                <button
                  type="button"
                  onClick={() => void signIn("google", { callbackUrl: pathname || "/" })}
                  aria-label="Sign in with Google"
                  className="pressable min-h-11 w-full rounded-lg border border-slate-700 bg-slate-900/80 px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-200 transition hover:border-sky-500/60 hover:text-sky-200"
                >
                  Sign in with Google
                </button>
              </div>
            )}
          </div>
          {trailing && <div className="mt-3 border-t border-slate-800 pt-3">{trailing}</div>}
        </div>
      )}
    </header>
  );
}

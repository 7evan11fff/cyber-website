"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { signIn, signOut, useSession } from "next-auth/react";
import { ThemeToggle } from "@/app/components/ThemeToggle";

const NAV_LINKS = [
  { href: "/", label: "Scanner" },
  { href: "/compare", label: "Compare" },
  { href: "/bulk", label: "Bulk" },
  { href: "/badge", label: "Badge" },
  { href: "/fixes", label: "Fixes" },
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
  const router = useRouter();
  const { data: session, status } = useSession();
  const [providerMenuOpen, setProviderMenuOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [quickSearchOpen, setQuickSearchOpen] = useState(false);
  const [quickSearchQuery, setQuickSearchQuery] = useState("");
  const providerMenuRef = useRef<HTMLDivElement | null>(null);
  const quickSearchInputRef = useRef<HTMLInputElement | null>(null);
  const lastFocusedElementRef = useRef<HTMLElement | null>(null);

  const quickSearchItems = useMemo(() => {
    const featured = [
      { href: "/", label: "New Scan", aliases: ["scanner", "single", "home"] },
      { href: "/bulk", label: "Bulk Scan", aliases: ["multi", "batch"] },
      { href: "/compare", label: "Compare Sites", aliases: ["comparison"] },
      { href: "/dashboard", label: "Dashboard", aliases: ["watchlist", "history"] }
    ];

    const deduped = new Map<string, { href: string; label: string; aliases: string[] }>();
    for (const item of featured) {
      deduped.set(item.href, item);
    }
    for (const item of NAV_LINKS) {
      if (!deduped.has(item.href)) {
        deduped.set(item.href, { href: item.href, label: item.label, aliases: [] });
      }
    }
    return Array.from(deduped.values());
  }, []);

  const quickSearchResults = useMemo(() => {
    const query = quickSearchQuery.trim().toLowerCase();
    if (!query) {
      return quickSearchItems.slice(0, 8);
    }
    return quickSearchItems
      .filter((item) => `${item.label} ${item.href} ${item.aliases.join(" ")}`.toLowerCase().includes(query))
      .slice(0, 8);
  }, [quickSearchItems, quickSearchQuery]);

  const closeQuickSearch = useCallback(() => {
    setQuickSearchOpen(false);
    setQuickSearchQuery("");
  }, []);

  const openQuickSearch = useCallback(() => {
    if (!quickSearchOpen) {
      lastFocusedElementRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    }
    setProviderMenuOpen(false);
    setMobileMenuOpen(false);
    setQuickSearchOpen(true);
  }, [quickSearchOpen]);

  const selectQuickSearchResult = useCallback(
    (href: string) => {
      closeQuickSearch();
      router.push(href);
    },
    [closeQuickSearch, router]
  );

  useEffect(() => {
    setProviderMenuOpen(false);
    setMobileMenuOpen(false);
    setQuickSearchOpen(false);
    setQuickSearchQuery("");
  }, [pathname]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const normalizedKey = event.key.toLowerCase();
      if ((event.metaKey || event.ctrlKey) && !event.altKey && normalizedKey === "k") {
        event.preventDefault();
        openQuickSearch();
        return;
      }
      if (event.key !== "Escape") return;
      setProviderMenuOpen(false);
      setMobileMenuOpen(false);
      closeQuickSearch();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [closeQuickSearch, openQuickSearch]);

  useEffect(() => {
    const onOpenQuickSearch = () => {
      openQuickSearch();
    };
    window.addEventListener("shc:open-quick-search", onOpenQuickSearch);
    return () => {
      window.removeEventListener("shc:open-quick-search", onOpenQuickSearch);
    };
  }, [openQuickSearch]);

  useEffect(() => {
    if (!quickSearchOpen) {
      lastFocusedElementRef.current?.focus();
      return;
    }
    const previousBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.setTimeout(() => quickSearchInputRef.current?.focus(), 0);
    return () => {
      document.body.style.overflow = previousBodyOverflow;
    };
  }, [quickSearchOpen]);

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

  const userInitial = useMemo(() => {
    const source = session?.user?.name ?? session?.user?.email ?? "";
    return source.trim().slice(0, 1).toUpperCase() || "U";
  }, [session?.user?.email, session?.user?.name]);

  return (
    <header className="mb-6">
      <div className="flex items-center justify-between gap-3">
        <p className="truncate pr-2 text-xs font-semibold uppercase tracking-[0.18em] text-sky-300 sm:text-sm sm:tracking-[0.24em]">
          Security Header Checker
        </p>
        <button
          type="button"
          onClick={() => setMobileMenuOpen((open) => !open)}
          aria-controls="mobile-nav-menu"
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
          <button
            type="button"
            onClick={openQuickSearch}
            aria-label="Open quick search"
            className="pressable min-h-11 rounded-lg border border-slate-700 bg-slate-950/80 px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-200 transition hover:border-sky-500/60 hover:text-sky-200"
          >
            Quick Search
          </button>
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

      {mobileMenuOpen && (
        <div
          id="mobile-nav-menu"
          className="mt-4 rounded-xl border border-slate-800 bg-slate-950/95 p-3 shadow-xl shadow-slate-950/70 lg:hidden"
        >
          <nav className="grid gap-2" aria-label="Mobile navigation">
            {NAV_LINKS.map((link) => {
              const active =
                pathname === link.href ||
                (link.href === "/api-docs" && (pathname.startsWith("/api-docs") || pathname.startsWith("/docs/api"))) ||
                (link.href === "/integrations" && pathname.startsWith("/integrations")) ||
                (link.href === "/blog" && pathname.startsWith("/blog/"));
              return (
                <Link
                  key={`mobile-${link.href}`}
                  href={link.href}
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
            <button
              type="button"
              onClick={openQuickSearch}
              aria-label="Open quick search"
              className="pressable min-h-11 w-full rounded-lg border border-slate-700 bg-slate-900/80 px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-200 transition hover:border-sky-500/60 hover:text-sky-200"
            >
              Quick Search
            </button>
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

      {quickSearchOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-20 sm:pt-24">
          <button
            type="button"
            aria-label="Close quick search"
            onClick={closeQuickSearch}
            className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm"
          />
          <div className="relative z-10 w-full max-w-2xl rounded-2xl border border-slate-700 bg-slate-900/95 p-4 shadow-2xl shadow-slate-950/80">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-slate-300">Quick search</h2>
              <button
                type="button"
                onClick={closeQuickSearch}
                className="rounded-md border border-slate-700 px-2 py-1 text-xs uppercase tracking-[0.12em] text-slate-300 transition hover:border-sky-500/60 hover:text-sky-200"
              >
                Close
              </button>
            </div>
            <form
              className="mt-3"
              onSubmit={(event) => {
                event.preventDefault();
                const first = quickSearchResults[0];
                if (first) {
                  selectQuickSearchResult(first.href);
                }
              }}
            >
              <label htmlFor="quick-search-input" className="sr-only">
                Search pages
              </label>
              <input
                ref={quickSearchInputRef}
                id="quick-search-input"
                type="text"
                value={quickSearchQuery}
                onChange={(event) => setQuickSearchQuery(event.target.value)}
                placeholder="Type a page name (Scanner, Dashboard, Compare...)"
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-100 placeholder:text-slate-500 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/30"
              />
            </form>
            <ul className="mt-3 max-h-72 space-y-1 overflow-y-auto">
              {quickSearchResults.length === 0 ? (
                <li className="rounded-lg border border-slate-800 bg-slate-950/70 px-3 py-2 text-sm text-slate-400">
                  No pages match your search.
                </li>
              ) : (
                quickSearchResults.map((item) => (
                  <li key={`quick-search-${item.href}`}>
                    <button
                      type="button"
                      onClick={() => selectQuickSearchResult(item.href)}
                      className="w-full rounded-lg border border-slate-800 bg-slate-950/70 px-3 py-2 text-left transition hover:border-sky-500/50 hover:text-sky-200"
                    >
                      <span className="block text-sm font-medium text-slate-100">{item.label}</span>
                      <span className="text-xs text-slate-500">{item.href}</span>
                    </button>
                  </li>
                ))
              )}
            </ul>
            <p className="mt-3 text-xs text-slate-500">
              Shortcut: press <span className="text-slate-300">Cmd/Ctrl+K</span> from any page.
            </p>
          </div>
        </div>
      )}
    </header>
  );
}

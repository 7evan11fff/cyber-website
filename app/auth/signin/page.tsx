"use client";

import Link from "next/link";
import { Suspense, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { signIn, useSession } from "next-auth/react";
import { SiteNav } from "@/app/components/SiteNav";

function SignInContent() {
  const searchParams = useSearchParams();
  const { status } = useSession();

  const callbackUrl = useMemo(() => {
    const incoming = searchParams.get("callbackUrl");
    return incoming && incoming.startsWith("/") ? incoming : "/dashboard";
  }, [searchParams]);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-4xl flex-col px-4 py-10 sm:px-6 lg:px-8">
      <SiteNav />
      <section className="mx-auto mt-12 w-full max-w-xl rounded-2xl border border-slate-800/90 bg-slate-900/80 p-8 shadow-2xl shadow-slate-950/60">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-300">Account access</p>
        <h1 className="mt-3 text-3xl font-semibold text-slate-100">Sign in to sync your security data</h1>
        <p className="mt-3 text-sm text-slate-300">
          Your watchlist and scan history are stored to your account so they follow you across devices.
        </p>
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => void signIn("github", { callbackUrl })}
            disabled={status === "loading"}
            className="rounded-xl border border-slate-700 bg-slate-950/70 px-4 py-3 text-sm font-semibold text-slate-100 transition hover:border-sky-500/60 hover:text-sky-200 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Continue with GitHub
          </button>
          <button
            type="button"
            onClick={() => void signIn("google", { callbackUrl })}
            disabled={status === "loading"}
            className="rounded-xl border border-slate-700 bg-slate-950/70 px-4 py-3 text-sm font-semibold text-slate-100 transition hover:border-sky-500/60 hover:text-sky-200 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Continue with Google
          </button>
        </div>
        <p className="mt-5 text-xs text-slate-500">
          Having trouble? Make sure provider credentials are configured in environment variables.
        </p>
        <Link
          href="/"
          className="mt-6 inline-flex rounded-lg border border-slate-700 px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-300 transition hover:border-sky-500/60 hover:text-sky-200"
        >
          Back to scanner
        </Link>
      </section>
    </main>
  );
}

function SignInFallback() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-4xl flex-col px-4 py-10 sm:px-6 lg:px-8">
      <SiteNav />
      <section className="mx-auto mt-12 w-full max-w-xl rounded-2xl border border-slate-800/90 bg-slate-900/80 p-8 shadow-2xl shadow-slate-950/60">
        <p className="text-sm text-slate-300">Loading sign-in options...</p>
      </section>
    </main>
  );
}

export default function SignInPage() {
  return (
    <Suspense fallback={<SignInFallback />}>
      <SignInContent />
    </Suspense>
  );
}

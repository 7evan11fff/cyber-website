"use client";

import Link from "next/link";
import { signOut } from "next-auth/react";

export function DashboardActions() {
  return (
    <div className="mt-4 flex flex-wrap items-center gap-2">
      <Link
        href="/settings"
        className="rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-200 transition hover:border-sky-500/60 hover:text-sky-200"
      >
        Settings
      </Link>
      <button
        type="button"
        onClick={() => void signOut({ callbackUrl: "/" })}
        className="rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-200 transition hover:border-sky-500/60 hover:text-sky-200"
      >
        Sign out
      </button>
    </div>
  );
}

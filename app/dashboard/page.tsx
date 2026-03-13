import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getServerSession } from "next-auth";
import { DashboardActions } from "@/app/components/DashboardActions";
import { SiteNav } from "@/app/components/SiteNav";
import { authOptions } from "@/lib/auth";
import { getUserDataForUser, getUserKeyFromSessionUser } from "@/lib/userDataStore";

export const metadata: Metadata = {
  title: "Dashboard",
  description: "Signed-in dashboard for watchlist monitoring and scan history.",
  alternates: { canonical: "/dashboard" },
  robots: { index: false, follow: false }
};

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  const userKey = getUserKeyFromSessionUser(session?.user);
  if (!session?.user || !userKey) {
    redirect("/auth/signin?callbackUrl=/dashboard");
  }

  const userData = await getUserDataForUser(userKey);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-4 py-10 sm:px-6 lg:px-8">
      <SiteNav />

      <section className="mb-6 rounded-2xl border border-sky-500/20 bg-gradient-to-br from-slate-900/90 via-slate-900/80 to-sky-950/40 p-6 shadow-2xl shadow-slate-950/70">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-300">Dashboard</p>
        <h1 className="mt-2 text-3xl font-semibold text-slate-100">Your security monitoring workspace</h1>
        <p className="mt-2 text-sm text-slate-300">
          Signed in as <span className="font-medium text-slate-100">{session.user.email ?? session.user.name}</span>
        </p>
        <DashboardActions />
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <article className="rounded-2xl border border-slate-800/90 bg-slate-900/70 p-5 shadow-xl shadow-slate-950/60">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-slate-100">Saved watchlist</h2>
            <span className="rounded-full border border-slate-700 px-2.5 py-1 text-xs text-slate-300">
              {userData.watchlist.length} items
            </span>
          </div>
          {userData.watchlist.length === 0 ? (
            <p className="mt-4 text-sm text-slate-400">
              No watchlist items yet. Save scans from the scanner page to monitor grade changes.
            </p>
          ) : (
            <ul className="mt-4 space-y-2">
              {userData.watchlist.map((entry) => (
                <li key={entry.id} className="rounded-lg border border-slate-800 bg-slate-950/60 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="truncate text-sm text-slate-100">{entry.url}</p>
                    <p className="text-sm font-semibold text-sky-200">Grade {entry.lastGrade}</p>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    Last checked {new Date(entry.lastCheckedAt).toLocaleString()}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </article>

        <article className="rounded-2xl border border-slate-800/90 bg-slate-900/70 p-5 shadow-xl shadow-slate-950/60">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-slate-100">Scan history</h2>
            <span className="rounded-full border border-slate-700 px-2.5 py-1 text-xs text-slate-300">
              {userData.scanHistory.length} entries
            </span>
          </div>
          {userData.scanHistory.length === 0 ? (
            <p className="mt-4 text-sm text-slate-400">
              No scans recorded yet. Run checks from the scanner to build your history.
            </p>
          ) : (
            <ul className="mt-4 space-y-2">
              {userData.scanHistory.map((entry) => (
                <li key={entry.id} className="rounded-lg border border-slate-800 bg-slate-950/60 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="truncate text-sm text-slate-100">{entry.url}</p>
                    <p className="text-sm font-semibold text-sky-200">{entry.grade}</p>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    Scanned {new Date(entry.checkedAt).toLocaleString()}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </article>
      </section>

      <Link
        href="/"
        className="mt-6 inline-flex w-fit rounded-lg border border-slate-700 px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-300 transition hover:border-sky-500/60 hover:text-sky-200"
      >
        Back to scanner
      </Link>
    </main>
  );
}

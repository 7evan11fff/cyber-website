"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function TeamInviteAcceptClient({ token }: { token: string }) {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "saving" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function acceptInvite() {
    if (state === "saving") return;
    setState("saving");
    setErrorMessage(null);
    try {
      const response = await fetch(`/api/team-invites/${encodeURIComponent(token)}/accept`, {
        method: "POST"
      });
      const payload = (await response.json().catch(() => null)) as
        | {
            ok?: boolean;
            teamSlug?: string;
            error?: string;
          }
        | null;
      if (!response.ok || !payload?.ok || !payload.teamSlug) {
        throw new Error(payload?.error ?? "Could not accept invite.");
      }
      router.push(`/teams/${payload.teamSlug}`);
      router.refresh();
    } catch (error) {
      setState("error");
      setErrorMessage(error instanceof Error ? error.message : "Could not accept invite.");
      window.setTimeout(() => setState("idle"), 2500);
    }
  }

  return (
    <section className="rounded-2xl border border-slate-800/90 bg-slate-900/70 p-6 shadow-xl shadow-slate-950/60">
      <h1 className="text-2xl font-semibold text-slate-100">Team invitation</h1>
      <p className="mt-2 text-sm text-slate-300">
        Accept this invite to join the shared team workspace and watchlist.
      </p>
      <button
        type="button"
        onClick={() => void acceptInvite()}
        disabled={state === "saving"}
        className="mt-4 rounded-lg border border-slate-700 bg-slate-950/80 px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-200 transition hover:border-sky-500/60 hover:text-sky-200 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {state === "saving" ? "Accepting..." : "Accept invite"}
      </button>
      {errorMessage && <p className="mt-3 text-sm text-rose-300">{errorMessage}</p>}
    </section>
  );
}

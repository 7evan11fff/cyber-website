"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";

type TeamListItem = {
  id: string;
  name: string;
  slug: string;
  role: "owner" | "admin" | "member";
  memberCount: number;
  pendingInviteCount: number;
};

export function TeamsPageClient({ initialTeams }: { initialTeams: TeamListItem[] }) {
  const router = useRouter();
  const [teams, setTeams] = useState<TeamListItem[]>(initialTeams);
  const [teamName, setTeamName] = useState("");
  const [createState, setCreateState] = useState<"idle" | "saving" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function createTeam() {
    if (!teamName.trim() || createState === "saving") {
      return;
    }
    setCreateState("saving");
    setErrorMessage(null);
    try {
      const response = await fetch("/api/teams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: teamName.trim() })
      });
      const payload = (await response.json().catch(() => null)) as
        | {
            team?: TeamListItem;
            error?: string;
          }
        | null;
      if (!response.ok || !payload?.team) {
        throw new Error(payload?.error ?? "Could not create team.");
      }
      setTeams((previous) => [payload.team as TeamListItem, ...previous]);
      const teamSlug = payload.team.slug;
      setTeamName("");
      setCreateState("idle");
      router.push(`/teams/${encodeURIComponent(teamSlug)}?welcome=1`);
    } catch (error) {
      setCreateState("error");
      setErrorMessage(error instanceof Error ? error.message : "Could not create team.");
      window.setTimeout(() => setCreateState("idle"), 2500);
    }
  }

  return (
    <section className="rounded-2xl border border-slate-800/90 bg-slate-900/70 p-5 shadow-xl shadow-slate-950/60">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-100">Your teams</h2>
          <p className="text-sm text-slate-400">Shared watchlists, role-based permissions, and invite management.</p>
        </div>
      </div>

      <form
        className="mt-4 flex flex-col gap-2 sm:flex-row"
        onSubmit={(event) => {
          event.preventDefault();
          void createTeam();
        }}
      >
        <label htmlFor="new-team-name" className="sr-only">
          Team name
        </label>
        <input
          id="new-team-name"
          value={teamName}
          onChange={(event) => setTeamName(event.target.value)}
          placeholder="Acme Security Team"
          className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/30"
        />
        <button
          type="submit"
          disabled={createState === "saving"}
          className="w-full rounded-lg border border-slate-700 bg-slate-950/80 px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-200 transition hover:border-sky-500/60 hover:text-sky-200 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
        >
          {createState === "saving" ? "Creating..." : "Create team"}
        </button>
      </form>
      {errorMessage && (
        <p className="mt-2 text-xs text-rose-300" role="status" aria-live="polite">
          {errorMessage}
        </p>
      )}

      {teams.length === 0 ? (
        <p className="mt-4 rounded-lg border border-slate-800 bg-slate-950/60 p-4 text-sm text-slate-400">
          No teams yet. Create one to start collaborating on a shared watchlist.
        </p>
      ) : (
        <ul className="mt-4 space-y-2">
          {teams.map((team) => (
            <li key={team.id} className="rounded-lg border border-slate-800 bg-slate-950/60 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-medium text-slate-100">{team.name}</p>
                  <p className="text-xs text-slate-500">
                    Role: {team.role} • {team.memberCount} members
                    {team.pendingInviteCount > 0 ? ` • ${team.pendingInviteCount} pending invites` : ""}
                  </p>
                </div>
                <div className="grid grid-cols-1 gap-2 sm:flex sm:items-center">
                  <Link
                    href={`/teams/${team.slug}`}
                    className="rounded-md border border-slate-700 px-3 py-2 text-xs text-slate-200 transition hover:border-sky-500/60 hover:text-sky-200"
                  >
                    Open
                  </Link>
                  <Link
                    href={`/teams/${team.slug}/settings`}
                    className="rounded-md border border-slate-700 px-3 py-2 text-xs text-slate-300 transition hover:border-sky-500/60 hover:text-sky-200"
                  >
                    Settings
                  </Link>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

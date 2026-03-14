"use client";

import { useMemo, useState } from "react";

type ActivityEvent = {
  id: string;
  type:
    | "watchlist_added"
    | "watchlist_removed"
    | "scan_completed"
    | "member_joined"
    | "member_left"
    | "role_changed";
  actorUserId: string;
  createdAt: string;
  subjectUserId: string | null;
  subjectUrl: string | null;
  beforeValue: string | null;
  afterValue: string | null;
  message: string;
};

type MemberProfile = {
  userKey: string;
  displayName: string;
  avatarInitials: string;
  avatarUrl: string | null;
};

function eventLabel(type: ActivityEvent["type"]) {
  if (type === "watchlist_added") return "Watchlist";
  if (type === "watchlist_removed") return "Watchlist";
  if (type === "scan_completed") return "Scan";
  if (type === "member_joined") return "Member";
  if (type === "member_left") return "Member";
  return "Role";
}

export function TeamActivityFeed({
  events,
  memberProfiles
}: {
  events: ActivityEvent[];
  memberProfiles: Record<string, MemberProfile>;
}) {
  const [open, setOpen] = useState(false);

  const normalizedEvents = useMemo(
    () =>
      [...events].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 20),
    [events]
  );

  return (
    <article className="rounded-2xl border border-slate-800/90 bg-slate-900/70 p-4 sm:p-5 shadow-xl shadow-slate-950/60">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold text-slate-100">Team activity</h2>
          <p className="text-xs text-slate-400">Latest changes across watchlist scans, membership, and roles.</p>
        </div>
        <button
          type="button"
          onClick={() => setOpen((current) => !current)}
          aria-expanded={open}
          aria-controls="team-activity-feed"
          className="rounded-md border border-slate-700 px-2.5 py-1.5 text-xs text-slate-200 transition hover:border-sky-500/60 hover:text-sky-200"
        >
          {open ? "Hide activity" : "Show activity"}
        </button>
      </div>

      {open && (
        <div id="team-activity-feed" className="mt-4">
          {normalizedEvents.length === 0 ? (
            <p className="rounded-lg border border-slate-800 bg-slate-950/60 p-4 text-sm text-slate-400">
              Activity will appear here as teammates add URLs, run scans, and manage team membership.
            </p>
          ) : (
            <ul className="space-y-2">
              {normalizedEvents.map((event) => {
                const actor = memberProfiles[event.actorUserId];
                const subjectUser =
                  event.subjectUserId && memberProfiles[event.subjectUserId]
                    ? memberProfiles[event.subjectUserId].displayName
                    : event.subjectUserId;
                return (
                  <li key={event.id} className="rounded-md border border-slate-800 bg-slate-950/60 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-400">
                        {eventLabel(event.type)}
                      </p>
                      <p className="text-xs text-slate-500">{new Date(event.createdAt).toLocaleString()}</p>
                    </div>
                    <p className="mt-1 text-sm text-slate-100">
                      <span className="font-medium text-sky-200">{actor?.displayName ?? event.actorUserId}</span>{" "}
                      {event.message}
                    </p>
                    {(event.subjectUrl || subjectUser || event.beforeValue || event.afterValue) && (
                      <p className="mt-1 break-all text-xs text-slate-400">
                        {event.subjectUrl ? `URL: ${event.subjectUrl}` : ""}
                        {subjectUser ? `${event.subjectUrl ? " • " : ""}User: ${subjectUser}` : ""}
                        {event.beforeValue || event.afterValue
                          ? `${event.subjectUrl || subjectUser ? " • " : ""}Change: ${event.beforeValue ?? "-"} -> ${
                              event.afterValue ?? "-"
                            }`
                          : ""}
                      </p>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </article>
  );
}

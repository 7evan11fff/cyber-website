"use client";

import { useEffect, useMemo, useState } from "react";
import type { WatchlistEntry } from "@/lib/userData";

const WATCHLIST_SCAN_SCHEDULE_STORAGE_KEY = "security-header-checker:watchlist-scan-schedules";

type ScheduleFrequency = "daily" | "weekly";
type SchedulePreference = {
  frequency: ScheduleFrequency;
  baseCheckedAt: string;
};

function isSchedulePreference(value: unknown): value is SchedulePreference {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<SchedulePreference>;
  return (
    (candidate.frequency === "daily" || candidate.frequency === "weekly") &&
    typeof candidate.baseCheckedAt === "string"
  );
}

function computeNextScheduledTime(baseCheckedAt: string, frequency: ScheduleFrequency): Date | null {
  const baseTime = new Date(baseCheckedAt).getTime();
  const intervalMs = frequency === "daily" ? 24 * 60 * 60 * 1000 : 7 * 24 * 60 * 60 * 1000;
  if (!Number.isFinite(baseTime)) {
    return new Date(Date.now() + intervalMs);
  }

  const now = Date.now();
  let next = baseTime;
  while (next <= now) {
    next += intervalMs;
  }
  return new Date(next);
}

export function WatchlistSchedulePanel({ entries }: { entries: WatchlistEntry[] }) {
  const [scheduleByEntryId, setScheduleByEntryId] = useState<Record<string, SchedulePreference>>({});

  useEffect(() => {
    try {
      const raw = localStorage.getItem(WATCHLIST_SCAN_SCHEDULE_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as unknown;
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return;

      const next: Record<string, SchedulePreference> = {};
      for (const [entryId, preference] of Object.entries(parsed)) {
        if (!entryId || !isSchedulePreference(preference)) continue;
        next[entryId] = preference;
      }
      setScheduleByEntryId(next);
    } catch {
      setScheduleByEntryId({});
    }
  }, []);

  useEffect(() => {
    try {
      if (Object.keys(scheduleByEntryId).length === 0) {
        localStorage.removeItem(WATCHLIST_SCAN_SCHEDULE_STORAGE_KEY);
      } else {
        localStorage.setItem(WATCHLIST_SCAN_SCHEDULE_STORAGE_KEY, JSON.stringify(scheduleByEntryId));
      }
    } catch {
      // Ignore localStorage failures.
    }
  }, [scheduleByEntryId]);

  const nextScheduleByEntryId = useMemo(() => {
    const next: Record<string, string> = {};
    for (const entry of entries) {
      const preference = scheduleByEntryId[entry.id];
      if (!preference) continue;
      const nextTime = computeNextScheduledTime(preference.baseCheckedAt, preference.frequency);
      if (!nextTime) continue;
      next[entry.id] = nextTime.toLocaleString();
    }
    return next;
  }, [entries, scheduleByEntryId]);

  if (entries.length === 0) return null;

  return (
    <section className="mt-4 rounded-lg border border-slate-800/90 bg-slate-950/50 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-slate-100">Schedule recurring scan</h3>
        <p className="text-xs text-slate-500">Preferences are saved on this device.</p>
      </div>
      <ul className="mt-3 space-y-2">
        {entries.map((entry) => {
          const preference = scheduleByEntryId[entry.id];
          const nextScheduled = nextScheduleByEntryId[entry.id] ?? null;
          return (
            <li key={entry.id} className="rounded-md border border-slate-800 bg-slate-900/60 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="truncate text-sm text-slate-200">{entry.url}</p>
                <select
                  value={preference?.frequency ?? "off"}
                  onChange={(event) => {
                    const nextValue = event.target.value as "off" | ScheduleFrequency;
                    setScheduleByEntryId((previous) => {
                      if (nextValue === "off") {
                        const { [entry.id]: _removed, ...rest } = previous;
                        return rest;
                      }
                      return {
                        ...previous,
                        [entry.id]: {
                          frequency: nextValue,
                          baseCheckedAt: entry.lastCheckedAt
                        }
                      };
                    });
                  }}
                  className="rounded-md border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs text-slate-200 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/30"
                  aria-label={`Schedule frequency for ${entry.url}`}
                >
                  <option value="off">Not scheduled</option>
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                </select>
              </div>
              <p className="mt-2 text-xs text-slate-400">
                {nextScheduled ? `Next scheduled scan: ${nextScheduled}` : "No recurring scan configured."}
              </p>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

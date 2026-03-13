"use client";

import { FormEvent, useMemo, useState } from "react";
import {
  HISTORY_STORAGE_KEY,
  WATCHLIST_ALERT_EMAIL_STORAGE_KEY,
  WATCHLIST_STORAGE_KEY
} from "@/lib/userData";
import { useToast } from "@/app/components/ToastProvider";

type SettingsFormProps = {
  accountName: string | null;
  accountEmail: string | null;
  accountImage: string | null;
  initialAlertEmail: string | null;
  initialNotificationOnGradeChange: boolean;
  lastUpdatedAt: string;
};

export function SettingsForm({
  accountName,
  accountEmail,
  accountImage,
  initialAlertEmail,
  initialNotificationOnGradeChange,
  lastUpdatedAt
}: SettingsFormProps) {
  const { notify } = useToast();
  const [alertEmail, setAlertEmail] = useState(initialAlertEmail ?? "");
  const [notificationOnGradeChange, setNotificationOnGradeChange] = useState(
    initialNotificationOnGradeChange
  );
  const [saveInFlight, setSaveInFlight] = useState(false);
  const [deleteInFlight, setDeleteInFlight] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");

  const updatedLabel = useMemo(() => {
    const date = new Date(lastUpdatedAt);
    if (!Number.isFinite(date.getTime()) || date.getTime() === 0) {
      return "Not synced yet";
    }
    return date.toLocaleString();
  }, [lastUpdatedAt]);

  async function onSavePreferences(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedEmail = alertEmail.trim();

    if (notificationOnGradeChange && (!trimmedEmail || !trimmedEmail.includes("@"))) {
      notify({
        tone: "error",
        message: "Enter a valid email to enable grade change notifications."
      });
      return;
    }

    setSaveInFlight(true);
    try {
      const response = await fetch("/api/user-data", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          alertEmail: trimmedEmail || null,
          notificationOnGradeChange
        })
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: unknown } | null;
        throw new Error(
          payload && typeof payload.error === "string" ? payload.error : "Unable to save preferences."
        );
      }

      notify({ tone: "success", message: "Notification preferences saved." });
    } catch (error) {
      notify({
        tone: "error",
        message: error instanceof Error ? error.message : "Unable to save preferences."
      });
    } finally {
      setSaveInFlight(false);
    }
  }

  async function onDeleteData() {
    if (deleteConfirmText.trim().toUpperCase() !== "DELETE") {
      notify({ tone: "error", message: 'Type "DELETE" to confirm account data deletion.' });
      return;
    }

    setDeleteInFlight(true);
    try {
      const response = await fetch("/api/user-data", { method: "DELETE" });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: unknown } | null;
        throw new Error(
          payload && typeof payload.error === "string"
            ? payload.error
            : "Unable to delete your stored data."
        );
      }

      try {
        localStorage.removeItem(HISTORY_STORAGE_KEY);
        localStorage.removeItem(WATCHLIST_STORAGE_KEY);
        localStorage.removeItem(WATCHLIST_ALERT_EMAIL_STORAGE_KEY);
      } catch {
        // Ignore browser storage failures.
      }

      setAlertEmail("");
      setNotificationOnGradeChange(false);
      setDeleteConfirmText("");
      notify({
        tone: "success",
        message: "Your saved watchlist, history, and notification settings were deleted."
      });
    } catch (error) {
      notify({
        tone: "error",
        message: error instanceof Error ? error.message : "Unable to delete your stored data."
      });
    } finally {
      setDeleteInFlight(false);
    }
  }

  return (
    <section className="grid gap-6">
      <article className="rounded-2xl border border-slate-800/90 bg-slate-900/70 p-5 shadow-xl shadow-slate-950/60">
        <h2 className="text-lg font-semibold text-slate-100">Account</h2>
        <p className="mt-1 text-xs text-slate-500">Signed in account details</p>
        <div className="mt-4 flex items-center gap-3">
          {accountImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={accountImage}
              alt={accountName ? `${accountName} avatar` : "Account avatar"}
              className="h-11 w-11 rounded-full border border-slate-700 object-cover"
            />
          ) : (
            <div className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-slate-700 bg-slate-950 text-sm font-semibold text-slate-200">
              {(accountName ?? accountEmail ?? "U").slice(0, 1).toUpperCase()}
            </div>
          )}
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-slate-100">{accountName ?? "Unnamed account"}</p>
            <p className="truncate text-sm text-slate-300">{accountEmail ?? "No email from provider"}</p>
          </div>
        </div>
        <p className="mt-4 text-xs text-slate-500">Last synced: {updatedLabel}</p>
      </article>

      <article className="rounded-2xl border border-slate-800/90 bg-slate-900/70 p-5 shadow-xl shadow-slate-950/60">
        <h2 className="text-lg font-semibold text-slate-100">Notifications</h2>
        <p className="mt-1 text-sm text-slate-300">
          Receive an email when a watched URL changes grade during refresh checks.
        </p>

        <form className="mt-4 space-y-4" onSubmit={onSavePreferences}>
          <label className="flex items-start gap-3 rounded-lg border border-slate-800 bg-slate-950/50 px-3 py-3">
            <input
              type="checkbox"
              checked={notificationOnGradeChange}
              onChange={(event) => setNotificationOnGradeChange(event.target.checked)}
              className="mt-1 h-4 w-4 rounded border-slate-600 bg-slate-950 text-sky-500 focus:ring-sky-500/40"
            />
            <span>
              <span className="block text-sm font-medium text-slate-100">Email on watchlist grade change</span>
              <span className="block text-xs text-slate-500">
                Disable this if you only want in-app watchlist updates.
              </span>
            </span>
          </label>

          <div>
            <label htmlFor="settings-alert-email" className="text-xs uppercase tracking-[0.14em] text-slate-500">
              Alert email
            </label>
            <input
              id="settings-alert-email"
              type="email"
              inputMode="email"
              autoComplete="email"
              value={alertEmail}
              onChange={(event) => setAlertEmail(event.target.value)}
              placeholder="you@company.com"
              className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/30"
            />
          </div>

          <button
            type="submit"
            disabled={saveInFlight}
            className="rounded-lg border border-slate-700 bg-slate-950/80 px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-200 transition hover:border-sky-500/60 hover:text-sky-200 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saveInFlight ? "Saving..." : "Save preferences"}
          </button>
        </form>
      </article>

      <article className="rounded-2xl border border-rose-500/30 bg-rose-500/5 p-5 shadow-xl shadow-slate-950/60">
        <h2 className="text-lg font-semibold text-rose-100">Delete my data</h2>
        <p className="mt-1 text-sm text-rose-100/90">
          Permanently remove your stored watchlist, scan history, and notification settings.
        </p>
        <p className="mt-1 text-xs text-rose-200/80">This action cannot be undone.</p>
        <div className="mt-4">
          <label htmlFor="delete-confirm" className="text-xs uppercase tracking-[0.14em] text-rose-200/80">
            Type DELETE to confirm
          </label>
          <input
            id="delete-confirm"
            type="text"
            value={deleteConfirmText}
            onChange={(event) => setDeleteConfirmText(event.target.value)}
            className="mt-2 w-full rounded-lg border border-rose-400/30 bg-slate-950 px-3 py-2 text-sm text-rose-100 placeholder:text-rose-200/50 focus:border-rose-400 focus:outline-none focus:ring-2 focus:ring-rose-400/30"
          />
        </div>
        <button
          type="button"
          disabled={deleteInFlight}
          onClick={() => void onDeleteData()}
          className="mt-4 rounded-lg border border-rose-400/40 bg-rose-500/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-rose-100 transition hover:border-rose-300 hover:bg-rose-500/20 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {deleteInFlight ? "Deleting..." : "Delete my data"}
        </button>
      </article>
    </section>
  );
}

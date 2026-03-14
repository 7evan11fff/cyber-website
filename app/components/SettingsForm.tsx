"use client";

import Image from "next/image";
import { FormEvent, useMemo, useState } from "react";
import {
  BROWSER_NOTIFICATIONS_ENABLED_STORAGE_KEY,
  COMPARISON_HISTORY_STORAGE_KEY,
  DOMAIN_HISTORY_STORAGE_KEY,
  HISTORY_STORAGE_KEY,
  type NotificationFrequency,
  type WebhookRegistration,
  normalizeWebhookRegistrations,
  WATCHLIST_ALERT_EMAIL_STORAGE_KEY,
  WATCHLIST_NOTIFICATION_FREQUENCY_STORAGE_KEY,
  WATCHLIST_STORAGE_KEY
} from "@/lib/userData";
import { useToast } from "@/app/components/ToastProvider";
import {
  getBrowserNotificationPermission,
  requestBrowserNotificationPermission
} from "@/lib/browserNotifications";

type SettingsFormProps = {
  accountName: string | null;
  accountEmail: string | null;
  accountImage: string | null;
  initialAlertEmail: string | null;
  initialNotificationOnGradeChange: boolean;
  initialNotificationFrequency: NotificationFrequency;
  initialBrowserNotificationsEnabled: boolean;
  initialWebhooks: WebhookRegistration[];
  initialApiKey: string | null;
  lastUpdatedAt: string;
};

export function SettingsForm({
  accountName,
  accountEmail,
  accountImage,
  initialAlertEmail,
  initialNotificationOnGradeChange,
  initialNotificationFrequency,
  initialBrowserNotificationsEnabled,
  initialWebhooks,
  initialApiKey,
  lastUpdatedAt
}: SettingsFormProps) {
  const { notify } = useToast();
  const [alertEmail, setAlertEmail] = useState(initialAlertEmail ?? "");
  const [notificationOnGradeChange, setNotificationOnGradeChange] = useState(
    initialNotificationOnGradeChange
  );
  const [notificationFrequency, setNotificationFrequency] = useState<NotificationFrequency>(
    initialNotificationFrequency
  );
  const [browserNotificationsEnabled, setBrowserNotificationsEnabled] = useState(
    initialBrowserNotificationsEnabled
  );
  const [saveInFlight, setSaveInFlight] = useState(false);
  const [deleteInFlight, setDeleteInFlight] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [webhooks, setWebhooks] = useState<WebhookRegistration[]>(initialWebhooks);
  const [webhookUrlInput, setWebhookUrlInput] = useState("");
  const [webhookActionInFlight, setWebhookActionInFlight] = useState(false);
  const [apiKey, setApiKey] = useState(initialApiKey);
  const [apiKeyActionInFlight, setApiKeyActionInFlight] = useState(false);
  const [copiedValueKey, setCopiedValueKey] = useState<string | null>(null);

  const updatedLabel = useMemo(() => {
    const date = new Date(lastUpdatedAt);
    if (!Number.isFinite(date.getTime()) || date.getTime() === 0) {
      return "Not synced yet";
    }
    return date.toLocaleString();
  }, [lastUpdatedAt]);

  async function copyValue(value: string, valueKey: string, label: string) {
    try {
      if (typeof navigator === "undefined" || !navigator.clipboard?.writeText) {
        throw new Error("Clipboard unavailable.");
      }
      await navigator.clipboard.writeText(value);
      setCopiedValueKey(valueKey);
      notify({ tone: "success", message: `${label} copied.` });
      window.setTimeout(() => {
        setCopiedValueKey((current) => (current === valueKey ? null : current));
      }, 1800);
    } catch {
      notify({ tone: "error", message: "Clipboard unavailable. Copy manually instead." });
    }
  }

  async function onSavePreferences(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedEmail = alertEmail.trim();
    const looksLikeEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail);

    if (notificationOnGradeChange && (!trimmedEmail || !looksLikeEmail)) {
      notify({
        tone: "error",
        message: "Enter a valid email to enable grade change notifications."
      });
      return;
    }

    if (browserNotificationsEnabled) {
      const permission = getBrowserNotificationPermission();
      if (permission === "unsupported") {
        notify({
          tone: "error",
          message: "This browser does not support notifications."
        });
        return;
      }
      if (permission === "denied") {
        notify({
          tone: "error",
          message: "Browser notifications are blocked. Re-enable them in your browser settings."
        });
        return;
      }
      if (permission === "default") {
        const granted = await requestBrowserNotificationPermission();
        if (granted !== "granted") {
          setBrowserNotificationsEnabled(false);
          notify({
            tone: "error",
            message: "Notification permission was not granted."
          });
          return;
        }
      }
    }

    setSaveInFlight(true);
    try {
      const response = await fetch("/api/user-data", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          alertEmail: trimmedEmail || null,
          notificationOnGradeChange,
          notificationFrequency,
          browserNotificationsEnabled
        })
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: unknown } | null;
        throw new Error(
          payload && typeof payload.error === "string" ? payload.error : "Unable to save preferences."
        );
      }

      try {
        if (trimmedEmail) {
          localStorage.setItem(WATCHLIST_ALERT_EMAIL_STORAGE_KEY, trimmedEmail);
        } else {
          localStorage.removeItem(WATCHLIST_ALERT_EMAIL_STORAGE_KEY);
        }
        localStorage.setItem(WATCHLIST_NOTIFICATION_FREQUENCY_STORAGE_KEY, notificationFrequency);
        localStorage.setItem(
          BROWSER_NOTIFICATIONS_ENABLED_STORAGE_KEY,
          browserNotificationsEnabled ? "true" : "false"
        );
      } catch {
        // Ignore storage write failures.
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
        localStorage.removeItem(COMPARISON_HISTORY_STORAGE_KEY);
        localStorage.removeItem(DOMAIN_HISTORY_STORAGE_KEY);
        localStorage.removeItem(WATCHLIST_STORAGE_KEY);
        localStorage.removeItem(WATCHLIST_ALERT_EMAIL_STORAGE_KEY);
        localStorage.removeItem(WATCHLIST_NOTIFICATION_FREQUENCY_STORAGE_KEY);
        localStorage.removeItem(BROWSER_NOTIFICATIONS_ENABLED_STORAGE_KEY);
      } catch {
        // Ignore browser storage failures.
      }

      setAlertEmail("");
      setNotificationOnGradeChange(true);
      setNotificationFrequency("instant");
      setBrowserNotificationsEnabled(false);
      setWebhooks([]);
      setWebhookUrlInput("");
      setApiKey(null);
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

  async function onAddWebhook(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedUrl = webhookUrlInput.trim();
    if (!trimmedUrl) {
      notify({ tone: "error", message: "Enter a webhook URL first." });
      return;
    }

    setWebhookActionInFlight(true);
    try {
      const response = await fetch("/api/webhooks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: trimmedUrl })
      });
      const payload = (await response.json().catch(() => null)) as
        | { webhooks?: unknown; error?: unknown; created?: boolean }
        | null;
      if (!response.ok) {
        throw new Error(
          payload && typeof payload.error === "string" ? payload.error : "Unable to add webhook."
        );
      }

      if (payload && Array.isArray(payload.webhooks)) {
        setWebhooks(normalizeWebhookRegistrations(payload.webhooks));
      }
      setWebhookUrlInput("");
      notify({
        tone: "success",
        message:
          payload && payload.created === false ? "Webhook already exists." : "Webhook added successfully."
      });
    } catch (error) {
      notify({
        tone: "error",
        message: error instanceof Error ? error.message : "Unable to add webhook."
      });
    } finally {
      setWebhookActionInFlight(false);
    }
  }

  async function onDeleteWebhook(webhookId: string) {
    setWebhookActionInFlight(true);
    try {
      const response = await fetch(`/api/webhooks?id=${encodeURIComponent(webhookId)}`, {
        method: "DELETE"
      });
      const payload = (await response.json().catch(() => null)) as
        | { webhooks?: unknown; error?: unknown }
        | null;
      if (!response.ok) {
        throw new Error(
          payload && typeof payload.error === "string" ? payload.error : "Unable to delete webhook."
        );
      }
      if (payload && Array.isArray(payload.webhooks)) {
        setWebhooks(normalizeWebhookRegistrations(payload.webhooks));
      }
      notify({ tone: "success", message: "Webhook removed." });
    } catch (error) {
      notify({
        tone: "error",
        message: error instanceof Error ? error.message : "Unable to delete webhook."
      });
    } finally {
      setWebhookActionInFlight(false);
    }
  }

  async function onTestWebhook(target: { id?: string; url?: string }) {
    if (!target.id && !target.url) {
      notify({ tone: "error", message: "Provide a webhook to test." });
      return;
    }

    setWebhookActionInFlight(true);
    try {
      const response = await fetch("/api/webhooks/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(target)
      });
      const payload = (await response.json().catch(() => null)) as
        | { sent?: unknown; kind?: unknown; error?: unknown }
        | null;
      if (!response.ok || !payload || payload.sent !== true) {
        throw new Error(
          payload && typeof payload.error === "string"
            ? payload.error
            : "Unable to send webhook test notification."
        );
      }
      const destinationKind = typeof payload.kind === "string" ? payload.kind : "webhook";
      notify({
        tone: "success",
        message: `Test ${destinationKind} notification delivered.`
      });
    } catch (error) {
      notify({
        tone: "error",
        message: error instanceof Error ? error.message : "Unable to send webhook test notification."
      });
    } finally {
      setWebhookActionInFlight(false);
    }
  }

  async function onGenerateApiKey() {
    setApiKeyActionInFlight(true);
    try {
      const response = await fetch("/api/api-key", { method: "POST" });
      const payload = (await response.json().catch(() => null)) as
        | { apiKey?: unknown; error?: unknown }
        | null;
      if (!response.ok || !payload || typeof payload.apiKey !== "string") {
        throw new Error(
          payload && typeof payload.error === "string" ? payload.error : "Unable to generate API key."
        );
      }
      setApiKey(payload.apiKey);
      notify({ tone: "success", message: "API key generated." });
    } catch (error) {
      notify({
        tone: "error",
        message: error instanceof Error ? error.message : "Unable to generate API key."
      });
    } finally {
      setApiKeyActionInFlight(false);
    }
  }

  async function onRevokeApiKey() {
    setApiKeyActionInFlight(true);
    try {
      const response = await fetch("/api/api-key", { method: "DELETE" });
      const payload = (await response.json().catch(() => null)) as
        | { revoked?: unknown; error?: unknown }
        | null;
      if (!response.ok || !payload || payload.revoked !== true) {
        throw new Error(
          payload && typeof payload.error === "string" ? payload.error : "Unable to revoke API key."
        );
      }
      setApiKey(null);
      notify({ tone: "success", message: "API key revoked." });
    } catch (error) {
      notify({
        tone: "error",
        message: error instanceof Error ? error.message : "Unable to revoke API key."
      });
    } finally {
      setApiKeyActionInFlight(false);
    }
  }

  return (
    <section className="grid gap-6">
      <article className="rounded-2xl border border-slate-800/90 bg-slate-900/70 p-5 shadow-xl shadow-slate-950/60">
        <h2 className="text-lg font-semibold text-slate-100">Account</h2>
        <p className="mt-1 text-xs text-slate-500">Signed in account details</p>
        <div className="mt-4 flex items-center gap-3">
          {accountImage ? (
            <Image
              src={accountImage}
              alt={accountName ? `${accountName} avatar` : "Account avatar"}
              width={44}
              height={44}
              sizes="44px"
              loading="lazy"
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

          <label className="flex items-start gap-3 rounded-lg border border-slate-800 bg-slate-950/50 px-3 py-3">
            <input
              type="checkbox"
              checked={browserNotificationsEnabled}
              onChange={(event) => setBrowserNotificationsEnabled(event.target.checked)}
              className="mt-1 h-4 w-4 rounded border-slate-600 bg-slate-950 text-sky-500 focus:ring-sky-500/40"
            />
            <span>
              <span className="block text-sm font-medium text-slate-100">Browser notifications on scan completion</span>
              <span className="block text-xs text-slate-500">
                Useful for bulk scans running in another tab. You will be prompted for permission on save.
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

          <div>
            <label
              htmlFor="settings-notification-frequency"
              className="text-xs uppercase tracking-[0.14em] text-slate-500"
            >
              Notification frequency
            </label>
            <select
              id="settings-notification-frequency"
              value={notificationFrequency}
              onChange={(event) => setNotificationFrequency(event.target.value as NotificationFrequency)}
              className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/30"
            >
              <option value="instant">Instant (send as soon as grade changes)</option>
              <option value="daily">Daily digest cadence</option>
              <option value="weekly">Weekly digest cadence</option>
            </select>
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

      <article className="rounded-2xl border border-slate-800/90 bg-slate-900/70 p-5 shadow-xl shadow-slate-950/60">
        <h2 className="text-lg font-semibold text-slate-100">Integrations</h2>
        <p className="mt-1 text-sm text-slate-300">
          Manage webhook destinations and your API key for authenticated automation.
        </p>

        <div className="mt-5 rounded-xl border border-slate-800 bg-slate-950/50 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-slate-100">API key</p>
              <p className="mt-1 text-xs text-slate-500">
                Use this key with <code className="rounded bg-slate-900 px-1 py-0.5">Authorization: Bearer</code> on
                the Check API for CI/CD jobs.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={apiKeyActionInFlight}
                onClick={() => void onGenerateApiKey()}
                className="rounded-lg border border-slate-700 bg-slate-950/80 px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-200 transition hover:border-sky-500/60 hover:text-sky-200 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {apiKeyActionInFlight ? "Working..." : apiKey ? "Regenerate key" : "Generate key"}
              </button>
              <button
                type="button"
                disabled={!apiKey || apiKeyActionInFlight}
                onClick={() => void onRevokeApiKey()}
                className="rounded-lg border border-slate-700 bg-slate-950/80 px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-300 transition hover:border-rose-500/50 hover:text-rose-200 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Revoke
              </button>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2 rounded-lg border border-slate-800 bg-slate-950 p-3">
            <code className="min-w-0 flex-1 break-all text-xs text-slate-200">
              {apiKey ?? "No API key generated yet."}
            </code>
            <button
              type="button"
              disabled={!apiKey}
              onClick={() => apiKey && void copyValue(apiKey, "api-key", "API key")}
              className="rounded-md border border-slate-700 px-2 py-1 text-xs text-slate-200 transition hover:border-sky-500/60 hover:text-sky-200 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {copiedValueKey === "api-key" ? "Copied" : "Copy"}
            </button>
          </div>
        </div>

        <div className="mt-5 rounded-xl border border-slate-800 bg-slate-950/50 p-4">
          <p className="text-sm font-medium text-slate-100">Webhook endpoints</p>
          <p className="mt-1 text-xs text-slate-500">
            Receive notifications when a watchlist domain grade changes in scheduled scans. Slack and Discord webhook
            URLs are auto-formatted, and other URLs receive generic JSON payloads.
          </p>

          <form className="mt-3 flex flex-col gap-2 sm:flex-row" onSubmit={onAddWebhook}>
            <label htmlFor="settings-webhook-url" className="sr-only">
              Webhook URL
            </label>
            <input
              id="settings-webhook-url"
              type="url"
              inputMode="url"
              value={webhookUrlInput}
              onChange={(event) => setWebhookUrlInput(event.target.value)}
              placeholder="https://hooks.example.com/security-grade"
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/30"
            />
            <button
              type="submit"
              disabled={webhookActionInFlight}
              className="rounded-lg border border-slate-700 bg-slate-950/80 px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-200 transition hover:border-sky-500/60 hover:text-sky-200 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {webhookActionInFlight ? "Saving..." : "Add webhook"}
            </button>
            <button
              type="button"
              disabled={webhookActionInFlight}
              onClick={() => void onTestWebhook({ url: webhookUrlInput.trim() })}
              className="rounded-lg border border-slate-700 bg-slate-950/80 px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-200 transition hover:border-emerald-500/60 hover:text-emerald-200 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {webhookActionInFlight ? "Testing..." : "Test webhook"}
            </button>
          </form>

          {webhooks.length === 0 ? (
            <p className="mt-3 text-xs text-slate-400">No webhook endpoints configured.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {webhooks.map((webhook) => {
                const copyKey = `webhook-${webhook.id}`;
                return (
                  <li
                    key={webhook.id}
                    className="rounded-lg border border-slate-800/90 bg-slate-950 p-3 text-xs text-slate-300"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="break-all text-sm text-slate-100">{webhook.url}</p>
                        <p className="mt-1 text-xs text-slate-500">
                          Added {new Date(webhook.createdAt).toLocaleString()}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => void copyValue(webhook.url, copyKey, "Webhook URL")}
                          className="rounded-md border border-slate-700 px-2 py-1 text-xs text-slate-200 transition hover:border-sky-500/60 hover:text-sky-200"
                        >
                          {copiedValueKey === copyKey ? "Copied" : "Copy"}
                        </button>
                        <button
                          type="button"
                          disabled={webhookActionInFlight}
                          onClick={() => void onTestWebhook({ id: webhook.id })}
                          className="rounded-md border border-slate-700 px-2 py-1 text-xs text-slate-200 transition hover:border-emerald-500/60 hover:text-emerald-200 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Test
                        </button>
                        <button
                          type="button"
                          disabled={webhookActionInFlight}
                          onClick={() => void onDeleteWebhook(webhook.id)}
                          className="rounded-md border border-slate-700 px-2 py-1 text-xs text-slate-300 transition hover:border-rose-500/50 hover:text-rose-200 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
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

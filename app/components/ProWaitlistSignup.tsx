"use client";

import { FormEvent, useState } from "react";

type SubmissionState = "idle" | "submitting" | "success" | "error";

function isLikelyEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function ProWaitlistSignup() {
  const [email, setEmail] = useState("");
  const [submissionState, setSubmissionState] = useState<SubmissionState>("idle");
  const [statusMessage, setStatusMessage] = useState("");

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedEmail = email.trim().toLowerCase();

    if (!isLikelyEmail(normalizedEmail)) {
      setSubmissionState("error");
      setStatusMessage("Enter a valid email address to join the Pro waitlist.");
      return;
    }

    setSubmissionState("submitting");
    setStatusMessage("");

    try {
      // Mock API call for waitlist capture UI.
      await new Promise((resolve) => window.setTimeout(resolve, 950));
      setSubmissionState("success");
      setStatusMessage(`Added ${normalizedEmail} to the Pro launch waitlist.`);
      setEmail("");
    } catch {
      setSubmissionState("error");
      setStatusMessage("Could not submit right now. Please try again.");
    }
  }

  return (
    <section className="mt-6 rounded-2xl border border-slate-800/80 bg-slate-900/70 p-6 shadow-2xl shadow-slate-950/70">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-300">Pro waitlist</p>
      <h2 className="mt-2 text-xl font-semibold text-slate-100 sm:text-2xl">Get early access to Pro features</h2>
      <p className="mt-3 max-w-2xl text-sm text-slate-300">
        Join the waitlist for higher limits, team collaboration, and priority support. This is a UI-only preview using a
        mocked request.
      </p>

      <form onSubmit={onSubmit} className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <label htmlFor="pricing-pro-waitlist-email" className="sr-only">
          Email address for Pro waitlist
        </label>
        <input
          id="pricing-pro-waitlist-email"
          type="email"
          inputMode="email"
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="you@company.com"
          className="min-h-11 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/30"
          required
        />
        <button
          type="submit"
          disabled={submissionState === "submitting"}
          className="min-h-11 rounded-xl bg-sky-500 px-4 py-2.5 text-sm font-semibold uppercase tracking-[0.12em] text-slate-950 transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
        >
          {submissionState === "submitting" ? "Joining..." : "Join waitlist"}
        </button>
      </form>

      <p className="mt-3 text-xs text-slate-500">No spam. One product update email per milestone.</p>

      <p
        role="status"
        aria-live="polite"
        className={`mt-2 text-sm ${
          submissionState === "success"
            ? "text-emerald-300"
            : submissionState === "error"
              ? "text-rose-300"
              : "text-slate-400"
        }`}
      >
        {statusMessage}
      </p>
    </section>
  );
}

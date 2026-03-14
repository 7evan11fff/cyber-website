"use client";

import { FormEvent, useState } from "react";

type NewsletterState = "idle" | "submitting" | "success" | "error";

function looksLikeEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function FooterNewsletterForm() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<NewsletterState>("idle");
  const [message, setMessage] = useState("");

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedEmail = email.trim().toLowerCase();

    if (!looksLikeEmail(normalizedEmail)) {
      setState("error");
      setMessage("Please enter a valid email.");
      return;
    }

    setState("submitting");
    setMessage("");

    try {
      // Mock submit for newsletter UI.
      await new Promise((resolve) => window.setTimeout(resolve, 700));
      setState("success");
      setMessage("Thanks! You are subscribed for weekly security tips.");
      setEmail("");
    } catch {
      setState("error");
      setMessage("Subscription failed. Please try again.");
    }
  }

  return (
    <section className="mt-5 rounded-xl border border-slate-800/90 bg-slate-950/60 p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-sky-300">Get security tips weekly</p>
      <form onSubmit={onSubmit} className="mt-3 flex flex-col gap-2 sm:flex-row">
        <label htmlFor="footer-newsletter-email" className="sr-only">
          Email for weekly security tips
        </label>
        <input
          id="footer-newsletter-email"
          type="email"
          inputMode="email"
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="you@company.com"
          className="min-h-11 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/30"
          required
        />
        <button
          type="submit"
          disabled={state === "submitting"}
          className="min-h-11 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-200 transition hover:border-sky-500/60 hover:text-sky-200 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {state === "submitting" ? "Submitting..." : "Subscribe"}
        </button>
      </form>
      <p
        role="status"
        aria-live="polite"
        className={`mt-2 text-xs ${
          state === "success" ? "text-emerald-300" : state === "error" ? "text-rose-300" : "text-slate-500"
        }`}
      >
        {message || "Mock signup endpoint for launch preview."}
      </p>
    </section>
  );
}

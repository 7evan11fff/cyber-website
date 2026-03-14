"use client";

import { FormEvent, useState } from "react";

type SubmitState = "idle" | "submitting" | "success" | "error";

export function NewsletterSignupForm() {
  const [email, setEmail] = useState("");
  const [submitState, setSubmitState] = useState<SubmitState>("idle");
  const [message, setMessage] = useState("");

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedEmail = email.trim();
    if (!normalizedEmail) return;

    setSubmitState("submitting");
    setMessage("");

    try {
      const response = await fetch("/api/newsletter", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ email: normalizedEmail })
      });

      if (!response.ok) {
        throw new Error("Unable to join the newsletter right now.");
      }

      setSubmitState("success");
      setMessage("Thanks! You are on the list for weekly security tips.");
      setEmail("");
    } catch {
      setSubmitState("error");
      setMessage("Could not submit right now. Please try again soon.");
    }
  }

  return (
    <section className="mt-8 rounded-2xl border border-sky-500/20 bg-gradient-to-br from-slate-900/80 to-sky-950/20 p-6 shadow-xl shadow-slate-950/60">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-300">Newsletter</p>
      <h2 className="mt-2 text-2xl font-semibold text-slate-100">Get security tips weekly</h2>
      <p className="mt-2 max-w-2xl text-sm text-slate-300">
        Short, practical advice on CSP, HSTS, and browser hardening delivered once a week.
      </p>

      <form onSubmit={onSubmit} className="mt-4 flex flex-col gap-3 sm:flex-row">
        <label htmlFor="newsletter-email" className="sr-only">
          Email address
        </label>
        <input
          id="newsletter-email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="you@company.com"
          autoComplete="email"
          required
          className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-100 placeholder:text-slate-500 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/30"
        />
        <button
          type="submit"
          disabled={submitState === "submitting"}
          className="rounded-xl bg-sky-500 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
        >
          {submitState === "submitting" ? "Submitting..." : "Subscribe"}
        </button>
      </form>

      {message && (
        <p
          aria-live="polite"
          className={`mt-3 text-xs ${submitState === "error" ? "text-rose-300" : "text-emerald-300"}`}
        >
          {message}
        </p>
      )}
    </section>
  );
}

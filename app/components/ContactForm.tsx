"use client";

import type { FormEvent } from "react";
import { Suspense, useState } from "react";
import dynamic from "next/dynamic";

const ConfettiLauncher = dynamic(
  () => import("@/app/components/ConfettiLauncher").then((module) => module.ConfettiLauncher),
  { ssr: false }
);

type ContactValues = {
  name: string;
  email: string;
  subject: string;
  message: string;
};

type ContactField = keyof ContactValues;
type ContactErrors = Partial<Record<ContactField, string>>;

const INITIAL_VALUES: ContactValues = {
  name: "",
  email: "",
  subject: "",
  message: ""
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateField(field: ContactField, value: string): string | null {
  const trimmedValue = value.trim();
  switch (field) {
    case "name":
      if (!trimmedValue) return "Name is required.";
      if (trimmedValue.length < 2) return "Name must be at least 2 characters.";
      return null;
    case "email":
      if (!trimmedValue) return "Email is required.";
      if (!EMAIL_PATTERN.test(trimmedValue)) return "Enter a valid email address.";
      return null;
    case "subject":
      if (!trimmedValue) return "Subject is required.";
      if (trimmedValue.length < 3) return "Subject must be at least 3 characters.";
      return null;
    case "message":
      if (!trimmedValue) return "Message is required.";
      if (trimmedValue.length < 20) return "Message should be at least 20 characters.";
      return null;
    default:
      return null;
  }
}

function validateForm(values: ContactValues): ContactErrors {
  const errors: ContactErrors = {};
  (Object.keys(values) as ContactField[]).forEach((field) => {
    const error = validateField(field, values[field]);
    if (error) {
      errors[field] = error;
    }
  });
  return errors;
}

export function ContactForm() {
  const [values, setValues] = useState<ContactValues>(INITIAL_VALUES);
  const [errors, setErrors] = useState<ContactErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [confettiTrigger, setConfettiTrigger] = useState(0);

  function updateField(field: ContactField, value: string) {
    setValues((current) => ({ ...current, [field]: value }));
    if (submitted) {
      setSubmitted(false);
    }
    setErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      const nextError = validateField(field, value);
      if (nextError) {
        next[field] = nextError;
      } else {
        delete next[field];
      }
      return next;
    });
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedValues: ContactValues = {
      name: values.name.trim(),
      email: values.email.trim(),
      subject: values.subject.trim(),
      message: values.message.trim()
    };

    const nextErrors = validateForm(normalizedValues);
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      setSubmitError("Please fix the highlighted fields before submitting.");
      setSubmitted(false);
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(normalizedValues)
      });
      const payload = (await response.json().catch(() => null)) as { error?: unknown } | null;
      if (!response.ok) {
        throw new Error(
          payload && typeof payload.error === "string" ? payload.error : "Unable to submit your message right now."
        );
      }

      setValues(INITIAL_VALUES);
      setErrors({});
      setSubmitted(true);
      setConfettiTrigger((current) => current + 1);
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Unable to submit your message right now.");
      setSubmitted(false);
    } finally {
      setIsSubmitting(false);
    }
  }

  const inputClassName =
    "mt-2 w-full rounded-lg border bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2";

  return (
    <form noValidate onSubmit={onSubmit} className="space-y-4">
      <Suspense fallback={null}>
        <ConfettiLauncher triggerKey={confettiTrigger} preset="contact" />
      </Suspense>
      {submitted && (
        <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-4 text-sm text-emerald-100">
          Message sent successfully. Thanks for reaching out — we usually respond within one business day.
        </div>
      )}
      {submitError && (
        <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-4 text-sm text-rose-100">{submitError}</div>
      )}

      <div>
        <label htmlFor="contact-name" className="text-xs uppercase tracking-[0.14em] text-slate-400">
          Name
        </label>
        <input
          id="contact-name"
          name="name"
          type="text"
          value={values.name}
          onChange={(event) => updateField("name", event.target.value)}
          placeholder="Your name"
          autoComplete="name"
          aria-invalid={Boolean(errors.name)}
          aria-describedby={errors.name ? "contact-name-error" : undefined}
          className={`${inputClassName} ${
            errors.name
              ? "border-rose-400/60 focus:border-rose-400 focus:ring-rose-400/30"
              : "border-slate-700 focus:border-sky-500 focus:ring-sky-500/30"
          }`}
        />
        {errors.name && (
          <p id="contact-name-error" className="mt-1 text-xs text-rose-300">
            {errors.name}
          </p>
        )}
      </div>

      <div>
        <label htmlFor="contact-email" className="text-xs uppercase tracking-[0.14em] text-slate-400">
          Email
        </label>
        <input
          id="contact-email"
          name="email"
          type="email"
          value={values.email}
          onChange={(event) => updateField("email", event.target.value)}
          placeholder="you@company.com"
          autoComplete="email"
          inputMode="email"
          aria-invalid={Boolean(errors.email)}
          aria-describedby={errors.email ? "contact-email-error" : undefined}
          className={`${inputClassName} ${
            errors.email
              ? "border-rose-400/60 focus:border-rose-400 focus:ring-rose-400/30"
              : "border-slate-700 focus:border-sky-500 focus:ring-sky-500/30"
          }`}
        />
        {errors.email && (
          <p id="contact-email-error" className="mt-1 text-xs text-rose-300">
            {errors.email}
          </p>
        )}
      </div>

      <div>
        <label htmlFor="contact-subject" className="text-xs uppercase tracking-[0.14em] text-slate-400">
          Subject
        </label>
        <input
          id="contact-subject"
          name="subject"
          type="text"
          value={values.subject}
          onChange={(event) => updateField("subject", event.target.value)}
          placeholder="How can we help?"
          aria-invalid={Boolean(errors.subject)}
          aria-describedby={errors.subject ? "contact-subject-error" : undefined}
          className={`${inputClassName} ${
            errors.subject
              ? "border-rose-400/60 focus:border-rose-400 focus:ring-rose-400/30"
              : "border-slate-700 focus:border-sky-500 focus:ring-sky-500/30"
          }`}
        />
        {errors.subject && (
          <p id="contact-subject-error" className="mt-1 text-xs text-rose-300">
            {errors.subject}
          </p>
        )}
      </div>

      <div>
        <label htmlFor="contact-message" className="text-xs uppercase tracking-[0.14em] text-slate-400">
          Message
        </label>
        <textarea
          id="contact-message"
          name="message"
          value={values.message}
          onChange={(event) => updateField("message", event.target.value)}
          rows={6}
          placeholder="Share details about your issue, feature request, or compliance question."
          aria-invalid={Boolean(errors.message)}
          aria-describedby={errors.message ? "contact-message-error" : undefined}
          className={`${inputClassName} ${
            errors.message
              ? "border-rose-400/60 focus:border-rose-400 focus:ring-rose-400/30"
              : "border-slate-700 focus:border-sky-500 focus:ring-sky-500/30"
          }`}
        />
        {errors.message && (
          <p id="contact-message-error" className="mt-1 text-xs text-rose-300">
            {errors.message}
          </p>
        )}
      </div>

      <button
        type="submit"
        disabled={isSubmitting}
        aria-label={isSubmitting ? "Sending contact form message" : "Send contact form message"}
        className="pressable min-h-11 rounded-lg border border-slate-700 bg-slate-950/80 px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-200 transition hover:border-sky-500/60 hover:text-sky-200 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isSubmitting ? "Sending..." : "Send message"}
      </button>
    </form>
  );
}

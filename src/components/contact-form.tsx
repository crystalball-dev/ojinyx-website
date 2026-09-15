"use client";

import { useState, type FormEvent } from "react";
import { pillOutline, pillSolid } from "./pill";

type Status =
  | { kind: "idle" }
  | { kind: "sending" }
  | { kind: "sent" }
  | { kind: "unconfigured" }
  | { kind: "error"; message: string };

const field =
  "w-full rounded-2xl border-2 border-current/20 bg-transparent px-5 py-4 text-base outline-none transition-colors placeholder:text-muted/70 focus:border-accent";

/**
 * Posts to /api/contact. If the API says mail isn't configured (503) or the
 * network fails, the visitor gets a prefilled mailto: so the message is never
 * lost.
 */
export function ContactForm({ email }: { email: string }) {
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [draft, setDraft] = useState({ name: "", email: "", message: "" });

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = Object.fromEntries(new FormData(form)) as Record<string, string>;
    setDraft({ name: data.name ?? "", email: data.email ?? "", message: data.message ?? "" });
    setStatus({ kind: "sending" });

    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(data),
      });
      if (res.ok) {
        setStatus({ kind: "sent" });
        form.reset();
        return;
      }
      if (res.status === 503) {
        setStatus({ kind: "unconfigured" });
        return;
      }
      const body = (await res.json().catch(() => null)) as { error?: string } | null;
      setStatus({ kind: "error", message: body?.error ?? `Something went wrong (${res.status}).` });
    } catch {
      setStatus({ kind: "error", message: "Network error." });
    }
  }

  const mailto = `mailto:${email}?subject=${encodeURIComponent(`Message from ${draft.name || "the website"}`)}&body=${encodeURIComponent(
    `${draft.message}${draft.email ? `\n\n— ${draft.name} <${draft.email}>` : ""}`,
  )}`;

  const sending = status.kind === "sending";

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate={false}>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-2">
          <span className="label text-muted">Name</span>
          <input name="name" type="text" required maxLength={100} autoComplete="name" className={field} placeholder="Your name" />
        </label>
        <label className="flex flex-col gap-2">
          <span className="label text-muted">Email</span>
          <input name="email" type="email" required maxLength={200} autoComplete="email" className={field} placeholder="you@example.com" />
        </label>
      </div>
      <label className="flex flex-col gap-2">
        <span className="label text-muted">Message</span>
        <textarea name="message" required minLength={2} maxLength={4000} rows={6} className={field} placeholder="Bookings, remixes, sync, hello…" />
      </label>

      {/* Honeypot: hidden from people, tempting to bots. */}
      <div className="absolute -left-[9999px] top-auto h-px w-px overflow-hidden" aria-hidden="true">
        <label>
          Website
          <input name="website" type="text" tabIndex={-1} autoComplete="off" />
        </label>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-4">
        <button type="submit" disabled={sending} className={pillSolid + " disabled:opacity-60"}>
          {sending ? "Sending…" : "Send it"}
        </button>
        <a href={`mailto:${email}`} className="label text-muted underline-offset-4 hover:underline">
          or email directly
        </a>
      </div>

      <p role="status" aria-live="polite" className="min-h-6 text-sm">
        {status.kind === "sent" ? <span>Sent. Thanks — expect a reply soon.</span> : null}
        {status.kind === "error" ? (
          <span>
            {status.message}{" "}
            <a href={mailto} className="underline underline-offset-4">
              Send it by email instead ↗
            </a>
          </span>
        ) : null}
        {status.kind === "unconfigured" ? (
          <span className="inline-flex flex-wrap items-center gap-3">
            The inbox isn&apos;t wired up yet.
            <a href={mailto} className={pillOutline + " px-4 py-2"}>
              Open your email app with this message
            </a>
          </span>
        ) : null}
      </p>
    </form>
  );
}

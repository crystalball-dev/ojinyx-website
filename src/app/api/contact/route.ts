import { NextResponse } from "next/server";
import { site } from "@/content/site";

/**
 * POST /api/contact
 * Validates, filters bots, and delivers via Resend's REST API (no SDK).
 *
 * Responses:
 *   200 { ok: true }           delivered
 *   400 { error }              invalid input
 *   429 { error }              too many messages from this IP (best-effort, per instance)
 *   502 { error }              mail provider failed
 *   503 { error }              RESEND_API_KEY not configured → client offers mailto fallback
 */

const MAX = { name: 100, email: 200, message: 4000 };
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const RESEND_TIMEOUT_MS = 10000;

// Best-effort limiter. Serverless instances don't share memory, so this only
// blunts bursts against a single warm instance — the honeypot and provider
// limits do the real work. Swap for Upstash/Vercel WAF if abuse shows up.
const hits = new Map<string, number[]>();
const WINDOW_MS = 10 * 60 * 1000;
const LIMIT = 5;

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  recent.push(now);
  hits.set(ip, recent);
  if (hits.size > 1000) hits.clear();
  return recent.length > LIMIT;
}

const clean = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] ?? c);

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  // Honeypot filled → pretend success, tell the bot nothing.
  if (clean(body.website, 50)) return NextResponse.json({ ok: true });

  const name = clean(body.name, MAX.name);
  const email = clean(body.email, MAX.email);
  const message = clean(body.message, MAX.message);

  if (!name || !email || !message) return NextResponse.json({ error: "Name, email and message are all required." }, { status: 400 });
  if (!EMAIL_RE.test(email)) return NextResponse.json({ error: "That email address doesn't look right." }, { status: 400 });

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (rateLimited(ip)) return NextResponse.json({ error: "Too many messages — try again in a few minutes." }, { status: 429 });

  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.CONTACT_TO_EMAIL || site.email;
  const from = process.env.CONTACT_FROM_EMAIL;
  if (!apiKey || !to || !from) {
    return NextResponse.json({ error: "Contact form is not configured." }, { status: 503 });
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
      body: JSON.stringify({
        from: `${site.name} site <${from}>`,
        to: [to],
        reply_to: email,
        subject: `[${site.name}] Message from ${name}`,
        text: `From: ${name} <${email}>\n\n${message}`,
        html: `<p><strong>From:</strong> ${escapeHtml(name)} &lt;${escapeHtml(email)}&gt;</p><p style="white-space:pre-wrap">${escapeHtml(message)}</p>`,
      }),
      signal: AbortSignal.timeout(RESEND_TIMEOUT_MS),
    });

    if (!res.ok) {
      console.error("[contact] Resend responded", res.status, await res.text().catch(() => ""));
      return NextResponse.json({ error: "Couldn't send right now." }, { status: 502 });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[contact] delivery failed", err);
    return NextResponse.json({ error: "Couldn't send right now." }, { status: 502 });
  }
}

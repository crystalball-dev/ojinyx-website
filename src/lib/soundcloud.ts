import { site } from "@/content/site";

/**
 * SoundCloud helpers.
 *
 * Two public, unauthenticated sources are used:
 *
 *   • the per-user RSS feed at feeds.soundcloud.com, which lists every public
 *     upload newest-first with title, permalink, date, duration and artwork.
 *     This is what makes the WIP page live.
 *   • the oEmbed endpoint, for resolving a single hand-picked URL.
 *
 * Playback always goes through SoundCloud's official widget (see
 * <SoundCloudEmbed/>), loaded only after a click, so their player, stats and
 * attribution stay intact. The RSS enclosure URLs are deliberately not used
 * as a direct audio source.
 *
 * Every function here resolves rather than throws: a dead feed degrades to an
 * empty list and the page falls back to whatever is pinned in content.
 */

export interface SoundCloudMeta {
  title: string;
  author?: string;
  thumbnail?: string;
  description?: string;
}

export type SoundCloudResult =
  | { ok: true; url: string; meta: SoundCloudMeta }
  | { ok: false; url: string; reason: string };

/** One upload, as read from the public RSS feed. */
export interface SoundCloudTrack {
  /** Numeric track id from the feed's guid. Stable across renames. */
  id: string;
  title: string;
  url: string;
  /** ISO timestamp, or undefined when the feed omits/malforms it. */
  publishedAt?: string;
  /** "4:18" */
  duration?: string;
  artwork?: string;
}

const OEMBED = "https://soundcloud.com/oembed";
const TIMEOUT_MS = 6000;
/** Uploads change rarely; an hour keeps the page fresh without hammering the feed. */
const FEED_REVALIDATE_SECONDS = 3600;

export function isSoundCloudUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname;
    return host === "soundcloud.com" || host.endsWith(".soundcloud.com");
  } catch {
    return false;
  }
}

/** "https://soundcloud.com/me/late-night-demo-v2" → "Late Night Demo V2" */
export function humanizeTrackUrl(url: string): string {
  try {
    const segments = new URL(url).pathname.split("/").filter(Boolean);
    const last = segments[segments.length - 1] ?? "Untitled";
    return last
      .replace(/[-_]+/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase())
      .trim();
  } catch {
    return "Untitled";
  }
}

export async function fetchSoundCloudMeta(url: string): Promise<SoundCloudResult> {
  if (!isSoundCloudUrl(url)) return { ok: false, url, reason: "not a soundcloud.com URL" };
  try {
    const res = await fetch(`${OEMBED}?format=json&url=${encodeURIComponent(url)}`, {
      headers: { accept: "application/json" },
      next: { revalidate: 86400 },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) return { ok: false, url, reason: `HTTP ${res.status}` };
    const json: unknown = await res.json();
    if (!json || typeof json !== "object" || typeof (json as { title?: unknown }).title !== "string") {
      return { ok: false, url, reason: "malformed oEmbed response" };
    }
    const j = json as { title: string; author_name?: string; thumbnail_url?: string; description?: string };
    return {
      ok: true,
      url,
      meta: {
        title: j.title,
        author: typeof j.author_name === "string" ? j.author_name : undefined,
        thumbnail: typeof j.thumbnail_url === "string" && /^https:\/\//.test(j.thumbnail_url) ? j.thumbnail_url : undefined,
        description: typeof j.description === "string" ? j.description : undefined,
      },
    };
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    console.warn(`[soundcloud] oEmbed failed for ${url}: ${reason}`);
    return { ok: false, url, reason };
  }
}

/** Official widget URL. `color` is a hex string with or without "#". */
export function widgetUrl(url: string, opts: { autoPlay?: boolean; color?: string } = {}): string {
  const params = new URLSearchParams({
    url,
    color: `#${(opts.color ?? "ff2bd6").replace("#", "")}`,
    auto_play: String(opts.autoPlay ?? false),
    hide_related: "true",
    show_comments: "false",
    show_user: "true",
    show_reposts: "false",
    show_teaser: "false",
    visual: "true",
  });
  return `https://w.soundcloud.com/player/?${params.toString()}`;
}

// ---------------------------------------------------------------------------
// Live feed

/** Minimal XML text decoding — the feed is small and its shape is fixed. */
function decodeXml(value: string): string {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, d: string) => String.fromCodePoint(Number(d)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h: string) => String.fromCodePoint(parseInt(h, 16)))
    // "&amp;" last, so an escaped entity like "&amp;lt;" survives intact.
    .replace(/&amp;/g, "&")
    .trim();
}

function readTag(item: string, name: string): string | undefined {
  const match = new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, "i").exec(item);
  return match ? decodeXml(match[1]) : undefined;
}

function readAttr(item: string, name: string, attribute: string): string | undefined {
  const match = new RegExp(`<${name}\\b[^>]*?\\s${attribute}="([^"]*)"`, "i").exec(item);
  return match ? decodeXml(match[1]) : undefined;
}

/** "00:04:18" → "4:18"; "01:02:03" → "62:03". */
function formatDuration(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  const parts = raw.split(":").map((p) => Number(p));
  if (parts.some((p) => !Number.isFinite(p))) return undefined;
  const seconds = parts.reduce((acc, p) => acc * 60 + p, 0);
  if (seconds <= 0) return undefined;
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

/** SoundCloud serves artwork at a size suffix; 3000px is far more than a card needs. */
function scaleArtwork(url: string | undefined): string | undefined {
  if (!url || !/^https:\/\//.test(url)) return undefined;
  return url.replace(/-t\d+x\d+\.(jpg|png)$/i, "-t500x500.$1");
}

let cachedUserId: string | undefined;

/**
 * The numeric user id behind the RSS feed. Uses the configured value when set,
 * otherwise reads it once from the public profile page.
 */
async function resolveUserId(): Promise<string | undefined> {
  const configured = site.soundcloudUserId?.trim();
  if (configured) return configured;
  if (cachedUserId) return cachedUserId;
  if (!site.soundcloudProfile) return undefined;
  try {
    const res = await fetch(site.soundcloudProfile, {
      headers: { accept: "text/html" },
      next: { revalidate: 86400 },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) return undefined;
    const match = /soundcloud:users:(\d+)/.exec(await res.text());
    cachedUserId = match?.[1];
    return cachedUserId;
  } catch {
    return undefined;
  }
}

/**
 * The artist's most recent public uploads, newest first.
 * Returns an empty array on any failure — never throws.
 */
export async function fetchLatestSoundCloudTracks(limit = 12): Promise<SoundCloudTrack[]> {
  const userId = await resolveUserId();
  if (!userId) {
    console.warn("[soundcloud] no user id available; skipping live feed");
    return [];
  }

  try {
    const res = await fetch(`https://feeds.soundcloud.com/users/soundcloud:users:${userId}/sounds.rss`, {
      headers: { accept: "application/rss+xml, application/xml, text/xml" },
      next: { revalidate: FEED_REVALIDATE_SECONDS },
      signal: AbortSignal.timeout(TIMEOUT_MS * 2),
    });
    if (!res.ok) {
      console.warn(`[soundcloud] feed returned HTTP ${res.status}`);
      return [];
    }

    const xml = await res.text();
    const tracks: SoundCloudTrack[] = [];

    for (const match of xml.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
      const item = match[1];
      const title = readTag(item, "title");
      const url = readTag(item, "link");
      // The feed contains the occasional empty <item></item>; skip anything unusable.
      if (!title || !url || !isSoundCloudUrl(url)) continue;

      const published = readTag(item, "pubDate");
      const parsed = published ? new Date(published) : undefined;

      tracks.push({
        id: /tracks\/(\d+)/.exec(readTag(item, "guid") ?? "")?.[1] ?? url,
        title,
        url,
        publishedAt: parsed && !Number.isNaN(parsed.getTime()) ? parsed.toISOString() : undefined,
        duration: formatDuration(readTag(item, "itunes:duration")),
        artwork: scaleArtwork(readAttr(item, "itunes:image", "href")),
      });

      if (tracks.length >= limit) break;
    }

    return tracks;
  } catch (err) {
    console.warn("[soundcloud] live feed failed:", err instanceof Error ? err.message : err);
    return [];
  }
}

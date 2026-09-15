/**
 * SoundCloud helpers.
 *
 * Embedding uses SoundCloud's official widget (the only sanctioned way to
 * stream their audio). We never load it eagerly: the WIP page renders a
 * lightweight facade (thumbnail + play button) and only mounts the iframe on
 * click, so the widget's JS never touches first load.
 *
 * Metadata (title, artwork) comes from the public oEmbed endpoint at build
 * time, cached + revalidated daily by Next's data cache. Failures degrade to
 * a plain link card.
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

const OEMBED = "https://soundcloud.com/oembed";
const TIMEOUT_MS = 6000;

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

/** Official widget URL. `color` is a hex string without "#". */
export function widgetUrl(url: string, opts: { autoPlay?: boolean; color?: string } = {}): string {
  const params = new URLSearchParams({
    url,
    color: `#${(opts.color ?? "c6ff00").replace("#", "")}`,
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

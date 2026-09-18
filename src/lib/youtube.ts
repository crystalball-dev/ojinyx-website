/**
 * YouTube helpers for the release pages.
 *
 * Content files take whatever YouTube hands you — the share link, the address
 * bar, or a bare id — because copying the wrong one of those is the easiest
 * mistake to make and the hardest to spot once the page renders an empty box.
 */

/** Eleven characters of [A-Za-z0-9_-]. YouTube has used this shape throughout. */
const ID = /^[\w-]{11}$/;

/**
 * Pull the video id out of any form YouTube gives you. Returns null for
 * anything unrecognized, so callers can skip rendering rather than embed a
 * broken player.
 *
 *   youTubeId("dQw4w9WgXcQ")                                  → "dQw4w9WgXcQ"
 *   youTubeId("https://youtu.be/dQw4w9WgXcQ?si=abc")           → "dQw4w9WgXcQ"
 *   youTubeId("https://www.youtube.com/watch?v=dQw4w9WgXcQ")   → "dQw4w9WgXcQ"
 *   youTubeId("https://www.youtube.com/embed/dQw4w9WgXcQ")     → "dQw4w9WgXcQ"
 *   youTubeId("https://www.youtube.com/shorts/dQw4w9WgXcQ")    → "dQw4w9WgXcQ"
 *   youTubeId("")                                             → null
 */
export function youTubeId(input?: string): string | null {
  const raw = input?.trim();
  if (!raw) return null;
  if (ID.test(raw)) return raw;

  try {
    const url = new URL(raw);
    const host = url.hostname.replace(/^www\./, "");

    if (host === "youtu.be") {
      const id = url.pathname.slice(1).split("/")[0];
      return ID.test(id) ? id : null;
    }

    if (host === "youtube.com" || host === "m.youtube.com" || host === "youtube-nocookie.com") {
      const v = url.searchParams.get("v");
      if (v && ID.test(v)) return v;
      // /embed/<id>, /shorts/<id>, /live/<id>, /v/<id>
      const [, kind, id] = url.pathname.split("/");
      if (["embed", "shorts", "live", "v"].includes(kind) && ID.test(id ?? "")) return id;
    }
  } catch {
    // Not a URL. Fall through — a malformed string is not an error worth
    // throwing on a page render; it just means there is no video to show.
  }
  return null;
}

/** Canonical watch URL, for the "open on YouTube" fallback link. */
export const watchUrl = (id: string) => `https://www.youtube.com/watch?v=${id}`;

/**
 * Player URL for the click-to-load iframe. `youtube-nocookie.com` is YouTube's
 * own privacy-preserving host, `rel=0` keeps related videos within this
 * channel, and autoplay is safe here because the iframe only ever mounts in
 * response to a click.
 */
export const embedUrl = (id: string) =>
  `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0&modestbranding=1&playsinline=1`;

/**
 * Poster candidates, best first. `maxresdefault` is only generated for videos
 * uploaded above 720p and 404s otherwise, so the component walks this list on
 * error rather than assuming; `hqdefault` always exists.
 */
export const posterCandidates = (id: string) => [
  `https://i.ytimg.com/vi/${id}/maxresdefault.jpg`,
  `https://i.ytimg.com/vi/${id}/sddefault.jpg`,
  `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
];

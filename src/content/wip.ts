import type { WipTrack } from "./types";

/**
 * Works in progress — public SoundCloud URLs.
 * ─────────────────────────────────────────────────────────────────────────
 * TODO(ojinyx): replace with real track / playlist URLs. Titles and artwork
 * are resolved from SoundCloud's oEmbed endpoint at build time (revalidated
 * daily). If a URL can't be resolved (private, deleted, network hiccup) the
 * card still renders with a plain "open on SoundCloud" link.
 */
export const wipTracks: WipTrack[] = [
  { url: "https://soundcloud.com/ojinyx/demo-one", note: "rough mix, vocals are scratch" },
  { url: "https://soundcloud.com/ojinyx/demo-two", note: "needs a second half" },
  { url: "https://soundcloud.com/ojinyx/demo-three" },
];

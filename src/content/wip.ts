import type { WipTrack } from "./types";

/**
 * Works in progress — public SoundCloud track or playlist URLs.
 * ─────────────────────────────────────────────────────────────────────────
 * Empty on purpose: there are no works in progress posted right now, so the
 * WIP page shows an honest empty state plus a link to the SoundCloud profile.
 *
 * To add one, paste the public URL here. Titles and artwork are resolved from
 * SoundCloud's oEmbed endpoint at build time (revalidated daily), and a URL
 * that can't be resolved still renders as a plain link card.
 *
 *   { url: "https://soundcloud.com/ojinyx/some-demo", note: "rough mix" },
 */
export const wipTracks: WipTrack[] = [];

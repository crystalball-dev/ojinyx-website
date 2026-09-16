import type { WipTrack } from "./types";

/**
 * Works in progress.
 * ─────────────────────────────────────────────────────────────────────────
 * The WIP page is LIVE: it reads the latest public uploads straight from the
 * SoundCloud RSS feed every hour, so posting a track there puts it on the
 * site with no redeploy. `site.wipFeedLimit` controls how many are shown.
 *
 * This list is only for pinning. Anything here is shown first, above the
 * feed, and is de-duplicated against it — useful for keeping one track at the
 * top or attaching a note the SoundCloud description doesn't carry.
 *
 *   { url: "https://soundcloud.com/ojinyx/some-demo", note: "rough mix" },
 */
export const wipTracks: WipTrack[] = [];

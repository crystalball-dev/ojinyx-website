import type { Release } from "./types";

/**
 * Discography.
 * ─────────────────────────────────────────────────────────────────────────
 * Artwork is picked up automatically: `npm run covers` turns
 * _ANIMATIONS/<ALBUM>/DONE/*.mp4 into web-ready clips + a poster frame under
 * /public/covers, keyed by the slugified folder name. The entry here only
 * needs a matching `slug` plus the words around it.
 *
 * Ordering: newest `releaseDate` first; entries without a date are treated as
 * upcoming and sort to the top in the order written here.
 *
 * TODO(ojinyx): fill in dates, types, descriptions, tracklists and streaming
 * links for each release below.
 */
export const releases: Release[] = [
  {
    slug: "war-on-drugs",
    title: "War On Drugs",
    type: "album", // TODO: album / ep / single
    // releaseDate: "2026-01-01", // TODO
    // description: "…",
    links: {},
  },
  {
    slug: "bunny",
    title: "Bunny",
    type: "single", // TODO
    // releaseDate: "2025-01-01", // TODO
    links: {},
  },
  {
    slug: "kingdoms",
    title: "Kingdoms", // artwork reads KINGDØMS — change to "Kingdøms" if that's the official spelling
    type: "album", // TODO
    // releaseDate: "2024-01-01", // TODO
    links: {},
  },
];

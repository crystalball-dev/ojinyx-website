import type { Release } from "./types";

/**
 * Discography.
 * ─────────────────────────────────────────────────────────────────────────
 * House style: record and song titles are ALWAYS allcaps ("KINGDOMS",
 * "THE HILLS"). Everything is released through OPERATION FAIRWAY, which is
 * applied automatically — only set `label` on a release that came out
 * somewhere else.
 *
 * Dates, tracklists, durations and store links below were taken from the
 * Apple Music catalogue, the Spotify discography and the YouTube Music
 * channel. Track titles are normalised to allcaps to match the house style;
 * the WAR ON DRUGS metadata predates it and reads title case on Apple.
 *
 * Artwork comes from `npm run covers`, which maps each _ANIMATIONS/<ALBUM>
 * folder to a slug. THE HILLS artwork lives in the folder named BUNNY, after
 * its lead track — see ALBUM_SLUGS in scripts/import-covers.mjs.
 */
export const releases: Release[] = [
  {
    slug: "kingdoms",
    title: "KINGDOMS",
    type: "album",
    releaseDate: "2026-09-11",
    // Shares a release date with THE HILLS; this one leads.
    featured: true,
    links: {
      spotify: "https://open.spotify.com/album/5AAZG5ZaXWhadOu63Vlmaj",
      apple: "https://music.apple.com/album/kingdoms/6810581906",
      youtubeMusic: "https://music.youtube.com/browse/MPREb_pArK3N0e0dO",
    },
    tracks: [
      { title: "SNOW WHITE", duration: "3:25" },
      { title: "WIPED OUT", duration: "2:29" },
      { title: "XION", duration: "4:04" },
      { title: "EXCALIPOOR", duration: "4:10" },
      { title: "BLACK EELS", duration: "5:11" },
      { title: "BLAZE IT UP", duration: "2:58" },
      { title: "GOBLIN$", duration: "2:42" },
      { title: "MANDATORY SAFETY MEETING", duration: "2:59" },
      { title: "STAR PLATINUM", duration: "3:12" },
      { title: "MOONSUGAR", duration: "4:44" },
      { title: "KALT", duration: "5:52" },
      { title: "SCALES", duration: "3:53" },
      { title: "STFU I'M ON THE RADIO", duration: "3:12" },
      { title: "HOLLOW", duration: "2:13" },
      { title: "LOTR", duration: "4:55" },
      { title: "THE SERPENT TRENCH", duration: "3:07" },
      { title: "NIGHT", duration: "4:30" },
    ],
  },
  {
    slug: "the-hills",
    title: "THE HILLS",
    type: "ep",
    releaseDate: "2026-09-11",
    links: {
      spotify: "https://open.spotify.com/album/6KEb8NDHgixY5zzOX48Qr8",
      apple: "https://music.apple.com/album/the-hills-ep/6810909398",
      youtubeMusic: "https://music.youtube.com/browse/MPREb_P78nMAS4uNW",
    },
    tracks: [
      { title: "BUNNY", duration: "3:12" },
      { title: "GOLD", duration: "3:30" },
      { title: "DUI", duration: "3:24" },
      { title: "DAMN THE TORPEDOES", duration: "1:46" },
    ],
  },
  {
    slug: "war-on-drugs",
    title: "WAR ON DRUGS",
    type: "ep",
    releaseDate: "2024-04-12",
    // Not currently listed on Spotify; Apple Music and YouTube Music only.
    links: {
      apple: "https://music.apple.com/album/war-on-drugs-ep/1738759827",
      youtubeMusic: "https://music.youtube.com/browse/MPREb_Lxi10OWPsM0",
    },
    tracks: [
      { title: "MIND EXPANDING", duration: "3:01" },
      { title: "WAR ON DRUGS", duration: "1:50" },
      { title: "KILL ALL HUMANS", duration: "3:34" },
      { title: "ALL HUMANS ARE VERMIN IN THE EYES OF MORBO", duration: "2:31" },
    ],
  },
];

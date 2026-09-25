import type { SocialLink } from "./types";

/** Non-breaking space, for keeping a short closing phrase on one line. Visible in source, unlike a literal U+00A0. */
const nbsp = String.fromCharCode(0xa0);

/**
 * Site-wide settings.
 * ─────────────────────────────────────────────────────────────────────────
 * House style, applied everywhere:
 *   • the artist name is ALWAYS lowercase            → "ojinyx"
 *   • record and song titles are ALWAYS allcaps      → "KINGDOMS", "THE HILLS"
 *   • everything is released through OPERATION FAIRWAY
 *
 * Nothing in the CSS forces a case any more, so what you type here is what
 * renders. `npm run dev` warns in the console if a release or track title
 * breaks the allcaps rule.
 */
export const site = {
  /** Artist / project name. Lowercase, always. */
  name: "ojinyx",
  /** The imprint everything is published under. Allcaps. */
  label: "OPERATION FAIRWAY",
  /** The label's own site. Linked from the footer, the hero and the home page stamp. */
  labelUrl: "https://operationfairway.org",
  /** The company behind the label (OPERATION FAIRWAY, LLC, Alaska), for the copyright line and structured data. */
  labelLegalName: "OPERATION FAIRWAY, LLC",
  /** Canonical URL. Override per-environment with NEXT_PUBLIC_SITE_URL. */
  url: (process.env.NEXT_PUBLIC_SITE_URL || "https://ojinyx.com").replace(/\/$/, ""),
  /** One-line hook, shown beside the hero and used in page titles. */
  tagline: "Get lost in the Zone, stalker.",
  /** SEO description (~150 chars). */
  description:
    "ojinyx — independent music project, self-released through OPERATION FAIRWAY. Releases, works in progress, merch and contact.",
  /**
   * Bio paragraphs, shown in the home page About section and in search
   * structured data. American English throughout. Each paragraph ends on a
   * short sign-off joined with `nbsp`, so it never wraps mid-phrase.
   */
  bio: [
    `ojinyx is an independent music project, written, recorded and self-released through OPERATION FAIRWAY. Every track is boldly experimental — crossing genre lines without regard for expectations. Enjoy${nbsp}responsibly.`,
    `Each record builds an altered reality. The colors on this site come straight from the covers. No${nbsp}two${nbsp}alike.`,
  ],
  /** Closing line of the bio, set as a refrain. Keep verbatim. */
  refrain: "Get lost in the Zone, stalker. OPERATION FAIRWAY.",
  /** Optional. Shown in the footer and about section; leave empty to hide. TODO(ojinyx). */
  location: "",
  /** Where the contact form + mailto fallback point. */
  email: "hello@ojinyx.com",
  /** Public SoundCloud profile (used on the WIP page). */
  soundcloudProfile: "https://soundcloud.com/ojinyx",
  /**
   * Numeric SoundCloud user id, used to read the public RSS feed that powers
   * the live WIP list. Leave it empty and the feed is resolved from the
   * profile URL instead, at the cost of one extra request per build.
   * To find it by hand: open the profile, view source, search "soundcloud:users:".
   */
  soundcloudUserId: "949570600",
  /** How many of the latest SoundCloud uploads the WIP page shows. */
  wipFeedLimit: 12,
  /** Storefront listing everything for sale. Shown as a button on the merch page; leave empty to hide. */
  merchStoreUrl: "https://kunaki.com/msales.asp?PublisherId=249214&pp=1",
  /** Button text for `merchStoreUrl`. */
  merchStoreLabel: "All CDs on Kunaki",
  /** Genre tags shown in the about section and used in structured data. */
  genres: ["Electronic", "Hip Hop & Rap", "Experimental"],
  /** Artist profiles. Entries with an empty href are dropped automatically. */
  socials: [
    { label: "Spotify", href: "https://open.spotify.com/artist/3mpVwDRoOxK71JARKm0Tm0" },
    { label: "Apple Music", href: "https://music.apple.com/artist/ojinyx/1556812806" },
    { label: "YouTube Music", href: "https://music.youtube.com/channel/UCil1y5ifGKFxhtPgGPhz1-A" },
    { label: "SoundCloud", href: "https://soundcloud.com/ojinyx" },
    { label: "Instagram", href: "https://instagram.com/ojinyx" },
    { label: "Bandcamp", href: "" },
    { label: "TikTok", href: "" },
  ].filter((s): s is SocialLink => Boolean(s.href)),
};

export type Site = typeof site;

export const NAV = [
  { href: "/", label: "HOME" },
  { href: "/releases", label: "RELEASES" },
  { href: "/wip", label: "WIP" },
  { href: "/merch", label: "MERCH" },
  { href: "/contact", label: "CONTACT" },
] as const;

if (process.env.NODE_ENV !== "production") {
  if (site.name !== site.name.toLowerCase()) console.warn(`[content] the artist name should be lowercase, got "${site.name}"`);
  if (site.label !== site.label.toUpperCase()) console.warn(`[content] the label should be allcaps, got "${site.label}"`);
}

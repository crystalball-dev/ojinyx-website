import type { SocialLink } from "./types";

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
  /** Canonical URL. Override per-environment with NEXT_PUBLIC_SITE_URL. */
  url: (process.env.NEXT_PUBLIC_SITE_URL || "https://ojinyx.com").replace(/\/$/, ""),
  /** One-line hook, shown beside the hero and used in page titles. */
  tagline: "Get lost in the Zone, stalker.",
  /** SEO description (~150 chars). */
  description:
    "ojinyx — independent music project, self-released through OPERATION FAIRWAY. Releases, works in progress, merch and contact.",
  /**
   * Bio paragraphs.
   * TODO(ojinyx): these two are placeholder — rewrite in your own words.
   */
  bio: [
    "ojinyx is an independent music project, written, recorded and self-released through OPERATION FAIRWAY.",
    "Every record gets its own colour world, pulled straight from the artwork. This site does the same.",
  ],
  /** Closing line of the bio, set as a refrain. Keep verbatim. */
  refrain: "Get lost in the Zone, stalker. OPERATION FAIRWAY.",
  /** Optional. Shown in the footer and about section; leave empty to hide. TODO(ojinyx). */
  location: "",
  /** Where the contact form + mailto fallback point. */
  email: "hello@ojinyx.com",
  /** Public SoundCloud profile (used on the WIP page). */
  soundcloudProfile: "https://soundcloud.com/ojinyx",
  /** External store for merch. Leave empty to show "coming soon" on every item. */
  merchStoreUrl: "",
  /** Genre tags shown in the about section and used in structured data. TODO(ojinyx): confirm. */
  genres: ["electronic", "alt-pop", "noise"],
  socials: [
    { label: "Instagram", href: "https://instagram.com/ojinyx" },
    { label: "SoundCloud", href: "https://soundcloud.com/ojinyx" },
    { label: "Spotify", href: "" },
    { label: "Bandcamp", href: "" },
    { label: "YouTube", href: "" },
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

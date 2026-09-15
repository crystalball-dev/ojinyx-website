import type { SocialLink } from "./types";

/**
 * Site-wide settings.
 * ─────────────────────────────────────────────────────────────────────────
 * TODO(ojinyx): replace every placeholder below with the real thing.
 */
export const site = {
  /** Artist / project name. Rendered at poster size on the home page. */
  name: "OJINYX",
  /** Canonical URL. Override per-environment with NEXT_PUBLIC_SITE_URL. */
  url: (process.env.NEXT_PUBLIC_SITE_URL || "https://ojinyx.com").replace(/\/$/, ""),
  /** One-line hook under the name. */
  tagline: "Loud colours, quiet nights.",
  /** SEO description (~150 chars). */
  description: "OJINYX — independent music project. Releases, works in progress, merch and contact.",
  /** Short bio paragraphs for the home page. */
  bio: [
    "OJINYX is an independent music project built on saturated synths, broken drum machines and a refusal to sit still.",
    "Every release gets its own colour world, pulled straight from the artwork. This site does the same.",
  ],
  location: "Somewhere loud",
  /** Where the contact form + mailto fallback point. */
  email: "hello@ojinyx.com",
  /** Public SoundCloud profile (used on the WIP page). */
  soundcloudProfile: "https://soundcloud.com/ojinyx",
  /** External store for merch. Leave empty to show "coming soon" on every item. */
  merchStoreUrl: "",
  /** Genre tags shown in the about section and used in structured data. */
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
  { href: "/", label: "Home" },
  { href: "/releases", label: "Releases" },
  { href: "/wip", label: "WIP" },
  { href: "/merch", label: "Merch" },
  { href: "/contact", label: "Contact" },
] as const;

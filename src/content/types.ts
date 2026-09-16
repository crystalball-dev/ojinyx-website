/**
 * Content types. Everything editable about the site lives in src/content/*.ts
 * and conforms to these shapes. Optional fields may be omitted or left empty;
 * every component treats missing data as "don't render that bit", never as an
 * error.
 */

export type StreamingService =
  | "spotify"
  | "apple"
  | "youtubeMusic"
  | "bandcamp"
  | "youtube"
  | "soundcloud"
  | "tidal"
  | "deezer"
  | "amazon";

export const STREAMING_SERVICE_LABELS: Record<StreamingService, string> = {
  spotify: "Spotify",
  apple: "Apple Music",
  youtubeMusic: "YouTube Music",
  bandcamp: "Bandcamp",
  youtube: "YouTube",
  soundcloud: "SoundCloud",
  tidal: "Tidal",
  deezer: "Deezer",
  amazon: "Amazon Music",
};

export type ReleaseType = "single" | "ep" | "album" | "remix" | "mixtape" | "live";

export interface Track {
  /** House style: song titles are allcaps, e.g. "THE HILLS". */
  title: string;
  /** "3:42" style display string. */
  duration?: string;
  /** Optional short preview clip (mp3/m4a/ogg) — local under /public or absolute URL. */
  previewUrl?: string;
  featuring?: string;
}

/** Web-ready animated cover, as produced by `npm run covers`. */
export interface CoverVideo {
  mp4: string;
  webm?: string;
  /** Small silent variant for cards. */
  mp4Small?: string;
  hasAudio?: boolean;
  /** Seconds. */
  duration?: number;
}

export interface Release {
  /**
   * URL segment: /releases/[slug]. Lowercase, hyphenated. Must match the
   * slugified album folder in _ANIMATIONS/<ALBUM>/DONE for artwork to be
   * picked up automatically ("WAR ON DRUGS" → "war-on-drugs").
   */
  slug: string;
  /** House style: record titles are allcaps, e.g. "KINGDOMS". */
  title: string;
  type: ReleaseType;
  /** ISO date, e.g. "2026-03-14". Drives ordering (newest first); omit for "TBA", which sorts to the top. */
  releaseDate?: string;
  /**
   * Pin this release to the top of the discography and to the home page hero
   * slot. Use when two records share a release date and one should lead.
   * Only the first featured release wins.
   */
  featured?: boolean;
  /** Poster override. Defaults to the frame extracted by `npm run covers`. "/covers/x.jpg" under /public or an absolute https URL. */
  cover?: string;
  /** Animated cover override. Defaults to the clip imported by `npm run covers`. */
  coverVideo?: CoverVideo;
  /** Short blurb shown on the release page. */
  description?: string;
  tracks?: Track[];
  /** Streaming / store URLs. Omit a service to hide its button. */
  links?: Partial<Record<StreamingService, string>>;
  /** Universal smart link (e.g. song.link / linktr.ee) used as the fallback CTA. */
  smartLink?: string;
  credits?: string[];
  /** Imprint. Defaults to site.label (OPERATION FAIRWAY); set only for releases that came out elsewhere. */
  label?: string;
  catalogNumber?: string;
}

export interface WipTrack {
  /** Public SoundCloud track or playlist URL. */
  url: string;
  /** Optional override; otherwise resolved via SoundCloud oEmbed at build. */
  title?: string;
  note?: string;
}

export interface MerchItem {
  id: string;
  name: string;
  /** Display price string, e.g. "$35" or "€30". */
  price?: string;
  image?: string;
  /** External checkout URL (Bandcamp, Shopify, Big Cartel…). */
  url?: string;
  available?: boolean;
  variants?: string[];
}

export interface SocialLink {
  label: string;
  href: string;
}

import manifest from "@/content/covers.generated.json";
import markGradients from "@/content/mark-gradients.generated.json";
import type { Release } from "@/content/types";

/**
 * Resolves the artwork for a release: an explicit `cover` / `coverVideo` in
 * releases.ts wins, otherwise the assets produced by `npm run covers` for a
 * matching slug are used. Everything is optional — a release with no
 * artwork at all still renders (with a colored fallback tile).
 */

export interface CoverVideo {
  mp4: string;
  webm?: string;
  /** Small silent variant for cards. */
  mp4Small?: string;
  hasAudio?: boolean;
  duration?: number;
}

export interface CoverMedia {
  poster?: string;
  video?: CoverVideo;
}

interface ManifestEntry {
  poster: string;
  mp4: string;
  webm?: string;
  mp4Small?: string;
  hasAudio?: boolean;
  duration?: number;
}

interface Manifest {
  generatedAt: string;
  hero: ManifestEntry | null;
  covers: Record<string, ManifestEntry>;
}

const data = manifest as unknown as Manifest;

function toVideo(entry: ManifestEntry | null | undefined): CoverVideo | undefined {
  if (!entry?.mp4) return undefined;
  return { mp4: entry.mp4, webm: entry.webm, mp4Small: entry.mp4Small, hasAudio: entry.hasAudio, duration: entry.duration };
}

export function getCoverMedia(release: Pick<Release, "slug" | "cover" | "coverVideo">): CoverMedia {
  const generated = data.covers?.[release.slug];
  return {
    poster: release.cover ?? generated?.poster,
    video: release.coverVideo ?? toVideo(generated),
  };
}

/** Home page hero clip (from _ANIMATIONS/MAIN/DONE), if it has been imported. */
export function getHeroMedia(): CoverMedia {
  return { poster: data.hero?.poster, video: toVideo(data.hero) };
}

const HEX = /^#[0-9a-f]{6}$/i;

/**
 * The three gradient stops for a record's wordmark, written by
 * `npm run merch-art` so the site and the printed merch use the same colors.
 * Returns undefined unless all three are well-formed hex, since these end up
 * inlined in a <style> tag.
 */
export function getMarkGradient(slug: string): [string, string, string] | undefined {
  const stops = (markGradients as Record<string, string[] | undefined>)[slug];
  if (!stops || stops.length < 3 || !stops.slice(0, 3).every((s) => HEX.test(s))) return undefined;
  return [stops[0], stops[1], stops[2]];
}

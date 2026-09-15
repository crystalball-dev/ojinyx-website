import Link from "next/link";
import { ViewTransition } from "react";
import type { Release } from "@/content/types";
import { getCoverMedia } from "@/lib/covers";
import { getCoverTheme } from "@/lib/palette";
import { RELEASE_TYPE_LABEL, releaseYear } from "@/lib/releases";
import { paletteVars } from "@/lib/theme";
import { cn } from "@/lib/utils";
import { CoverMedia } from "./cover-media";

const TILTS = ["-rotate-2", "rotate-1", "-rotate-1", "rotate-2"];

interface ReleaseCardProps {
  release: Release;
  index?: number;
  priority?: boolean;
}

/**
 * Grid card themed by its own extracted palette, so the discography reads
 * as a wall of distinct colour worlds. The animated cover plays on hover
 * (or while in view on touch screens). The artwork carries a view-transition
 * name that matches the release page hero, so it morphs across navigation.
 */
export async function ReleaseCard({ release, index = 0, priority = false }: ReleaseCardProps) {
  const media = getCoverMedia(release);
  const { palette, cover } = await getCoverTheme(media.poster, release.slug);

  return (
    <Link
      href={`/releases/${release.slug}`}
      className="group block h-full outline-none"
      style={paletteVars(palette)}
      aria-label={`${release.title} — ${RELEASE_TYPE_LABEL[release.type]}, ${releaseYear(release.releaseDate)}`}
    >
      <article
        className={cn(
          "shadow-hard-sm flex h-full flex-col gap-4 bg-bg p-4 text-fg transition-transform duration-500 ease-[var(--ease-out-expo)] group-hover:-translate-y-1 group-hover:rotate-0 group-focus-visible:rotate-0 group-focus-visible:ring-4 group-focus-visible:ring-accent",
          TILTS[index % TILTS.length],
        )}
      >
        <ViewTransition name={`cover-${release.slug}`}>
          <div className="relative aspect-square overflow-hidden bg-black/20" style={{ containerType: "inline-size" }}>
            <CoverMedia
              poster={media.poster}
              video={media.video}
              mode="hover"
              small
              alt={`${release.title} cover art`}
              fallbackLabel={release.title}
              blurDataURL={cover.blurDataURL}
              sizes="(min-width: 1280px) 30vw, (min-width: 640px) 45vw, 92vw"
              priority={priority}
            />
          </div>
        </ViewTransition>
        <div className="flex items-end justify-between gap-3">
          <h3 className="display text-[clamp(1.35rem,2.4vw,2rem)]">{release.title}</h3>
          <span className="label whitespace-nowrap text-muted">
            {RELEASE_TYPE_LABEL[release.type]} · {releaseYear(release.releaseDate)}
          </span>
        </div>
        <div className="flex h-2 gap-1" aria-hidden="true">
          {palette.swatches.slice(0, 6).map((hex, i) => (
            <span key={`${hex}-${i}`} className="flex-1" style={{ background: hex }} />
          ))}
        </div>
      </article>
    </Link>
  );
}

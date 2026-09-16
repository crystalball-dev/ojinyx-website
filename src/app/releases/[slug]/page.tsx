import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ViewTransition, type CSSProperties } from "react";
import { Blobs } from "@/components/blobs";
import { CoverMedia } from "@/components/cover-media";
import { Marquee } from "@/components/marquee";
import { ReleaseTheme } from "@/components/release-theme";
import { Reveal } from "@/components/reveal";
import { StreamLinks } from "@/components/stream-links";
import { Swatches } from "@/components/swatches";
import { TiltCard } from "@/components/tilt-card";
import { Tracklist } from "@/components/tracklist";
import { site } from "@/content/site";
import { getCoverMedia } from "@/lib/covers";
import { getCoverTheme } from "@/lib/palette";
import {
  RELEASE_TYPE_LABEL,
  adjacentReleases,
  formatReleaseDate,
  getRelease,
  longestWord,
  releaseLabel,
  releaseYear,
  sortedReleases,
} from "@/lib/releases";
import { safeJsonLd } from "@/lib/utils";

type Props = PageProps<"/releases/[slug]">;

export const dynamicParams = false;

export function generateStaticParams() {
  return sortedReleases.map((r) => ({ slug: r.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const release = getRelease(slug);
  if (!release) return {};
  const description = release.description ?? `${release.title} — ${RELEASE_TYPE_LABEL[release.type]} by ${site.name}.`;
  return {
    title: release.title,
    description,
    alternates: { canonical: `/releases/${release.slug}` },
    openGraph: {
      type: "music.album",
      title: `${release.title} — ${site.name}`,
      description,
      url: `/releases/${release.slug}`,
      releaseDate: release.releaseDate,
      musicians: [site.url],
    },
  };
}

/** Browser chrome (mobile address bar, PWA title bar) matches the artwork. */
export async function generateViewport({ params }: Props): Promise<Viewport> {
  const { slug } = await params;
  const release = getRelease(slug);
  if (!release) return {};
  const { palette } = await getCoverTheme(getCoverMedia(release).poster, release.slug);
  return { themeColor: palette.bg, colorScheme: palette.mode };
}

export default async function ReleasePage({ params }: Props) {
  const { slug } = await params;
  const release = getRelease(slug);
  if (!release) notFound();

  const media = getCoverMedia(release);
  const { palette, cover } = await getCoverTheme(media.poster, release.slug);
  const { prev, next } = adjacentReleases(release.slug);
  const typeLabel = RELEASE_TYPE_LABEL[release.type];
  const upcoming = !release.releaseDate;
  const imprint = releaseLabel(release);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "MusicAlbum",
    name: release.title,
    albumReleaseType: typeLabel,
    datePublished: release.releaseDate,
    image: media.poster ? new URL(media.poster, site.url).toString() : undefined,
    description: release.description,
    url: `${site.url}/releases/${release.slug}`,
    byArtist: { "@type": "MusicGroup", name: site.name, url: site.url },
    recordLabel: { "@type": "Organization", name: imprint },
    numTracks: release.tracks?.length,
    track: release.tracks?.map((t, i) => ({ "@type": "MusicRecording", name: t.title, position: i + 1 })),
  };

  return (
    <ReleaseTheme palette={palette} className="relative min-h-[100svh] overflow-hidden">
      <Blobs colors={[palette.accent, palette.accent2, palette.accent3, palette.accent]} className="opacity-80" />

      <div className="gutter relative z-10 pb-24 pt-28 md:pt-36">
        <nav aria-label="Breadcrumb" className="label text-muted">
          <Link href="/releases" className="underline-offset-4 hover:underline">
            ← Releases
          </Link>
        </nav>

        {/* Header */}
        <header className="mt-10 grid items-start gap-12 md:grid-cols-12 md:gap-8">
          <div className="md:col-span-5">
            <TiltCard className="shadow-hard relative -rotate-2">
              <ViewTransition name={`cover-${release.slug}`}>
                <div className="relative aspect-square overflow-hidden bg-black/20" style={{ containerType: "inline-size" }}>
                  <CoverMedia
                    poster={media.poster}
                    video={media.video}
                    mode="autoplay"
                    sound
                    priority
                    alt={`${release.title} cover art`}
                    fallbackLabel={release.title}
                    blurDataURL={cover.blurDataURL}
                    sizes="(min-width: 768px) 42vw, 92vw"
                  />
                </div>
              </ViewTransition>
            </TiltCard>
          </div>

          <div className="flex flex-col gap-7 md:col-span-7 md:pl-6" style={{ containerType: "inline-size" }}>
            <p className="label text-muted">
              {typeLabel} · {formatReleaseDate(release.releaseDate)} · {imprint}
              {release.catalogNumber ? ` · ${release.catalogNumber}` : ""}
            </p>
            <h1
              className="display fit-title -ml-[0.04em]"
              style={{ "--letters": longestWord(release.title), "--fit-max": "clamp(3rem, 10vw, 9rem)" } as CSSProperties}
            >
              {release.title}
            </h1>
            {release.description ? <p className="max-w-prose text-lg leading-relaxed text-muted md:text-xl">{release.description}</p> : null}
            <StreamLinks release={release} />
          </div>
        </header>

        {/* Ticker in accent */}
        <div className="bleed mt-20 -rotate-1 bg-accent py-2 text-accent-fg">
          <Marquee
            items={[release.title, typeLabel.toUpperCase(), releaseYear(release.releaseDate), imprint, upcoming ? "COMING SOON" : "OUT NOW"].map((t) => (
              <span key={t} className="display text-xl md:text-2xl">
                {t}
              </span>
            ))}
            duration={24}
            reverse
          />
        </div>

        {/* Body */}
        <div className="mt-20 grid gap-16 md:grid-cols-12">
          <Reveal className="md:col-span-7">
            {release.tracks?.length ? (
              <>
                <h2 className="label mb-6 text-muted">
                  Tracklist · {release.tracks.length} {release.tracks.length === 1 ? "track" : "tracks"}
                </h2>
                <Tracklist tracks={release.tracks} />
              </>
            ) : (
              <p className="text-muted">Tracklist coming soon.</p>
            )}
          </Reveal>

          <Reveal delay={0.1} className="flex flex-col gap-10 md:col-span-4 md:col-start-9">
            {release.credits?.length ? (
              <div>
                <h2 className="label mb-4 text-muted">Credits</h2>
                <ul className="flex flex-col gap-2 text-base">
                  {release.credits.map((c) => (
                    <li key={c}>{c}</li>
                  ))}
                </ul>
              </div>
            ) : null}
            <div>
              <h2 className="label mb-4 text-muted">Colour world</h2>
              <Swatches palette={palette} />
            </div>
          </Reveal>
        </div>

        {/* Prev / next */}
        {prev || next ? (
          <nav aria-label="More releases" className="mt-24 grid gap-4 border-t border-current/15 pt-8 sm:grid-cols-2">
            {prev ? (
              <Link href={`/releases/${prev.slug}`} className="group flex flex-col gap-1">
                <span className="label text-muted">← Older</span>
                <span className="display text-3xl underline-offset-8 group-hover:underline">{prev.title}</span>
              </Link>
            ) : (
              <span />
            )}
            {next ? (
              <Link href={`/releases/${next.slug}`} className="group flex flex-col gap-1 sm:items-end sm:text-right">
                <span className="label text-muted">Newer →</span>
                <span className="display text-3xl underline-offset-8 group-hover:underline">{next.title}</span>
              </Link>
            ) : null}
          </nav>
        ) : null}
      </div>

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(jsonLd) }} />
    </ReleaseTheme>
  );
}

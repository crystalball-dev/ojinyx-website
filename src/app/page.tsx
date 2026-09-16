import Link from "next/link";
import { ViewTransition, type CSSProperties } from "react";
import { Blobs } from "@/components/blobs";
import { CoverMedia } from "@/components/cover-media";
import { LabelBadge } from "@/components/label-badge";
import { Marquee } from "@/components/marquee";
import { pillOutline, pillSolid } from "@/components/pill";
import { PointerGlow } from "@/components/pointer-glow";
import { ReleaseTheme } from "@/components/release-theme";
import { Reveal } from "@/components/reveal";
import { SectionHeading } from "@/components/section-heading";
import { StreamLinks } from "@/components/stream-links";
import { TiltCard } from "@/components/tilt-card";
import { Wordmark } from "@/components/wordmark";
import { site } from "@/content/site";
import { getCoverMedia, getHeroMedia } from "@/lib/covers";
import { getCoverTheme } from "@/lib/palette";
import {
  RELEASE_TYPE_LABEL,
  formatReleaseDate,
  latestRelease,
  longestWord,
  releaseLabel,
  releaseYear,
  sortedReleases,
} from "@/lib/releases";
import { paletteVars } from "@/lib/theme";

export default async function HomePage() {
  const hero = getHeroMedia();
  const heroTheme = hero.poster ? await getCoverTheme(hero.poster, "hero") : undefined;

  const latest = latestRelease;
  const latestMedia = latest ? getCoverMedia(latest) : undefined;
  const latestTheme = latest ? await getCoverTheme(latestMedia?.poster, latest.slug) : undefined;

  const others = sortedReleases.slice(1, 6);
  const otherMedia = others.map((r) => getCoverMedia(r));
  const otherThemes = await Promise.all(others.map((r, i) => getCoverTheme(otherMedia[i].poster, r.slug)));

  const tickerItems = latest
    ? [
        `${latest.releaseDate ? "NEW" : "NEXT"} ${RELEASE_TYPE_LABEL[latest.type].toUpperCase()}`,
        latest.title,
        latest.releaseDate ? "OUT NOW" : "COMING SOON",
        site.label,
      ]
    : [site.name, site.label];

  return (
    <>
      {/* ── Hero: the brand clip, center stage ─────────────────────────── */}
      <section className="hero relative overflow-hidden bg-bg">
        <Blobs
          colors={heroTheme ? [heroTheme.palette.accent3, heroTheme.palette.accent, heroTheme.palette.accent2, heroTheme.palette.accent3] : undefined}
          className="opacity-70"
        />
        <PointerGlow />
        <h1 className="sr-only">{site.name}</h1>

        <div className="hero-layout relative min-h-[100svh] gap-x-6 gap-y-8 pb-[max(2rem,env(safe-area-inset-bottom))] pt-20 md:pt-24">
          <div className="hero-side-left gutter flex flex-col gap-3">
            <span className="label text-muted">{site.genres.join(" · ")}</span>
            <p className="display max-w-md text-[clamp(1.25rem,1.9vw,1.75rem)] tracking-tight">{site.tagline}</p>
            <span className="label text-accent">{site.label}</span>
          </div>

          <div className="hero-video-box relative">
            {hero.poster || hero.video ? (
              <CoverMedia
                poster={hero.poster}
                video={hero.video}
                mode="autoplay"
                sound
                priority
                alt={`${site.name} animated wordmark`}
                fallbackLabel={site.name}
                blurDataURL={heroTheme?.cover.blurDataURL}
                sizes="(min-aspect-ratio: 3/2) 100vh, 100vw"
                mediaClassName="hero-video-mask"
              />
            ) : (
              <div className="grid h-full place-items-center">
                <Wordmark decorative className="w-[78%] text-white mix-blend-difference" />
              </div>
            )}
          </div>

          <div className="hero-side-right gutter flex flex-col gap-3">
            <div className="flex flex-wrap gap-3">
              {latest ? (
                <Link href={`/releases/${latest.slug}`} className={pillSolid}>
                  {latest.releaseDate ? "Latest" : "Next"}: {latest.title} <span aria-hidden="true">→</span>
                </Link>
              ) : null}
              <Link href="/releases" className={pillOutline}>
                All releases
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── Ticker ─────────────────────────────────────────────────────── */}
      <div className="relative z-10 -my-4 -rotate-2 bg-accent py-3 text-accent-fg">
        <Marquee
          items={tickerItems.map((t) => (
            <span key={t} className="display text-[clamp(1.25rem,3vw,2.5rem)]">
              {t}
            </span>
          ))}
          duration={22}
        />
      </div>

      {/* ── Latest release ─────────────────────────────────────────────── */}
      {latest && latestTheme ? (
        <ReleaseTheme palette={latestTheme.palette} className="relative overflow-hidden">
          <Blobs colors={[latestTheme.palette.accent, latestTheme.palette.accent2, latestTheme.palette.accent3]} className="opacity-70" />
          <div className="gutter relative z-10 grid items-center gap-10 py-24 md:grid-cols-2 md:gap-16 md:py-32">
            <Reveal>
              <TiltCard className="shadow-hard relative mx-auto w-full max-w-[34rem] -rotate-2">
                <ViewTransition name={`cover-${latest.slug}`}>
                  <div className="relative aspect-square overflow-hidden bg-black/20" style={{ containerType: "inline-size" }}>
                    <CoverMedia
                      poster={latestMedia?.poster}
                      video={latestMedia?.video}
                      mode="inview"
                      alt={`${latest.title} cover art`}
                      fallbackLabel={latest.title}
                      blurDataURL={latestTheme.cover.blurDataURL}
                      sizes="(min-width: 768px) 45vw, 92vw"
                    />
                  </div>
                </ViewTransition>
              </TiltCard>
            </Reveal>
            <Reveal delay={0.1} className="flex flex-col gap-6">
              <span className="label text-muted">
                {latest.releaseDate ? "Latest" : "Next"} {RELEASE_TYPE_LABEL[latest.type]} · {formatReleaseDate(latest.releaseDate)} ·{" "}
                {releaseLabel(latest)}
              </span>
              <div style={{ containerType: "inline-size" }}>
                <h2
                  className="display fit-title"
                  style={{ "--letters": longestWord(latest.title), "--fit-max": "clamp(3rem, 8vw, 7.5rem)" } as CSSProperties}
                >
                  {latest.title}
                </h2>
              </div>
              {latest.description ? <p className="max-w-prose text-lg text-muted">{latest.description}</p> : null}
              <StreamLinks release={latest} />
              <Link href={`/releases/${latest.slug}`} className="label underline-offset-4 hover:underline">
                Release page →
              </Link>
            </Reveal>
          </div>
        </ReleaseTheme>
      ) : null}

      {/* ── About ──────────────────────────────────────────────────────── */}
      <section className="gutter relative overflow-hidden py-24 md:py-36">
        <p aria-hidden="true" className="display text-outline pointer-events-none absolute -right-8 top-6 select-none text-[clamp(6rem,24vw,26rem)] leading-none opacity-30">
          WHO
        </p>
        <div className="relative grid gap-10 md:grid-cols-12">
          <Reveal className="md:col-span-4">
            <span className="label text-muted">About</span>
            <Wordmark className="mt-4 w-full max-w-xs" />
            <ul className="label mt-6 flex flex-wrap gap-2">
              {site.genres.map((g) => (
                <li key={g} className="rounded-full border border-current/30 px-3 py-1">
                  {g}
                </li>
              ))}
            </ul>
          </Reveal>
          <Reveal delay={0.1} className="flex flex-col gap-6 text-xl leading-relaxed md:col-span-7 md:col-start-6 md:text-2xl">
            {site.bio.map((p, i) => (
              <p key={i} className={i === 0 ? "" : "text-muted"}>
                {p}
              </p>
            ))}
            <p className="display mt-2 text-[clamp(1.5rem,3.2vw,2.75rem)] leading-tight text-accent">{site.refrain}</p>
            <div className="mt-4 flex items-center gap-6">
              <LabelBadge text={site.label} className="size-28 shrink-0 text-accent-2 md:size-32" />
              {site.location ? <span className="label text-muted">{site.location}</span> : null}
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── Discography strip ──────────────────────────────────────────── */}
      {others.length ? (
        <section className="overflow-hidden py-8 md:py-16">
          <Reveal className="gutter flex items-end justify-between gap-6">
            <SectionHeading label="Discography" title="MORE" />
            <Link href="/releases" className="label mb-3 whitespace-nowrap underline-offset-4 hover:underline">
              All {sortedReleases.length} →
            </Link>
          </Reveal>
          <ul className="no-scrollbar mt-10 flex snap-x snap-mandatory gap-6 overflow-x-auto px-[var(--gutter)] pb-8 pt-4">
            {others.map((release, i) => {
              const { palette, cover } = otherThemes[i];
              const media = otherMedia[i];
              return (
                <li key={release.slug} className="w-[72vw] max-w-sm shrink-0 snap-start sm:w-[44vw] md:w-[30vw]">
                  <Link
                    href={`/releases/${release.slug}`}
                    className="group block bg-bg p-3 text-fg transition-transform duration-500 ease-[var(--ease-out-expo)] hover:-translate-y-1 hover:-rotate-1"
                    style={paletteVars(palette)}
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
                          sizes="(min-width: 768px) 30vw, 72vw"
                        />
                      </div>
                    </ViewTransition>
                    <div className="mt-3 flex items-end justify-between gap-2">
                      <span className="display text-lg">{release.title}</span>
                      <span className="label text-muted">{releaseYear(release.releaseDate)}</span>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      {/* ── Tiles ──────────────────────────────────────────────────────── */}
      <section className="gutter py-16 md:py-24">
        <Reveal>
          <ul className="grid gap-4 md:grid-cols-3">
            {[
              { href: "/wip", title: "WIP", text: "Sketches, demos and things that might never come out.", bg: "bg-accent-3 text-white" },
              { href: "/merch", title: "MERCH", text: "Wear the colors.", bg: "bg-accent text-accent-fg" },
              { href: "/contact", title: "CONTACT", text: "Bookings, remixes, sync, hello.", bg: "bg-accent-2 text-black" },
            ].map((tile, i) => (
              <li key={tile.href}>
                <Link
                  href={tile.href}
                  className={`group flex min-h-64 flex-col justify-between p-6 transition-transform duration-500 ease-[var(--ease-out-expo)] hover:-translate-y-2 md:min-h-80 ${tile.bg} ${
                    i % 2 ? "rotate-1 hover:rotate-0" : "-rotate-1 hover:rotate-0"
                  }`}
                >
                  <span className="display text-[clamp(2.25rem,4vw,4.25rem)]">{tile.title}</span>
                  <span className="flex items-end justify-between gap-4">
                    <span className="max-w-xs text-lg leading-snug">{tile.text}</span>
                    <span aria-hidden="true" className="display text-4xl transition-transform duration-500 group-hover:translate-x-2">
                      →
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Reveal>
      </section>
    </>
  );
}

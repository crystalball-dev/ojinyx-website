import type { Metadata } from "next";
import { ErrorBoundary } from "@/components/error-boundary";
import { SectionHeading } from "@/components/section-heading";
import { SoundCloudEmbed } from "@/components/soundcloud-embed";
import { pillSolid } from "@/components/pill";
import { site } from "@/content/site";
import { wipTracks } from "@/content/wip";
import { fetchSoundCloudMeta, humanizeTrackUrl } from "@/lib/soundcloud";

export const metadata: Metadata = {
  title: "WIP",
  description: "Works in progress — demos, sketches and unfinished business on SoundCloud.",
  alternates: { canonical: "/wip" },
};

// SoundCloud metadata is fetched at build and refreshed once a day.
export const revalidate = 86400;

export default async function WipPage() {
  const results = await Promise.all(wipTracks.map((t) => fetchSoundCloudMeta(t.url)));
  const unresolved = results.filter((r) => !r.ok).length;

  return (
    <div className="gutter pb-24 pt-32 md:pt-40">
      <div className="flex flex-wrap items-end justify-between gap-6">
        <SectionHeading as="h1" label="Works in progress" title="WIP" />
        {site.soundcloudProfile ? (
          <a href={site.soundcloudProfile} target="_blank" rel="noreferrer" className={pillSolid}>
            SoundCloud profile <span aria-hidden="true">↗</span>
          </a>
        ) : null}
      </div>
      <p className="mt-6 max-w-prose text-xl text-muted">
        Rough mixes, half-ideas and things that may never be finished. Players load on tap, straight from SoundCloud.
      </p>

      {wipTracks.length === 0 ? (
        <p className="mt-16 text-xl text-muted">Nothing in the oven right now.</p>
      ) : (
        <ul className="mt-14 grid gap-8 lg:grid-cols-2">
          {wipTracks.map((track, i) => {
            const result = results[i];
            const title = track.title ?? (result.ok ? result.meta.title : humanizeTrackUrl(track.url));
            const fallback = (
              <a href={track.url} target="_blank" rel="noreferrer" className="display block rounded-3xl border border-current/15 p-8 text-2xl">
                {title} — open on SoundCloud ↗
              </a>
            );
            return (
              <li key={track.url}>
                <ErrorBoundary fallback={fallback}>
                  <SoundCloudEmbed
                    url={track.url}
                    title={title}
                    author={result.ok ? result.meta.author : undefined}
                    thumbnail={result.ok ? result.meta.thumbnail : undefined}
                    note={track.note}
                    resolved={result.ok}
                  />
                </ErrorBoundary>
              </li>
            );
          })}
        </ul>
      )}

      {unresolved > 0 ? (
        <p className="label mt-10 text-muted">
          {unresolved} {unresolved === 1 ? "track" : "tracks"} couldn&apos;t be looked up on SoundCloud right now — the links still work.
        </p>
      ) : null}
    </div>
  );
}

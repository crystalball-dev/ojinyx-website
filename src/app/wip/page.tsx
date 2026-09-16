import type { Metadata } from "next";
import Link from "next/link";
import { ErrorBoundary } from "@/components/error-boundary";
import { pillSolid } from "@/components/pill";
import { SectionHeading } from "@/components/section-heading";
import { SoundCloudEmbed } from "@/components/soundcloud-embed";
import { site } from "@/content/site";
import { wipTracks } from "@/content/wip";
import { fetchLatestSoundCloudTracks, fetchSoundCloudMeta, humanizeTrackUrl, type SoundCloudTrack } from "@/lib/soundcloud";

export const metadata: Metadata = {
  title: "WIP",
  description: "Works in progress — the latest demos and sketches, straight from SoundCloud.",
  alternates: { canonical: "/wip" },
};

/** Matches the feed's own cache window, so a new upload appears within the hour. */
export const revalidate = 3600;

const dateFormat = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

function formatDate(iso: string | undefined): string | undefined {
  if (!iso) return undefined;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? undefined : dateFormat.format(d);
}

/** Trailing slashes and query strings shouldn't make the same track look like two. */
function dedupeKey(url: string): string {
  try {
    const u = new URL(url);
    return (u.hostname + u.pathname).replace(/\/+$/, "").toLowerCase();
  } catch {
    return url.toLowerCase();
  }
}

interface WipItem extends SoundCloudTrack {
  note?: string;
  /** False when metadata couldn't be resolved; the link still works. */
  resolved: boolean;
  pinned: boolean;
}

export default async function WipPage() {
  const [live, pinnedMeta] = await Promise.all([
    fetchLatestSoundCloudTracks(site.wipFeedLimit),
    Promise.all(wipTracks.map((t) => fetchSoundCloudMeta(t.url))),
  ]);

  const liveByKey = new Map(live.map((t) => [dedupeKey(t.url), t]));

  // Pinned entries first. Prefer feed data (it carries date + duration), then
  // oEmbed, then a title derived from the URL so the card still renders.
  const pinned: WipItem[] = wipTracks.map((track, i) => {
    const fromFeed = liveByKey.get(dedupeKey(track.url));
    const meta = pinnedMeta[i];
    return {
      id: fromFeed?.id ?? track.url,
      url: track.url,
      title: track.title ?? fromFeed?.title ?? (meta.ok ? meta.meta.title : humanizeTrackUrl(track.url)),
      artwork: fromFeed?.artwork ?? (meta.ok ? meta.meta.thumbnail : undefined),
      publishedAt: fromFeed?.publishedAt,
      duration: fromFeed?.duration,
      note: track.note,
      resolved: Boolean(fromFeed) || meta.ok,
      pinned: true,
    };
  });

  const pinnedKeys = new Set(pinned.map((p) => dedupeKey(p.url)));
  const items: WipItem[] = [...pinned, ...live.filter((t) => !pinnedKeys.has(dedupeKey(t.url))).map((t) => ({ ...t, resolved: true, pinned: false }))];

  const feedWorking = live.length > 0;

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
        Rough mixes, half-ideas and things that may never be finished.{" "}
        {feedWorking
          ? "This list is the latest straight off SoundCloud, so it updates itself. Players load on tap."
          : "Nothing to show right now."}
      </p>

      {items.length === 0 ? (
        <p className="mt-16 text-xl text-muted">
          Everything finished is on the{" "}
          <Link href="/releases" className="text-accent underline underline-offset-4">
            releases
          </Link>{" "}
          page. New sketches land on SoundCloud first.
        </p>
      ) : (
        <ul className="mt-14 grid gap-8 lg:grid-cols-2">
          {items.map((item) => {
            const fallback = (
              <a href={item.url} target="_blank" rel="noreferrer" className="display block rounded-3xl border border-current/15 p-8 text-2xl">
                {item.title} — open on SoundCloud ↗
              </a>
            );
            return (
              <li key={item.id}>
                <ErrorBoundary fallback={fallback}>
                  <SoundCloudEmbed
                    url={item.url}
                    title={item.title}
                    thumbnail={item.artwork}
                    note={item.note}
                    publishedAt={formatDate(item.publishedAt)}
                    duration={item.duration}
                    pinned={item.pinned}
                    resolved={item.resolved}
                  />
                </ErrorBoundary>
              </li>
            );
          })}
        </ul>
      )}

      {feedWorking ? (
        <p className="label mt-12 text-muted">
          Showing the {items.length} most recent {items.length === 1 ? "upload" : "uploads"}. Everything else is on{" "}
          <a href={site.soundcloudProfile} target="_blank" rel="noreferrer" className="underline underline-offset-4">
            SoundCloud
          </a>
          .
        </p>
      ) : null}
    </div>
  );
}

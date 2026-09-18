"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { embedUrl, posterCandidates, watchUrl } from "@/lib/youtube";

interface YouTubeEmbedProps {
  /** Video id, already extracted by `youTubeId`. */
  id: string;
  title: string;
  note?: string;
  /** Local poster under /public. Overrides YouTube's own thumbnail. */
  poster?: string;
  /** Shown in the tile if every poster fails. Usually the record title. */
  fallbackLabel?: string;
}

type Status = "idle" | "loading" | "loaded" | "failed";

const LOAD_TIMEOUT_MS = 12000;

/**
 * Click-to-load facade for a YouTube video, in the same shape as the
 * SoundCloud one on the WIP page.
 *
 * A YouTube iframe pulls well over a megabyte of third-party JavaScript before
 * anyone has asked to watch anything, which would undo the work done
 * everywhere else on these pages. So the tile is a poster and a button, and the
 * iframe mounts only on a click. Hovering warms the connection, which buys back
 * most of the latency that laziness costs.
 *
 * Nothing here can break the page: the poster walks a list of candidates and
 * then gives up to a gradient tile, and a player that does not load inside
 * LOAD_TIMEOUT_MS is replaced by a plain link to YouTube.
 */
export function YouTubeEmbed({ id, title, note, poster, fallbackLabel }: YouTubeEmbedProps) {
  const [status, setStatus] = useState<Status>("idle");
  const [posterIndex, setPosterIndex] = useState(0);
  const [warm, setWarm] = useState(false);

  useEffect(() => {
    if (status !== "loading") return;
    const t = window.setTimeout(() => setStatus((s) => (s === "loading" ? "failed" : s)), LOAD_TIMEOUT_MS);
    return () => window.clearTimeout(t);
  }, [status]);

  const candidates = poster ? [poster, ...posterCandidates(id)] : posterCandidates(id);
  const posterSrc = candidates[posterIndex];
  const showFacade = status === "idle" || status === "failed";

  return (
    <figure className="overflow-hidden rounded-3xl border border-current/15 bg-fg/5">
      {/* Only once the pointer is over the tile — no third-party handshake for
          people who scroll past. */}
      {warm ? (
        <>
          <link rel="preconnect" href="https://www.youtube-nocookie.com" />
          <link rel="preconnect" href="https://i.ytimg.com" />
        </>
      ) : null}

      <div className="relative aspect-video">
        {showFacade ? (
          <>
            {posterSrc ? (
              // Plain <img>: YouTube's thumbnail shouldn't consume the image
              // optimizer quota, and a 404 just steps to the next candidate.
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={posterSrc}
                alt=""
                loading="lazy"
                decoding="async"
                referrerPolicy="no-referrer"
                onError={() => setPosterIndex((i) => i + 1)}
                className="absolute inset-0 h-full w-full object-cover"
              />
            ) : (
              <div className="cover-fallback absolute inset-0" role="img" aria-label={title}>
                <span className="display px-4 text-center text-[clamp(1.5rem,6cqw,4rem)] opacity-90">{fallbackLabel ?? title}</span>
              </div>
            )}
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-bg/80 via-bg/10 to-transparent" />
            <button
              type="button"
              onClick={() => setStatus("loading")}
              onMouseEnter={() => setWarm(true)}
              onFocus={() => setWarm(true)}
              onTouchStart={() => setWarm(true)}
              className="group absolute inset-0 grid place-items-center"
              aria-label={`Play ${title} (loads the YouTube player)`}
            >
              <span className="display grid size-24 place-items-center rounded-full bg-accent text-sm text-accent-fg transition-transform duration-300 ease-[var(--ease-out-expo)] group-hover:scale-110 group-hover:-rotate-6 sm:size-28 sm:text-base">
                Play
              </span>
            </button>
            {status === "failed" ? (
              <p role="alert" className="label absolute inset-x-4 bottom-4 rounded-full bg-bg/90 px-4 py-2 text-center">
                The player didn&apos;t load.{" "}
                <a href={watchUrl(id)} target="_blank" rel="noreferrer" className="underline">
                  Watch on YouTube ↗
                </a>
              </p>
            ) : null}
          </>
        ) : (
          <iframe
            title={`YouTube player: ${title}`}
            src={embedUrl(id)}
            className={cn("absolute inset-0 h-full w-full border-0", status === "loading" && "opacity-0")}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            referrerPolicy="strict-origin-when-cross-origin"
            allowFullScreen
            onLoad={() => setStatus("loaded")}
          />
        )}
        {status === "loading" ? (
          <div className="pointer-events-none absolute inset-0 grid place-items-center" aria-live="polite">
            <span className="label animate-pulse">Loading player…</span>
          </div>
        ) : null}
      </div>

      <figcaption className="flex items-start justify-between gap-4 p-5">
        <div className="min-w-0">
          <h3 className="display truncate text-xl sm:text-2xl">{title}</h3>
          {note ? <p className="mt-1 text-sm text-muted">{note}</p> : null}
        </div>
        <a href={watchUrl(id)} target="_blank" rel="noreferrer" className="label shrink-0 whitespace-nowrap py-1 underline-offset-4 hover:underline">
          YouTube ↗
        </a>
      </figcaption>
    </figure>
  );
}

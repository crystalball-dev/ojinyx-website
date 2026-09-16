"use client";

import { useEffect, useState } from "react";
import { widgetUrl } from "@/lib/soundcloud";
import { cn } from "@/lib/utils";

interface SoundCloudEmbedProps {
  url: string;
  title: string;
  author?: string;
  thumbnail?: string;
  note?: string;
  /** Hex without "#", passed to the widget. */
  accent?: string;
  /** False when oEmbed lookup failed — we still allow playing. */
  resolved: boolean;
}

type Status = "idle" | "loading" | "loaded" | "failed";

const LOAD_TIMEOUT_MS = 12000;

/**
 * Click-to-load facade for the official SoundCloud widget. The iframe (and
 * its ~1 MB of third-party JS) only mounts after an explicit play. If the
 * player doesn't load within a timeout we fall back to a plain link.
 */
export function SoundCloudEmbed({ url, title, author, thumbnail, note, accent = "c6ff00", resolved }: SoundCloudEmbedProps) {
  const [status, setStatus] = useState<Status>("idle");
  const [thumbOk, setThumbOk] = useState(Boolean(thumbnail));

  useEffect(() => {
    if (status !== "loading") return;
    const t = window.setTimeout(() => setStatus((s) => (s === "loading" ? "failed" : s)), LOAD_TIMEOUT_MS);
    return () => window.clearTimeout(t);
  }, [status]);

  const showFacade = status === "idle" || status === "failed";

  return (
    <article className="overflow-hidden rounded-3xl border border-current/15 bg-fg/5">
      <div className="relative h-[300px] sm:h-[380px]">
        {showFacade ? (
          <>
            {thumbOk && thumbnail ? (
              // Plain <img>: third-party art shouldn't go through our image optimizer quota,
              // and a hotlink failure just hides it.
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={thumbnail}
                alt=""
                loading="lazy"
                decoding="async"
                referrerPolicy="no-referrer"
                onError={() => setThumbOk(false)}
                className="absolute inset-0 h-full w-full object-cover opacity-60"
              />
            ) : (
              <div className="cover-fallback opacity-70" />
            )}
            <button
              type="button"
              onClick={() => setStatus("loading")}
              className="group absolute inset-0 grid place-items-center"
              aria-label={`Play ${title} (loads the SoundCloud player)`}
            >
              <span className="display grid size-24 place-items-center rounded-full bg-accent text-sm text-accent-fg transition-transform duration-300 ease-[var(--ease-out-expo)] group-hover:scale-110 group-hover:-rotate-6 sm:size-28 sm:text-base">
                Play
              </span>
            </button>
            {status === "failed" ? (
              <p role="alert" className="label absolute inset-x-4 bottom-4 rounded-full bg-bg/90 px-4 py-2 text-center">
                The player didn&apos;t load.{" "}
                <a href={url} target="_blank" rel="noreferrer" className="underline">
                  Open on SoundCloud ↗
                </a>
              </p>
            ) : null}
          </>
        ) : (
          <iframe
            title={`SoundCloud player: ${title}`}
            src={widgetUrl(url, { autoPlay: true, color: accent })}
            className={cn("absolute inset-0 h-full w-full border-0", status === "loading" && "opacity-0")}
            allow="autoplay; encrypted-media"
            loading="lazy"
            onLoad={() => setStatus("loaded")}
          />
        )}
        {status === "loading" ? (
          <div className="pointer-events-none absolute inset-0 grid place-items-center" aria-live="polite">
            <span className="label animate-pulse">Loading player…</span>
          </div>
        ) : null}
      </div>

      <div className="flex items-start justify-between gap-4 p-5">
        <div className="min-w-0">
          <h3 className="display truncate text-xl uppercase sm:text-2xl">{title}</h3>
          {author ? <p className="label mt-1 text-muted">{author}</p> : null}
          {note ? <p className="mt-2 text-sm text-muted">{note}</p> : null}
          {!resolved ? <p className="label mt-2 text-muted">details unavailable · link still works</p> : null}
        </div>
        <a href={url} target="_blank" rel="noreferrer" className="label shrink-0 whitespace-nowrap py-1 underline-offset-4 hover:underline">
          SoundCloud ↗
        </a>
      </div>
    </article>
  );
}

"use client";

import { useRef, useState, type SyntheticEvent } from "react";

type Status = "idle" | "loading" | "playing" | "paused" | "error";

// Only one preview plays at a time across the page.
let current: HTMLAudioElement | null = null;

/**
 * Minimal preview player on a native <audio> element — progressive streaming
 * via range requests, no library, ~1 KB. `preload="none"` means nothing is
 * fetched until the listener asks.
 */
export function PreviewPlayer({ src, title }: { src: string; title: string }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [progress, setProgress] = useState(0);

  const toggle = async () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (status === "playing" || status === "loading") {
      audio.pause();
      return;
    }
    if (current && current !== audio) current.pause();
    current = audio;
    setStatus("loading");
    try {
      await audio.play();
    } catch {
      setStatus("error");
    }
  };

  const onTime = (e: SyntheticEvent<HTMLAudioElement>) => {
    const a = e.currentTarget;
    if (a.duration > 0) setProgress(a.currentTime / a.duration);
  };

  const playing = status === "playing" || status === "loading";
  const label = status === "error" ? `Preview of ${title} unavailable` : playing ? `Pause preview of ${title}` : `Play preview of ${title}`;

  return (
    <span className="inline-flex shrink-0 items-center gap-2">
      <button
        type="button"
        onClick={toggle}
        aria-label={label}
        aria-pressed={playing}
        disabled={status === "error"}
        className="grid size-9 place-items-center rounded-full bg-accent text-accent-fg transition-transform hover:scale-105 disabled:opacity-40"
      >
        {playing ? (
          <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
            <rect x="1" y="1" width="3.5" height="10" fill="currentColor" />
            <rect x="7.5" y="1" width="3.5" height="10" fill="currentColor" />
          </svg>
        ) : (
          <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
            <path d="M2 1.5v9l8-4.5z" fill="currentColor" />
          </svg>
        )}
      </button>
      <span className="relative hidden h-1 w-14 overflow-hidden rounded bg-current/20 sm:block" aria-hidden="true">
        <span className="absolute inset-y-0 left-0 w-full origin-left bg-accent" style={{ transform: `scaleX(${progress})` }} />
      </span>
      {status === "error" ? <span className="label text-muted">n/a</span> : null}
      <audio
        ref={audioRef}
        src={src}
        preload="none"
        onPlaying={() => setStatus("playing")}
        onWaiting={() => setStatus("loading")}
        onPause={() => setStatus("paused")}
        onEnded={() => {
          setStatus("idle");
          setProgress(0);
        }}
        onError={() => setStatus("error")}
        onTimeUpdate={onTime}
      />
    </span>
  );
}

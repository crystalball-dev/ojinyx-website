"use client";

import { useEffect, useRef, useState } from "react";
import type { CoverVideo } from "@/content/types";
import { cn } from "@/lib/utils";
import { CoverImage } from "./cover-image";

type Mode =
  /** Plays as soon as it can (hero, release page). */
  | "autoplay"
  /** Plays while ≥60% in view, pauses otherwise. */
  | "inview"
  /** Hover to play on mouse devices; in-view behaviour on touch. */
  | "hover";

interface CoverMediaProps {
  poster?: string;
  blurDataURL?: string;
  alt: string;
  fallbackLabel?: string;
  video?: CoverVideo;
  mode?: Mode;
  /** Show an unmute toggle when the clip has audio. */
  sound?: boolean;
  /** Use the small silent variant (cards). */
  small?: boolean;
  priority?: boolean;
  sizes: string;
  className?: string;
  /** Extra classes for the wrapper around poster + video (e.g. an edge mask). */
  mediaClassName?: string;
}

/**
 * Poster image first (instant paint, LCP-friendly, works with no JS), with
 * the animated cover layered on top once the browser can play it. The video
 * element is only created after mount and only when the visitor hasn't asked
 * for reduced motion or data saving. Any playback error simply leaves the
 * poster in place. Must sit inside a positioned, sized container.
 */
export function CoverMedia({
  poster,
  blurDataURL,
  alt,
  fallbackLabel,
  video,
  mode = "inview",
  sound = false,
  small = false,
  priority = false,
  sizes,
  className,
  mediaClassName,
}: CoverMediaProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [enabled, setEnabled] = useState(false);
  const [useSmall, setUseSmall] = useState(small);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [active, setActive] = useState(mode === "autoplay");
  const [muted, setMuted] = useState(true);

  // After first paint, decide whether video is appropriate at all, and which
  // variant fits the box. (Deferred a frame so the poster is already on screen.)
  useEffect(() => {
    if (!video) return;
    const frame = requestAnimationFrame(() => {
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const saveData = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData === true;
      if (reduce || saveData) return;
      // Phones get the 540² silent variant everywhere (bandwidth); larger
      // viewports get the full clip so heroes stay sharp and keep their audio.
      if (!small && video.mp4Small && window.innerWidth <= 640) setUseSmall(true);
      setEnabled(true);
    });
    return () => cancelAnimationFrame(frame);
  }, [video, small]);

  // In-view / hover activation.
  useEffect(() => {
    if (!enabled || mode === "autoplay") return;
    const host = hostRef.current;
    if (!host) return;

    if (mode === "hover" && window.matchMedia("(hover: hover)").matches) {
      const on = () => setActive(true);
      const off = () => setActive(false);
      host.addEventListener("pointerenter", on);
      host.addEventListener("pointerleave", off);
      return () => {
        host.removeEventListener("pointerenter", on);
        host.removeEventListener("pointerleave", off);
      };
    }

    if (typeof IntersectionObserver === "undefined") {
      const t = setTimeout(() => setActive(true), 0);
      return () => clearTimeout(t);
    }
    const io = new IntersectionObserver(
      (entries) => {
        const e = entries[0];
        setActive(e.isIntersecting && e.intersectionRatio >= 0.6);
      },
      { threshold: [0, 0.6, 1] },
    );
    io.observe(host);
    return () => io.disconnect();
  }, [enabled, mode]);

  // Drive playback from `active`.
  useEffect(() => {
    const v = videoRef.current;
    if (!v || !enabled) return;
    if (active) {
      v.play().catch(() => {
        /* autoplay refused — poster stays */
      });
    } else {
      v.pause();
    }
  }, [active, enabled]);

  const toggleSound = () => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = !v.muted;
    setMuted(v.muted);
    if (!v.muted) v.play().catch(() => {});
  };

  const sources = video ? (useSmall && video.mp4Small ? { mp4: video.mp4Small } : { mp4: video.mp4, webm: video.webm }) : undefined;
  const showVideo = enabled && sources && !failed;

  return (
    <div ref={hostRef} className={cn("absolute inset-0", mediaClassName)}>
      <CoverImage
        src={poster}
        alt={alt}
        fallbackLabel={fallbackLabel}
        blurDataURL={blurDataURL}
        sizes={sizes}
        priority={priority}
        className={className}
      />
      {showVideo ? (
        <video
          ref={videoRef}
          className={cn(
            "absolute inset-0 h-full w-full object-cover transition-opacity duration-700 ease-out",
            ready && active ? "opacity-100" : "opacity-0",
          )}
          muted
          playsInline
          loop
          autoPlay={mode === "autoplay"}
          preload={mode === "autoplay" ? "auto" : "none"}
          onCanPlay={() => setReady(true)}
          onError={() => setFailed(true)}
          aria-hidden="true"
          tabIndex={-1}
        >
          {sources.webm ? <source src={sources.webm} type="video/webm" /> : null}
          <source src={sources.mp4} type="video/mp4" />
        </video>
      ) : null}
      {sound && showVideo && ready && video?.hasAudio && !useSmall ? (
        <button
          type="button"
          onClick={toggleSound}
          aria-pressed={!muted}
          className="label absolute bottom-3 right-3 z-10 rounded-full bg-black/60 px-3 py-2 text-white backdrop-blur-sm transition-colors hover:bg-black/80"
        >
          {muted ? "Sound on" : "Sound off"}
        </button>
      ) : null}
    </div>
  );
}

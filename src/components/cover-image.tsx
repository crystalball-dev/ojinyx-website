"use client";

import Image from "next/image";
import { useState } from "react";
import { cn } from "@/lib/utils";

interface CoverImageProps {
  src?: string;
  alt: string;
  /** Rendered in the fallback tile when the image is missing or fails. */
  fallbackLabel?: string;
  blurDataURL?: string;
  sizes: string;
  priority?: boolean;
  className?: string;
}

/**
 * next/image with a failure path. Must be rendered inside a positioned
 * container with an aspect ratio (it uses `fill`). If the source is missing
 * or 404s we swap to a palette-colored tile with the title so layouts never
 * collapse and no broken-image icon ever shows.
 */
export function CoverImage({ src, alt, fallbackLabel, blurDataURL, sizes, priority = false, className }: CoverImageProps) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <div className={cn("cover-fallback", className)} role="img" aria-label={alt}>
        <span className="display px-4 text-center text-[clamp(1.5rem,6cqw,4rem)] opacity-90">{fallbackLabel ?? alt}</span>
      </div>
    );
  }

  return (
    <Image
      src={src}
      alt={alt}
      fill
      sizes={sizes}
      priority={priority}
      fetchPriority={priority ? "high" : undefined}
      placeholder={blurDataURL ? "blur" : "empty"}
      blurDataURL={blurDataURL}
      onError={() => setFailed(true)}
      className={cn("object-cover", className)}
    />
  );
}

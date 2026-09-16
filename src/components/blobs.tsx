import type { CSSProperties } from "react";
import { cn } from "@/lib/utils";

interface BlobsProps {
  /** Up to four colors; defaults to the current theme's accents. */
  colors?: string[];
  className?: string;
}

/**
 * Four soft radial gradients drifting on transform-only keyframes. All the
 * motion is compositor work; nothing repaints. Purely decorative.
 */
export function Blobs({ colors, className }: BlobsProps) {
  const style = colors?.length
    ? ({
        "--c1": colors[0],
        "--c2": colors[1] ?? colors[0],
        "--c3": colors[2] ?? colors[0],
        "--c4": colors[3] ?? colors[1] ?? colors[0],
      } as CSSProperties)
    : undefined;

  return (
    <div className={cn("blobs", className)} style={style} aria-hidden="true">
      <div className="blob blob-1" />
      <div className="blob blob-2" />
      <div className="blob blob-3" />
      <div className="blob blob-4" />
    </div>
  );
}

import { WORDMARK_PATH, WORDMARK_VIEWBOX } from "@/brand/wordmark";
import { cn } from "@/lib/utils";

interface WordmarkProps {
  className?: string;
  /** Filled (default) or stroked outline. */
  variant?: "fill" | "outline";
  /** Decorative instances should be hidden from assistive tech. */
  decorative?: boolean;
  strokeWidth?: number;
}

/**
 * The blackletter OJINYX wordmark as inline SVG so it inherits `currentColor`
 * (and therefore works inside the difference-blended nav and themed pages).
 */
export function Wordmark({ className, variant = "fill", decorative = false, strokeWidth = 3 }: WordmarkProps) {
  return (
    <svg
      viewBox={WORDMARK_VIEWBOX}
      className={cn("block", className)}
      role={decorative ? undefined : "img"}
      aria-label={decorative ? undefined : "OJINYX"}
      aria-hidden={decorative || undefined}
      focusable="false"
    >
      <path
        d={WORDMARK_PATH}
        fill={variant === "fill" ? "currentColor" : "none"}
        stroke={variant === "outline" ? "currentColor" : undefined}
        strokeWidth={variant === "outline" ? strokeWidth : undefined}
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

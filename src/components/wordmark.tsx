import { WORDMARK_PATH, WORDMARK_VIEWBOX } from "@/brand/wordmark";
import { site } from "@/content/site";
import { cn } from "@/lib/utils";

interface WordmarkProps {
  className?: string;
  /** Filled (default) or stroked outline. */
  variant?: "fill" | "outline";
  /** Decorative instances should be hidden from assistive tech. */
  decorative?: boolean;
  strokeWidth?: number;
  /**
   * Paint with the per-page gradient instead of a flat color. Stops read
   * --mark-1/2/3 and fall back to currentColor, so an instance renders exactly
   * as it did before on any page that doesn't set them. Release pages set them
   * to that record's gradient (see mark-gradients.generated.json).
   */
  gradient?: boolean;
  /** Must be unique per document when more than one gradient instance renders. */
  gradientId?: string;
}

/**
 * The blackletter OJINYX wordmark as inline SVG so it inherits `currentColor`
 * (and therefore works inside the difference-blended nav, on themed pages, and
 * in OG cards).
 */
export function Wordmark({
  className,
  variant = "fill",
  decorative = false,
  strokeWidth = 3,
  gradient = false,
  gradientId = "wordmark-gradient",
}: WordmarkProps) {
  const paint = gradient ? `url(#${gradientId})` : "currentColor";
  return (
    <svg
      viewBox={WORDMARK_VIEWBOX}
      className={cn("block", className)}
      role={decorative ? undefined : "img"}
      aria-label={decorative ? undefined : site.name}
      aria-hidden={decorative || undefined}
      focusable="false"
    >
      {gradient ? (
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" style={{ stopColor: "var(--mark-1, currentColor)" }} />
            <stop offset="50%" style={{ stopColor: "var(--mark-2, currentColor)" }} />
            <stop offset="100%" style={{ stopColor: "var(--mark-3, currentColor)" }} />
          </linearGradient>
        </defs>
      ) : null}
      <path
        d={WORDMARK_PATH}
        fill={variant === "fill" ? paint : "none"}
        stroke={variant === "outline" ? paint : undefined}
        strokeWidth={variant === "outline" ? strokeWidth : undefined}
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

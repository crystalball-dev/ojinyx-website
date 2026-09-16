import { cn } from "@/lib/utils";

interface LabelBadgeProps {
  /** Text set around the ring, e.g. "OPERATION FAIRWAY". */
  text: string;
  className?: string;
}

const RADIUS = 37;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/**
 * Imprint stamp: the label set around a slowly rotating ring. `textLength`
 * is pinned to the circumference so the two repeats always close the circle,
 * whatever the label says. Rotation stops under reduced motion (.spin-slow).
 */
export function LabelBadge({ text, className }: LabelBadgeProps) {
  const pathId = `ring-${text.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  return (
    <svg viewBox="0 0 100 100" className={cn("spin-slow", className)} role="img" aria-label={text} focusable="false">
      <defs>
        <path
          id={pathId}
          fill="none"
          d={`M 50,50 m -${RADIUS},0 a ${RADIUS},${RADIUS} 0 1,1 ${RADIUS * 2},0 a ${RADIUS},${RADIUS} 0 1,1 -${RADIUS * 2},0`}
        />
      </defs>
      <circle cx="50" cy="50" r="47" fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.4" />
      <circle cx="50" cy="50" r="5.5" fill="currentColor" />
      <text fill="currentColor" fontSize="9.5" fontWeight="700">
        <textPath href={`#${pathId}`} startOffset="0" textLength={CIRCUMFERENCE.toFixed(2)} lengthAdjust="spacing">
          {`${text} · ${text} · `}
        </textPath>
      </text>
    </svg>
  );
}

import { Fragment, type CSSProperties, type ReactNode } from "react";
import { cn } from "@/lib/utils";

interface MarqueeProps {
  items: ReactNode[];
  className?: string;
  /** Seconds for the items to scroll past once. Speed is the same whatever `repeat` is. */
  duration?: number;
  reverse?: boolean;
  separator?: ReactNode;
  /**
   * How many times the item run repeats inside each copy. See the note below
   * on why a copy has to be wide; three runs covers a 4K screen at the largest
   * ticker font, and the CSS min-width covers anything wider than that.
   */
  repeat?: number;
}

/**
 * CSS-only infinite ticker. The track holds two identical copies and slides by
 * exactly one copy per loop, then snaps back.
 *
 * That snap is only invisible if ONE copy is at least as wide as the band. At
 * the last frame the track has moved a full copy left, so the band's right
 * edge sits (band width − copy width) past the end of the track — a blank
 * stretch that appears just before each loop restarts. The ticker font stops
 * growing at its clamp maximum while screens keep getting wider, so a single
 * run of four or five words fell short on anything from 1280px up.
 *
 * Fix: each copy repeats the run `repeat` times, the loop duration scales by
 * the same factor so the scroll speed is unchanged, and the copy carries a
 * `min-width: 100vw` guarantee in CSS.
 */
export function Marquee({ items, className, duration = 28, reverse = false, separator = "✦", repeat = 3 }: MarqueeProps) {
  if (items.length === 0) return null;
  const runs = Math.max(1, Math.floor(repeat));

  const copy = (copyIndex: number) => (
    <span className="marquee-copy">
      {Array.from({ length: runs }, (_, run) => run).flatMap((run) =>
        items.map((item, i) => (
          <Fragment key={`${copyIndex}-${run}-${i}`}>
            <span>{item}</span>
            <span>{separator}</span>
          </Fragment>
        )),
      )}
    </span>
  );

  return (
    <div className={cn("marquee", className)} style={{ "--marquee-duration": `${duration * runs}s` } as CSSProperties}>
      {/* The moving track repeats everything several times, which a screen
          reader would read aloud each time. It gets one clean pass instead. */}
      <span className="sr-only">
        {items.map((item, i) => (
          <Fragment key={i}>
            {item}
            {i < items.length - 1 ? ", " : null}
          </Fragment>
        ))}
      </span>
      <div className="marquee-track" aria-hidden="true" data-reverse={reverse ? "true" : undefined}>
        {copy(0)}
        {copy(1)}
      </div>
    </div>
  );
}

import { Fragment, type CSSProperties, type ReactNode } from "react";
import { cn } from "@/lib/utils";

interface MarqueeProps {
  items: ReactNode[];
  className?: string;
  /** Seconds for one full loop. */
  duration?: number;
  reverse?: boolean;
  separator?: ReactNode;
}

/** CSS-only infinite ticker. Two identical copies, track translates by 50%. */
export function Marquee({ items, className, duration = 28, reverse = false, separator = "✦" }: MarqueeProps) {
  if (items.length === 0) return null;
  const copy = (hidden: boolean) => (
    <span className="marquee-copy" aria-hidden={hidden || undefined}>
      {items.map((item, i) => (
        <Fragment key={i}>
          <span>{item}</span>
          <span aria-hidden="true">{separator}</span>
        </Fragment>
      ))}
    </span>
  );
  return (
    <div className={cn("marquee", className)} style={{ "--marquee-duration": `${duration}s` } as CSSProperties}>
      <div className="marquee-track" data-reverse={reverse ? "true" : undefined}>
        {copy(false)}
        {copy(true)}
      </div>
    </div>
  );
}

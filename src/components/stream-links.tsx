import type { Release } from "@/content/types";
import { streamLinks } from "@/lib/releases";
import { cn } from "@/lib/utils";

import { pillOutline, pillSolid } from "./pill";

/** Streaming buttons. Hides services with no URL; shows a calm empty state if there are none. */
export function StreamLinks({ release, compact = false }: { release: Release; compact?: boolean }) {
  const links = streamLinks(release);
  const smart = release.smartLink && /^https?:\/\//i.test(release.smartLink) ? release.smartLink : undefined;

  if (links.length === 0 && !smart) {
    return <p className="label text-muted">Not on streaming services yet.</p>;
  }

  return (
    <ul className={cn("flex flex-wrap", compact ? "gap-2" : "gap-3")}>
      {links.map((link) => (
        <li key={link.service}>
          <a href={link.href} target="_blank" rel="noreferrer" className={cn(pillSolid, compact && "px-4 py-2")}>
            {link.label}
            <span aria-hidden="true">↗</span>
          </a>
        </li>
      ))}
      {smart ? (
        <li>
          <a href={smart} target="_blank" rel="noreferrer" className={cn(pillOutline, compact && "px-4 py-2")}>
            All platforms
            <span aria-hidden="true">↗</span>
          </a>
        </li>
      ) : null}
    </ul>
  );
}

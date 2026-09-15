"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { NAV, site } from "@/content/site";
import { cn } from "@/lib/utils";
import { Wordmark } from "./wordmark";

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

/**
 * Fixed header in `mix-blend-mode: difference`, so it stays legible over the
 * hero blobs, light release pages and dark ones alike without any per-page
 * colour logic. The mobile menu is a sibling so it isn't blended; its
 * entrance is CSS (see .menu-overlay / .menu-item in globals.css).
 */
export function Nav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // Close on navigation (including back/forward), using React's
  // "adjust state during render" pattern rather than an effect.
  const [lastPathname, setLastPathname] = useState(pathname);
  if (pathname !== lastPathname) {
    setLastPathname(pathname);
    setOpen(false);
  }

  // Lock scroll + Escape to close while the overlay is up.
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <>
      <header className="pointer-events-none fixed inset-x-0 top-0 z-50 text-white mix-blend-difference">
        <nav className="gutter pointer-events-auto flex items-center justify-between py-5" aria-label="Primary">
          <Link href="/" aria-label={`${site.name} — home`} className="block">
            <Wordmark decorative className="h-8 w-auto" />
          </Link>

          <ul className="label hidden items-center gap-8 md:flex">
            {NAV.map((entry) => {
              const active = isActive(pathname, entry.href);
              return (
                <li key={entry.href}>
                  <Link
                    href={entry.href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "relative inline-block py-2 transition-opacity duration-200 hover:opacity-100",
                      active ? "opacity-100" : "opacity-60",
                    )}
                  >
                    {entry.label}
                    {active ? <span className="absolute inset-x-0 -bottom-0.5 h-[3px] bg-white" aria-hidden="true" /> : null}
                  </Link>
                </li>
              );
            })}
          </ul>

          <button
            type="button"
            className="label -mr-2 px-2 py-2 md:hidden"
            aria-expanded={open}
            aria-controls="mobile-menu"
            onClick={() => setOpen((v) => !v)}
          >
            {open ? "Close" : "Menu"}
          </button>
        </nav>
      </header>

      {open ? (
        <div
          id="mobile-menu"
          className="menu-overlay fixed inset-0 z-40 flex flex-col justify-end bg-accent text-accent-fg md:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="Menu"
        >
          <ul className="gutter flex flex-col gap-2 pb-[max(2rem,env(safe-area-inset-bottom))]">
            {NAV.map((entry, i) => (
              <li key={entry.href} className="menu-item" style={{ animationDelay: `${60 + i * 50}ms` }}>
                <Link
                  href={entry.href}
                  className={cn(
                    "display block text-[clamp(2.5rem,11.5vw,6rem)] leading-[0.9]",
                    isActive(pathname, entry.href) ? "" : "text-outline",
                  )}
                >
                  {entry.label}
                </Link>
              </li>
            ))}
            <li className="menu-item label mt-6 flex flex-wrap gap-x-5 gap-y-2 opacity-70" style={{ animationDelay: `${60 + NAV.length * 50}ms` }}>
              {site.socials.map((s) => (
                <a key={s.label} href={s.href} target="_blank" rel="noreferrer">
                  {s.label}
                </a>
              ))}
            </li>
          </ul>
        </div>
      ) : null}
    </>
  );
}

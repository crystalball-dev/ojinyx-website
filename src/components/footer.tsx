import Link from "next/link";
import { NAV, site } from "@/content/site";
import { Wordmark } from "./wordmark";

export function Footer() {
  const year = new Date().getUTCFullYear();
  return (
    <footer className="relative overflow-hidden border-t border-current/10 bg-bg text-fg">
      <div className="gutter pb-10 pt-14">
        {/* Painted with --mark-1/2/3 when a page sets them (release pages do),
            and identical to a plain outline everywhere else. */}
        <Wordmark
          decorative
          variant="outline"
          strokeWidth={1.5}
          gradient
          gradientId="footer-mark"
          className="w-full max-w-5xl opacity-70"
        />

        <div className="mt-10 grid gap-10 sm:grid-cols-3">
          <div>
            <p className="label text-muted">Navigate</p>
            <ul className="mt-3 flex flex-col gap-1">
              {NAV.map((entry) => (
                <li key={entry.href}>
                  <Link href={entry.href} className="display text-2xl underline-offset-8 hover:underline">
                    {entry.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="label text-muted">Elsewhere</p>
            {site.socials.length ? (
              <ul className="mt-3 flex flex-col gap-1">
                {site.socials.map((s) => (
                  <li key={s.label}>
                    <a href={s.href} target="_blank" rel="noreferrer" className="display text-2xl uppercase underline-offset-8 hover:underline">
                      {s.label} <span aria-hidden="true">↗</span>
                    </a>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-muted">Links coming soon.</p>
            )}
          </div>
          <div>
            <p className="label text-muted">Contact</p>
            <a href={`mailto:${site.email}`} className="display mt-3 inline-block break-all text-2xl underline-offset-8 hover:underline">
              {site.email}
            </a>
            <p className="label mt-5 text-muted">Released through</p>
            <p className="display mt-2 text-2xl text-accent">{site.label}</p>
            {site.location ? <p className="mt-3 text-muted">{site.location}</p> : null}
          </div>
        </div>

        <p className="mt-14 text-xs uppercase tracking-[0.14em] text-muted">
          © {year} <span className="normal-case">{site.name}</span> · {site.label} · All rights reserved.
        </p>
      </div>
    </footer>
  );
}

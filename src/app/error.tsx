"use client";

import { useEffect } from "react";
import Link from "next/link";
import { pillOutline, pillSolid } from "@/components/pill";

/** Route-level error UI. Keeps nav + footer; offers retry. */
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <section className="gutter flex min-h-[70svh] flex-col justify-center gap-8 py-32">
      <h1 className="display text-[clamp(3rem,10vw,9rem)]">ANOMALY</h1>
      <p className="max-w-md text-xl text-muted">Something on this page broke. The rest of the site is fine.</p>
      <div className="flex flex-wrap gap-3">
        <button type="button" onClick={reset} className={pillSolid}>
          Try again
        </button>
        <Link href="/" className={pillOutline}>
          Home
        </Link>
      </div>
      {error.digest ? <p className="label text-muted">ref {error.digest}</p> : null}
    </section>
  );
}
